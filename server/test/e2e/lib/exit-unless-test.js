import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from './config.js';
import log from 'npmlog';
import path from 'path';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.env.NODE_ENV !== 'test' || !fs.existsSync(path.join(__dirname, '..', '..', '..', 'config', 'test.yaml'))) {
    log.error('e2e', 'This script only runs in test and config/test.yaml (i.e. a dedicated test database) is present');
    process.exit(1);
}

if (config.app.testServer.enabled !== true) {
    log.error('e2e', 'This script only runs if the testServer is enabled. Check config/test.yaml');
    process.exit(1);
}

