// HTTPS client for the user-supplied provider URLs. Since users can type any base URL, the server must not become an
// open proxy towards its own network (SSRF): the address is validated at connection time (DNS-rebinding safe),
// redirects are never followed, and only https is accepted (http only when AI_ALLOW_PRIVATE_HOSTS=1, e.g. local Ollama).
import https from 'https';
import http from 'http';
import dns from 'dns';
import ipaddr from 'ipaddr.js';
import config from '../config.js';

const allowPrivate = () => process.env.AI_ALLOW_PRIVATE_HOSTS === '1' || !!(config.ai && config.ai.allowPrivateHosts);
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function isPublicAddress(address) {
    let addr = ipaddr.parse(address);
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
        addr = addr.toIPv4Address();
    }
    return addr.range() === 'unicast'; // rejects loopback, private, linkLocal, carrierGradeNat, uniqueLocal, reserved, ...
}

function safeLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) {
            return callback(err);
        }
        if (!allowPrivate()) {
            const bad = addresses.find(a => !isPublicAddress(a.address));
            if (bad) {
                return callback(new Error(`Host ${hostname} resolves to a non-public address`));
            }
        }
        if (options && options.all) {
            return callback(null, addresses);
        }
        return callback(null, addresses[0].address, addresses[0].family);
    });
}

function validateUrl(urlString) {
    let url;
    try {
        url = new URL(urlString);
    } catch (err) {
        throw new Error('Invalid URL', { cause: err });
    }
    if (url.protocol !== 'https:' && !(allowPrivate() && url.protocol === 'http:')) {
        throw new Error('Only https URLs are accepted');
    }
    if (url.username || url.password) {
        throw new Error('Credentials in URL are not accepted');
    }
    // The lookup hook is not called for IP literals, so they are checked here
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    if (ipaddr.isValid(literal) && !allowPrivate() && !isPublicAddress(literal)) {
        throw new Error('Host is not a public address');
    }
    return url;
}

function postJson(urlString, { headers = {}, body, timeoutMs = 90000 }) {
    const url = validateUrl(urlString);
    const payload = JSON.stringify(body);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const req = transport.request(url, {
            method: 'POST',
            lookup: safeLookup,
            timeout: timeoutMs,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
        }, res => {
            const chunks = [];
            let size = 0;
            res.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_RESPONSE_BYTES) {
                    req.destroy(new Error('Response too large'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try { json = JSON.parse(text); } catch { /* not JSON */ }
                resolve({ status: res.statusCode, json, text });
            });
        });
        req.on('timeout', () => req.destroy(Object.assign(new Error('Provider timeout'), { code: 'ETIMEDOUT' })));
        req.on('error', reject);
        req.end(payload);
    });
}

// Streaming variant: for a 2xx response, `onEvent({ event, data })` is called for every server-sent event as it arrives
// (data is the raw text of the event); for any other status the body is collected like postJson does.
// `signal` (AbortSignal) closes the connection, which also stops the generation (and the billing) at the provider.
function postStream(urlString, { headers = {}, body, timeoutMs = 120000, maxMs = 15 * 60 * 1000, signal, onEvent }) {
    const url = validateUrl(urlString);
    const payload = JSON.stringify(body);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            return reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        }
        let finished = false;
        const done = (fn, value) => {
            if (finished) return;
            finished = true;
            clearTimeout(cap);
            if (signal) signal.removeEventListener('abort', onAbort);
            fn(value);
        };
        const req = transport.request(url, {
            method: 'POST',
            lookup: safeLookup,
            timeout: timeoutMs, // idle time between two chunks
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Content-Length': Buffer.byteLength(payload), ...headers }
        }, res => {
            const ok = res.statusCode >= 200 && res.statusCode < 300;
            const decoder = new TextDecoder();
            let buffer = '';
            const chunks = [];
            let size = 0;
            const flushEvents = final => {
                buffer = buffer.replace(/\r\n/g, '\n');
                let index;
                while ((index = buffer.indexOf('\n\n')) >= 0 || (final && buffer.trim())) {
                    const raw = index >= 0 ? buffer.slice(0, index) : buffer;
                    buffer = index >= 0 ? buffer.slice(index + 2) : '';
                    let event = 'message';
                    const data = [];
                    for (const line of raw.split('\n')) {
                        if (line.startsWith('event:')) event = line.slice(6).trim();
                        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
                    }
                    if (data.length) onEvent({ event, data: data.join('\n') });
                }
            };
            res.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_RESPONSE_BYTES * 4) {
                    req.destroy(new Error('Response too large'));
                    return;
                }
                if (ok) {
                    buffer += decoder.decode(chunk, { stream: true });
                    try { flushEvents(false); } catch (err) { req.destroy(err); }
                } else {
                    chunks.push(chunk);
                }
            });
            res.on('end', () => {
                if (!ok) {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let json = null;
                    try { json = JSON.parse(text); } catch { /* not JSON */ }
                    return done(resolve, { status: res.statusCode, json, text });
                }
                try { flushEvents(true); } catch (err) { return done(reject, err); }
                return done(resolve, { status: res.statusCode, json: null, text: '' });
            });
            res.on('error', err => done(reject, err));
        });
        const cap = setTimeout(() => req.destroy(new Error('Provider took too long')), maxMs);
        const onAbort = () => req.destroy(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (signal) signal.addEventListener('abort', onAbort);
        req.on('timeout', () => req.destroy(Object.assign(new Error('Provider timeout'), { code: 'ETIMEDOUT' })));
        req.on('error', err => done(reject, err));
        req.end(payload);
    });
}

export { postJson, postStream, validateUrl, isPublicAddress };
