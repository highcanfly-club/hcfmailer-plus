import { filterObject } from '../lib/helpers.js';
import knex from '../lib/knex.js';
import hasherFactory from 'node-object-hash';
const hasher = hasherFactory();
import shares from './shares.js';


const allowedKeys = new Set(['adminEmail', 'uaCode', 'mapsApiKey', 'shoutout', 'pgpPassphrase', 'pgpPrivateKey', 'defaultHomepage']);
// defaultHomepage is used as a default to list.homepage - if the list.homepage is not filled in

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function get(context, keyOrKeys) {
    shares.enforceGlobalPermission(context, 'manageSettings');

    let keys;
    if (!keyOrKeys) {
        keys = [...allowedKeys.values()];
    } else if (!Array.isArray(keyOrKeys)) {
        keys = [ keys ];
    } else {
        keys = keyOrKeys;
    }

    const rows = await knex('settings').select(['key', 'value']).whereIn('key', keys);

    const settings = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }

    if (!Array.isArray(keyOrKeys) && keyOrKeys) {
        return settings[keyOrKeys];
    } else {
        return settings;
    }
}

async function set(context, data) {
    shares.enforceGlobalPermission(context, 'manageSettings');

    for (const key in data) {
        if (allowedKeys.has(key)) {
            const value = data[key];
            try {
                await knex('settings').insert({key, value});
            } catch (err) {
                await knex('settings').where('key', key).update('value', value);
            }
        }
    }

    // FIXME - recreate mailers, notify senders to recreate the mailers
}

export { hash };
export { get };
export { set };

export default {
    get,
    hash,
    set
};
