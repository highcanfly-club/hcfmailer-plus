'use strict';

let config = require('./config');

config.mysql.charset="utf8mb4";
config.mysql.multipleStatements=true;


module.exports = {
    client: 'mysql2',
    connection: config.mysql
};
