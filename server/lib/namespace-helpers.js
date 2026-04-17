import { enforce } from './helpers.js';
import * as interoperableErrors from '../../shared/interoperable-errors.js';
import shares from '../models/shares.js';

async function validateEntity(tx, entity) {
    enforce(entity.namespace, 'Entity namespace not set');
    if (!await tx('namespaces').where('id', entity.namespace).first()) {
        throw new interoperableErrors.NamespaceNotFoundError();
    }
}

async function validateMoveTx(tx, context, entity, existing, entityTypeId, createOperation, deleteOperation) {
    if (existing.namespace !== entity.namespace) {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, createOperation);
        await shares.enforceEntityPermissionTx(tx, context, entityTypeId, entity.id, deleteOperation);
    }
}

export { validateEntity, validateMoveTx };

export default {
    validateEntity,
    validateMoveTx
};
