import config from './config.js';
import log from 'npmlog';

log.level = config.log.level;

export default log;
