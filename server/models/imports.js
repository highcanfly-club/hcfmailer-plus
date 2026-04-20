import { enforce, filterObject } from '../lib/helpers.js';
import { ImportSource, MappingType, ImportStatus, RunStatus, prepFinished, prepFinishedAndNotInProgress, runInProgress } from '../../shared/imports.js';
import { ListActivityType } from '../../shared/activity-log.js';
import knex from '../lib/knex.js';
import { hasher as hasherFactory } from 'node-object-hash';
const hasher = hasherFactory();
import dtHelpers from '../lib/dt-helpers.js';
import interoperableErrors from '../../shared/interoperable-errors.js';
import shares from './shares.js';
import fs from 'fs-extra-promise';
import path from 'path';
import importer from '../lib/importer.js';
import activityLog from '../lib/activity-log.js';
import files from './files.js';


const filesDir = path.join(files.filesDir, 'imports');

const allowedKeysCreate = new Set(['name', 'description', 'source', 'settings']);
const allowedKeysUpdate = new Set(['name', 'description', 'mapping_type', 'mapping']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, listId, id, withSampleRow = false) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'viewImports');

        const entity = await tx('imports').where({list: listId, id}).first();

        if (!entity) {
            throw new interoperableErrors.NotFoundError();
        }

        entity.settings = JSON.parse(entity.settings);
        entity.mapping = JSON.parse(entity.mapping);

        if (withSampleRow && prepFinished(entity.status)) {
            if (entity.source === ImportSource.CSV_FILE) {
                const importTable = 'import_file__' + id;

                const row = await tx(importTable).first();
                delete row.id;

                entity.sampleRow = row;
            }
        }

        return entity;
    });
}

async function listDTAjax(context, listId, params) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'viewImports');

        return await dtHelpers.ajaxListTx(
            tx,
            params,
            builder => builder
                .from('imports')
                .where('imports.list', listId),
            [ 'imports.id', 'imports.name', 'imports.description', 'imports.source', 'imports.status', 'imports.last_run' ]
        );
    });
}

async function _validateAndPreprocess(tx, listId, entity, isCreate) {
    if (isCreate) {
        enforce(Number.isInteger(entity.source));
        enforce(entity.source >= ImportSource.MIN && entity.source <= ImportSource.MAX, 'Invalid import source');

        entity.settings = entity.settings || {};

        if (entity.source === ImportSource.CSV_FILE) {
            entity.settings.csv = entity.settings.csv || {};
            enforce(entity.settings.csv.delimiter && entity.settings.csv.delimiter.trim(), 'CSV delimiter must not be empty');
        }

    } else {
        enforce(Number.isInteger(entity.mapping_type));
        enforce(entity.mapping_type >= MappingType.MIN && entity.mapping_type <= MappingType.MAX, 'Invalid mapping type');

        entity.mapping = entity.mapping || { settings: {}, fields: {} };
    }
}

async function create(context, listId, entity, files) {
    const res = await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'setupAutomation');
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'manageImports');

        await _validateAndPreprocess(tx, listId, entity, true);

        if (entity.source === ImportSource.CSV_FILE) {
            enforce(files.csvFile, 'File must be included');
            const csvFile = files.csvFile[0];
            const filePath = path.join(filesDir, csvFile.filename);
            await fs.moveAsync(csvFile.path, filePath, {});

            entity.settings.csv = {
                originalname: csvFile.originalname,
                filename: csvFile.filename,
                delimiter: entity.settings.csv.delimiter
            };

            entity.status = ImportStatus.PREP_SCHEDULED;
        }

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        filteredEntity.list = listId;
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.status = entity.status;

        filteredEntity.mapping_type = MappingType.BASIC_SUBSCRIBE; // This is not set in the create form. It can be changed in the update form.
        filteredEntity.mapping = JSON.stringify({});

        const ids = await tx('imports').insert(filteredEntity);
        const id = ids[0];

        await activityLog.logEntityActivity('list', ListActivityType.CREATE_IMPORT, listId, {importId: id, importStatus: entity.status});

        return id;
    });

    importer.scheduleCheck();
    return res;
}

