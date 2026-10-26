// Streaming of the answer and reasoning of the model, abort, and the debug trace. Local mock providers speaking SSE.
import http from 'http';
import { expect } from 'chai';

process.env.AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || 'test-secret';
process.env.AI_ALLOW_PRIVATE_HOSTS = '1';

const { complete, ProviderError } = await import('../../lib/ai/providers.js');
const { default: aiModels } = await import('../../models/ai.js');
const { callModel, correct } = await import('../../lib/ai/features.js');
const { newMeter } = await import('../../lib/ai/session.js');

const USER = 5;
let server;
let base;
let mode = 'openai';
let hits = 0;

const sse = (res, events) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const [event, data] of events) res.write(`${event ? `event: ${event}\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
    res.end();
};

const FORMATS = {
    openai: res => sse(res, [
        [null, { choices: [{ delta: { reasoning_content: 'Je réfléchis' } }] }],
        [null, { choices: [{ delta: { reasoning: ' encore' } }] }],
        [null, { choices: [{ delta: { content: 'Bon' } }] }],
        [null, { choices: [{ delta: { content: 'jour' } }] }],
        [null, { choices: [], usage: { prompt_tokens: 12, completion_tokens: 7 } }],
        [null, '[DONE]']
    ]),
    anthropic: res => sse(res, [
        ['message_start', { type: 'message_start', message: { usage: { input_tokens: 12 } } }],
        ['content_block_delta', { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Je réfléchis' } }],
        ['content_block_delta', { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Bon' } }],
        ['content_block_delta', { type: 'content_block_delta', delta: { type: 'text_delta', text: 'jour' } }],
        ['message_delta', { type: 'message_delta', usage: { output_tokens: 7 } }]
    ]),
    gemini: res => sse(res, [
        [null, { candidates: [{ content: { parts: [{ text: 'Je réfléchis', thought: true }] } }] }],
        [null, { candidates: [{ content: { parts: [{ text: 'Bon' }] } }] }],
        [null, { candidates: [{ content: { parts: [{ text: 'jour' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 2 } }]
    ]),
    cohere: res => sse(res, [
        ['content-delta', { type: 'content-delta', delta: { message: { content: { thinking: 'Je réfléchis' } } } }],
        ['content-delta', { type: 'content-delta', delta: { message: { content: { text: 'Bon' } } } }],
        ['content-delta', { type: 'content-delta', delta: { message: { content: { text: 'jour' } } } }],
        ['message-end', { type: 'message-end', delta: { usage: { tokens: { input_tokens: 12, output_tokens: 7 } } } }]
    ])
};

describe('AI streaming', () => {
    before(async () => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
                hits++;
                const payload = JSON.parse(body);
                if (mode === 'slow') { // never ends: the client has to abort
                    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Début' } }] })}\n\n`);
                    return;
                }
                if (mode === 'secret') {
                    return sse(res, [[null, { choices: [{ delta: { content: 'La clé est sk-abcdefghijklmnop1234 et Bearer abcdefghijklmnop1234' } }] }]]);
                }
                if (mode === 'failover') {
                    if (req.headers.authorization === 'Bearer key-bad-0001') {
                        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'partiel' } }] })}\n\n`);
                        res.write(`data: ${JSON.stringify({ error: { message: 'overloaded' } })}\n\n`);
                        return res.end();
                    }
                    return sse(res, [[null, { choices: [{ delta: { content: 'Bon' } }] }], [null, { choices: [{ delta: { content: 'jour' } }] }]]);
                }
                if (mode === 'fail') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: { message: 'bad key' } }));
                }
                if (!payload.stream && !req.url.includes('streamGenerateContent')) { // classic request
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ choices: [{ message: { content: 'Bonjour', reasoning_content: 'pensée' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }));
                }
                return FORMATS[mode](res);
            });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => server.close());

    const model = protocol => ({ protocol, base_url: base + (protocol === 'openai' ? '/v1' : ''), model: 'mock', temperature: null, max_tokens: null });

    for (const protocol of ['openai', 'anthropic', 'gemini', 'cohere']) {
        it(`reads the reasoning, the text and the usage of a ${protocol} stream`, async () => {
            mode = protocol;
            const text = [];
            const reasoning = [];
            const out = await complete(model(protocol), 'k', { system: 's', user: 'u' }, { onText: d => text.push(d), onReasoning: d => reasoning.push(d) });
            expect(out.text).to.equal('Bonjour');
            expect(text.join('')).to.equal('Bonjour');
            expect(text.length).to.be.greaterThan(1); // really incremental
            expect(reasoning.join('')).to.contain('Je réfléchis');
            expect(out.reasoning).to.contain('Je réfléchis');
            expect(out.usage).to.deep.equal({ input: 12, output: protocol === 'gemini' ? 7 : 7, estimated: false });
        });
    }

    it('still works without streaming, and returns the reasoning when the provider gives it', async () => {
        mode = 'openai';
        const out = await complete(model('openai'), 'k', { system: 's', user: 'u' });
        expect(out).to.deep.include({ text: 'Bonjour', reasoning: 'pensée' });
        expect(out.usage).to.deep.equal({ input: 3, output: 2, estimated: false });
    });

    it('reports an HTTP error of a stream like a classic one (key problem)', async () => {
        mode = 'fail';
        let error;
        try { await complete(model('openai'), 'k', { system: 's', user: 'u' }, { onText() {} }); } catch (err) { error = err; }
        expect(error).to.be.instanceOf(ProviderError);
        expect(error.keyProblem).to.equal(true);
    });

    it('aborts the call when the signal fires, and keeps the partial text', async () => {
        mode = 'slow';
        const ac = new AbortController();
        const seen = [];
        const promise = complete(model('openai'), 'k', { system: 's', user: 'u' }, { signal: ac.signal, onText: d => { seen.push(d); ac.abort(); } });
        let error;
        try { await promise; } catch (err) { error = err; }
        expect(error.aborted).to.equal(true);
        expect(error.retryable).to.equal(false); // another key must not be tried
        expect(error.partial.text).to.equal('Début');
    });

    describe('with the user\'s models', () => {
        before(async () => {
            await aiModels.saveModel(USER, 'basic', { protocol: 'openai', baseUrl: base + '/v1', model: 'mock', keyMode: 'failover', temperature: '', maxTokens: '' });
        });
        afterEach(async () => {
            const row = await (await import('../../lib/knex.js')).default('ai_models').where({ user: USER, tier: 'basic' }).first('id');
            if (row) await (await import('../../lib/knex.js')).default('ai_keys').where('model', row.id).del();
        });
        after(async () => { await aiModels.removeModel(USER, 'basic'); });

        it('emits live events and records a trace with prompts, reasoning, reply and usage', async () => {
            mode = 'openai';
            await aiModels.addKey(USER, 'basic', 'k', 'good-key-0001');
            const events = [];
            const meter = newMeter({ debug: true, onEvent: e => events.push(e) });
            const reply = await callModel(USER, 'basic', 'SYSTEM PROMPT', 'USER PROMPT', meter, 'write');
            expect(reply).to.equal('Bonjour');
            expect(events.map(e => e.type)).to.deep.equal(['call-start', 'reasoning', 'reasoning', 'text', 'text', 'call-end']);
            const trace = meter.trace();
            expect(trace.calls).to.have.length(1);
            expect(trace.calls[0]).to.deep.include({ purpose: 'write', system: 'SYSTEM PROMPT', user: 'USER PROMPT', reply: 'Bonjour', reasoning: 'Je réfléchis encore', protocol: 'openai', model: 'mock' });
            expect(trace.calls[0].usage).to.deep.equal({ input: 12, output: 7, estimated: false });
            expect(meter).to.include({ input: 12, output: 7 });
            expect(JSON.stringify(trace)).to.not.contain('good-key-0001');
        });

        it('has no trace unless debug is on', async () => {
            mode = 'openai';
            await aiModels.addKey(USER, 'basic', 'k', 'good-key-0001');
            const meter = newMeter();
            await callModel(USER, 'basic', 's', 'u', meter, 'write');
            expect(meter.trace()).to.equal(undefined);
        });

        it('restarts the live text on the next key when a stream breaks, and shows both attempts in the trace', async () => {
            mode = 'failover';
            await aiModels.addKey(USER, 'basic', 'bad', 'key-bad-0001');
            await aiModels.addKey(USER, 'basic', 'good', 'key-good-0001');
            const events = [];
            const meter = newMeter({ debug: true, onEvent: e => events.push(e) });
            expect(await callModel(USER, 'basic', 's', 'u', meter, 'write')).to.equal('Bonjour');
            expect(events.some(e => e.type === 'attempt' && e.n === 2)).to.equal(true);
            const call = meter.trace().calls[0];
            expect(call.reply).to.equal('Bonjour');
            expect(call.attempts.map(a => !!a.error)).to.deep.equal([true, false]);
        });

        it('scrubs anything that looks like a key from the trace', async () => {
            mode = 'secret';
            await aiModels.addKey(USER, 'basic', 'k', 'key-secret-0001');
            const meter = newMeter({ debug: true, onEvent() {} });
            await callModel(USER, 'basic', 'système avec key-secret-0001', 'u', meter, 'write');
            const text = JSON.stringify(meter.trace());
            expect(text).to.not.contain('sk-abcdefghijklmnop1234').and.to.not.contain('key-secret-0001').and.to.not.contain('Bearer abcdefghijklmnop1234');
            expect(text).to.contain('[key]');
        });

        it('bills an estimate of what was generated before the user pressed Stop', async () => {
            mode = 'slow';
            await aiModels.addKey(USER, 'basic', 'k', 'good-key-0001');
            const ac = new AbortController();
            const meter = newMeter({ signal: ac.signal, onEvent: e => { if (e.type === 'text') ac.abort(); } });
            let error;
            try { await callModel(USER, 'basic', 's', 'une question', meter, 'write'); } catch (err) { error = err; }
            expect(error.aborted).to.equal(true);
            expect(meter.estimated).to.equal(true);
            expect(meter.output).to.be.greaterThan(0);
            expect(meter.input).to.be.greaterThan(0);
        });

        it('records rejected replies as debug notes', async () => {
            mode = 'openai';
            await aiModels.addKey(USER, 'basic', 'k', 'good-key-0001');
            // the mock answers "Bonjour" (not JSON): the failure is visible in the trace instead of being swallowed
            const meter = newMeter({ debug: true });
            let error;
            try { await correct(USER, { tier: 'basic', editorType: 'ckeditor5', source: '<p>Bonjor</p>', meter }); } catch (err) { error = err; }
            expect(error).to.be.instanceOf(Error);
            const trace = meter.trace();
            expect(trace.calls[0].reply).to.equal('Bonjour');
            expect(trace.notes.map(n => n.step)).to.include('write');
            expect(trace.calls[0].error).to.equal(null); // the call itself worked, the reply was unusable
        });
    });
});
