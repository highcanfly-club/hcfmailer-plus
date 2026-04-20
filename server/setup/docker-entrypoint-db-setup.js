import { getAdminId } from '../../shared/users.js';
import log from '../lib/log.js';
import dbcheck from '../lib/dbcheck.js';
import knex from '../lib/knex.js';
import bcrypt from 'bcryptjs';

const bcryptHash = password => new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (err, hash) => err ? reject(err) : resolve(hash));
});

async function init() {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        log.error('Usage: NODE_ENV=production node setup/docker-entrypoint-db-setup.js <admin password> <admin access token>')
        return;
    }

    const passwd = args[0];
    const accessToken = args[1];

    await dbcheck();
    await knex.migrate.latest();

    const hashedPasswd = await bcryptHash(passwd);
    await knex('users').where({id: getAdminId()}).update({password: hashedPasswd});

    if (accessToken !== '') {
        await knex('users').where({id: getAdminId()}).update({access_token: accessToken});
    }

    process.exit(0);
}

init().catch(err => {log.error('', err); process.exit(1); });

