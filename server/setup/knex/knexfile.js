import config from './config.js';

config.mysql.charset="utf8mb4";
config.mysql.multipleStatements=true;

export { client, connection };

export default {
    client,
    connection
};
