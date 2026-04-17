import { AppType } from '../shared/app.js';
import { uploadedFilesDir } from './lib/file-helpers.js';
import { reportFilesDir } from './lib/report-helpers.js';
import { filesDir } from './models/files.js';
import config from './lib/config.js';
import log from './lib/log.js';
import appBuilder from './app-builder.js';
import translate from './lib/translate.js';
import http from 'http';
import triggers from './services/triggers.js';
import gdprCleanup from './services/gdpr-cleanup.js';
import importer from './lib/importer.js';
import feedcheck from './lib/feedcheck.js';
import verpServer from './services/verp-server.js';
import testServer from './services/test-server.js';
import postfixBounceServer from './services/postfix-bounce-server.js';
import tzupdate from './services/tzupdate.js';
import dbcheck from './lib/dbcheck.js';
import senders from './lib/senders.js';
import reportProcessor from './lib/report-processor.js';
import executor from './lib/executor.js';
import privilegeHelpers from './lib/privilege-helpers.js';
import knex from './lib/knex.js';
import bluebird from 'bluebird';
import shares from './models/shares.js';
import builtinZoneMta from './lib/builtin-zone-mta.js';
import klawSync from 'klaw-sync';

const trustedPort = config.www.trustedPort;
const sandboxPort = config.www.sandboxPort;
const publicPort = config.www.publicPort;
const host = config.www.host;

if (config.title) {
    process.title = config.title;
}

async function startHTTPServer(appType, appName, port) {
    const app = await appBuilder.createApp(appType);
    app.set('port', port);

    const server = http.createServer(app);

    server.on('error', err => {
        if (err.syscall !== 'listen') {
            throw err;
        }

        const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (err.code) {
            case 'EACCES':
                log.error('Express', '%s requires elevated privileges', bind);
                return process.exit(1);
            case 'EADDRINUSE':
                log.error('Express', '%s is already in use', bind);
                return process.exit(1);
            default:
                throw err;
        }
    });

    server.on('listening', () => {
        const addr = server.address();
        const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        log.info('Express', 'WWW server [%s] listening on %s', appName, bind);
    });

    const serverListenAsync = bluebird.promisify(server.listen.bind(server));
    await serverListenAsync({port, host});
}

// ---------------------------------------------------------------------------------------
// Start the whole circus
// ---------------------------------------------------------------------------------------
async function init() {
    await dbcheck();

    await knex.migrate.latest(); // And now the current migration with Knex

    await shares.regenerateRoleNamesTable();
    await shares.rebuildPermissions();

    await privilegeHelpers.ensureMailtrainDir(filesDir);

    // Update owner of all files under 'files' dir. This should not be necessary, but when files are copied over,
    // the ownership needs to be fixed.
    for (const dirEnt of klawSync(filesDir, {})) {
        await privilegeHelpers.ensureMailtrainOwner(dirEnt.path);
    }

    await privilegeHelpers.ensureMailtrainDir(uploadedFilesDir);
    await privilegeHelpers.ensureMailtrainDir(reportFilesDir);

    await executor.spawn();
    await testServer.start();
    await verpServer.start();
    await builtinZoneMta.spawn();

    await startHTTPServer(AppType.TRUSTED, 'trusted', trustedPort);
    await startHTTPServer(AppType.SANDBOXED, 'sandbox', sandboxPort);
    await startHTTPServer(AppType.PUBLIC, 'public', publicPort);

    privilegeHelpers.dropRootPrivileges();

    tzupdate.start();

    await importer.spawn();
    await feedcheck.spawn();
    await senders.spawn();

    triggers.start();
    gdprCleanup.start();

    await postfixBounceServer.start();

    await reportProcessor.init();

    log.info('Service', 'All services started');
    appBuilder.setReady();
}

init().catch(err => {log.error('', err); process.exit(1); });