async function updateWithConsistencyCheck(context, listId, entity) {
    await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'setupAutomation');
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'manageImports');

        const existing = await tx('imports').where({list: listId, id: entity.id}).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.mapping = JSON.parse(existing.mapping);
        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        enforce(prepFinished(existing.status), 'Cannot save updates until preparation is finished');

        await _validateAndPreprocess(tx, listId, entity, false);

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        filteredEntity.mapping = JSON.stringify(filteredEntity.mapping);

        await tx('imports').where({list: listId, id: entity.id}).update(filteredEntity);

        await activityLog.logEntityActivity('list', ListActivityType.UPDATE_IMPORT, listId, {importId: entity.id, importStatus: entity.status});
    });
}

async function removeTx(tx, context, listId, id) {
    await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'manageImports');

    const existing = await tx('imports').where({list: listId, id: id}).first();
    if (!existing) {
        throw new interoperableErrors.NotFoundError();
    }

    existing.settings = JSON.parse(existing.settings);

    const filePath = path.join(filesDir, existing.settings.csv.filename);
    await fs.removeAsync(filePath);

    const importTable = 'import_file__' + id;
    await knex.schema.dropTableIfExists(importTable);

    await tx('import_failed').whereIn('run', function() {this.from('import_runs').select('id').where('import', id)}).del();
    await tx('import_runs').where('import', id).del();
    await tx('imports').where({list: listId, id}).del();

    await activityLog.logEntityActivity('list', ListActivityType.REMOVE_IMPORT, listId, {importId: id});
}

async function remove(context, listId, id) {
    await knex.transaction(async tx => {
        await removeTx(tx, context, listId, id);
    });
}

async function removeAllByListIdTx(tx, context, listId) {
    const entities = await tx('imports').where('list', listId).select(['id']);
    for (const entity of entities) {
        await removeTx(tx, context, listId, entity.id);
    }
}

async function start(context, listId, id) {
    await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'setupAutomation');
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'manageImports');

        const entity = await tx('imports').where({list: listId, id}).first();
        if (!entity) {
            throw new interoperableErrors.NotFoundError();
        }

        if (!prepFinishedAndNotInProgress(entity.status)) {
            throw new interoperableErrors.InvalidStateError('Cannot start until preparation or run is finished');
        }

        await tx('imports').where({list: listId, id}).update({
            status: ImportStatus.RUN_SCHEDULED
        });

        await tx('import_runs').insert({
            import: id,
            status: RunStatus.SCHEDULED,
            mapping: entity.mapping
        });

        await activityLog.logEntityActivity('list', ListActivityType.IMPORT_STATUS_CHANGE, listId, {importId: id, importStatus: ImportStatus.RUN_SCHEDULED});
    });

    importer.scheduleCheck();
}

async function stop(context, listId, id) {
    await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'setupAutomation');
        await shares.enforceEntityPermissionTx(tx, context, 'list', listId, 'manageImports');

        const entity = await tx('imports').where({list: listId, id}).first();
        if (!entity) {
            throw new interoperableErrors.NotFoundError();
        }

        if (!runInProgress(entity.status)) {
            throw new interoperableErrors.InvalidStateError('No import is currently running');
        }

        await tx('imports').where({list: listId, id}).update({
            status: ImportStatus.RUN_STOPPING
        });

        await tx('import_runs').where('import', id).whereIn('status', [RunStatus.SCHEDULED, RunStatus.RUNNING]).update({
            status: RunStatus.STOPPING
        });

        await activityLog.logEntityActivity('list', ListActivityType.IMPORT_STATUS_CHANGE, listId, {importId: id, importStatus: ImportStatus.RUN_STOPPING});
    });

    importer.scheduleCheck();
}

export { filesDir };
export { hash };
export { getById };
export { listDTAjax };
export { create };
export { updateWithConsistencyCheck };
export { remove };
export { removeAllByListIdTx };
export { start };
export { stop };

export default {
    create,
    filesDir,
    getById,
    hash,
    listDTAjax,
    remove,
    removeAllByListIdTx,
    start,
    stop,
    updateWithConsistencyCheck
};
