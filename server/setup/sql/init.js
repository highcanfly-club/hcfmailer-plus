import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dbcheck from '../../lib/dbcheck.js';
import log from 'npmlog';
import path from 'path';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

log.level = 'verbose';

if (process.env.NODE_ENV === 'production') {
    log.error('sqlinit', 'This script does not run in production');
    process.exit(1);
}

if (process.env.NODE_ENV === 'test' && !fs.existsSync(path.join(__dirname, '..', '..', 'config', 'test.yaml'))) {
    log.error('sqlinit', 'This script only runs in test if config/test.yaml (i.e. a dedicated test database) is present');
    process.exit(1);
}

dbcheck(err => {
    if (err) {
        log.error('DB', err);
        return process.exit(1);
    }
    return process.exit(0);
});
