import knex from '../lib/knex.js';
import * as dtHelpers from '../lib/dt-helpers.js';
import shares from './shares.js';
import * as tools from '../lib/tools.js';
import { enforce } from '../lib/helpers.js';

import { BlacklistActivityType } from '../../shared/activity-log.js';
import * as activityLog from '../lib/activity-log.js';

async function listDTAjax(context, params) {
    shares.enforceGlobalPermission(context, 'manageBlacklist');

    return await dtHelpers.ajaxList(
        params,
        builder => builder
            .from('blacklist'),
        ['blacklist.email']
    );
}

async function search(context, offset, limit, search) {
    return await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'manageBlacklist');

        search = '%' + search + '%';

        const count = await tx('blacklist').where('email', 'like', search).count('* as count').first().count;

        const rows = await tx('blacklist').where('email', 'like', search).offset(offset).limit(limit);

        return {
            emails: rows.map(row => row.email),
            total: count
        };
    });
}

async function add(context, email) {
    enforce(email, 'Email has to be set');

    shares.enforceGlobalPermission(context, 'manageBlacklist');

    try {
        await knex('blacklist').insert({email});
        await activityLog.logBlacklistActivity(BlacklistActivityType.ADD, email);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
        } else {
            throw err;
        }
    }
}

async function remove(context, email) {
    enforce(email, 'Email has to be set');

    return await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'manageBlacklist');

        await tx('blacklist').where('email', email).del();

        await activityLog.logBlacklistActivity(BlacklistActivityType.REMOVE, email);
    });
}

async function isBlacklisted(email) {
    enforce(email, 'Email has to be set');

    const existing = await knex('blacklist').where('email', email).first();
    return !!existing;
}

async function serverValidate(context, data) {
    shares.enforceGlobalPermission(context, 'manageBlacklist');
    const result = {};

    if (data.email) {
        const user = await knex('blacklist').where('email', data.email).first();

        result.email = {};
        result.email.invalid = await tools.validateEmail(data.email) !== 0;
        result.email.exists = !!user;
    }

    return result;
}

export default { listDTAjax, add, remove, search, isBlacklisted, serverValidate };
export { listDTAjax, add, remove, search, isBlacklisted, serverValidate };
