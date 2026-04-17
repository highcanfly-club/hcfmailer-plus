import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from '../../lib/config.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.NODE_CONFIG_DIR) {
    process.env.NODE_CONFIG_DIR = __dirname + '/../../config';
}

export default config;
