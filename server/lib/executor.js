import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { fork } from './fork.js';
import log from './log.js';
import path from 'path';
import bluebird from 'bluebird';


const requestCallbacks = {};
let messageTid = 0;
let executorProcess;

function spawn(callback) {
    log.verbose('Executor', 'Spawning executor process');

    executorProcess = fork(path.join(__dirname, '..', 'services', 'executor.js'), [], {
        cwd: path.join(__dirname, '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    executorProcess.on('message', msg => {
        if (msg) {
            if (msg.type === 'process-started') {
                let requestCallback = requestCallbacks[msg.tid];
                if (requestCallback && requestCallback.startedCallback) {
                    requestCallback.startedCallback(msg.tid, );
                }

            } else if (msg.type === 'process-failed') {
                let requestCallback = requestCallbacks[msg.tid];
                if (requestCallback && requestCallback.failedCallback) {
                    requestCallback.failedCallback(msg.msg);
                }

                delete requestCallbacks[msg.tid];

            } else if (msg.type === 'process-finished') {
                let requestCallback = requestCallbacks[msg.tid];
                if (requestCallback && requestCallback.startedCallback) {
                    requestCallback.finishedCallback(msg.code, msg.signal);
                }

                delete requestCallbacks[msg.tid];

            } else if (msg.type === 'executor-started') {
                log.info('Executor', 'Executor process started.');
                return callback();
            }
        }
    });

    executorProcess.on('close', (code, signal) => {
        log.error('Executor', 'Executor process exited with code %s signal %s', code, signal);
    });
}

function start(type, data, startedCallback, finishedCallback, failedCallback) {
    requestCallbacks[messageTid] = {
        startedCallback,
        finishedCallback,
        failedCallback
    };

    executorProcess.send({
        type: 'start-' + type,
        data,
        tid: messageTid
    });

    messageTid++;
}

function stop(tid) {
    executorProcess.send({
        type: 'stop-process',
        tid
    });
}

const spawnAsync = bluebird.promisify(spawn);

export { spawnAsync as spawn, start, stop };

export default {
    spawn: spawnAsync,
    spawnAsync,
    start,
    stop
};
