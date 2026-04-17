import knex from '../lib/knex.js';
import shortid from '../lib/shortid.js';

async function addConfirmation(listId, action, ip, data) {
    const cid = shortid.generate();
    await knex('confirmations').insert({
        cid,
        list: listId,
        action,
        ip,
        data: JSON.stringify(data || {})
    });

    return cid;
}

/*
 Atomically retrieves confirmation from the database, removes it from the database and returns it.
 */
async function takeConfirmation(cid) {
    return await knex.transaction(async tx => {
        const entry = await tx('confirmations').select(['cid', 'list', 'action', 'ip', 'data']).where('cid', cid).forUpdate().first();

        if (!entry) {
            return false;
        }

        await tx('confirmations').where('cid', cid).del();

        let data;
        try {
            data = JSON.parse(entry.data);
        } catch (err) {
            data = {};
        }

        return {
            list: entry.list,
            action: entry.action,
            ip: entry.ip,
            data
        };
    });
}

export { addConfirmation };
export { takeConfirmation };

export default {
    addConfirmation,
    takeConfirmation
};
