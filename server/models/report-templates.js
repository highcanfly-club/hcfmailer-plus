import { enforce, filterObject } from '../lib/helpers.js';
import knex from '../lib/knex.js';
import { hasher as hasherFactory } from 'node-object-hash';
const hasher = hasherFactory();
import dtHelpers from '../lib/dt-helpers.js';
import interoperableErrors from '../../shared/interoperable-errors.js';
import namespaceHelpers from '../lib/namespace-helpers.js';
import shares from './shares.js';
import reports from './reports.js';
import dependencyHelpers from '../lib/dependency-helpers.js';


const allowedKeys = new Set(['name', 'description', 'mime_type', 'user_fields', 'js', 'hbs', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'reportTemplate', id, 'view');
        const entity = await tx('report_templates').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'reportTemplate', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'reportTemplate', requiredOperations: ['view'] }],
        params,
        builder => builder.from('report_templates').innerJoin('namespaces', 'namespaces.id', 'report_templates.namespace'),
        [ 'report_templates.id', 'report_templates.name', 'report_templates.description', 'report_templates.created', 'namespaces.name' ]
    );
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceGlobalPermission(context, 'createJavascriptWithROAccess');
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createReportTemplate');
        await namespaceHelpers.validateEntity(tx, entity);

        const ids = await tx('report_templates').insert(filterObject(entity, allowedKeys));
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'reportTemplate', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceGlobalPermission(context, 'createJavascriptWithROAccess');
        await shares.enforceEntityPermissionTx(tx, context, 'reportTemplate', entity.id, 'edit');

        const existing = await tx('report_templates').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, entity);
        await namespaceHelpers.validateMoveTx(tx, context, entity, existing, 'reportTemplate', 'createReportTemplate', 'delete');

        await tx('report_templates').where('id', entity.id).update(filterObject(entity, allowedKeys));

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'reportTemplate', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'reportTemplate', id, 'delete');

        await dependencyHelpers.ensureNoDependencies(tx, context, id, [
            { entityTypeId: 'report', column: 'report_template' }
        ]);

        await tx('report_templates').where('id', id).del();
    });
}

async function getUserFieldsById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'reportTemplate', id, 'view');
        const entity = await tx('report_templates').select(['user_fields']).where('id', id).first();
        return JSON.parse(entity.user_fields);
    });
}

export { hash };
export { getById };
export { listDTAjax };
export { create };
export { updateWithConsistencyCheck };
export { remove };
export { getUserFieldsById };

export default {
    create,
    getById,
    getUserFieldsById,
    hash,
    listDTAjax,
    remove,
    updateWithConsistencyCheck
};
