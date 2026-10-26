// Integration test (dev database + local mock provider), same setup as features.test.js
import http from 'http';
import { expect } from 'chai';

process.env.AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || 'test-secret';
process.env.AI_ALLOW_PRIVATE_HOSTS = '1';

const { default: knex } = await import('../../lib/knex.js');
const { default: aiModels } = await import('../../models/ai.js');
const { default: billing } = await import('../../models/ai-billing.js');
const { correct, callModel, newMeter } = await import('../../lib/ai/features.js');

const USER = 5;
const OTHER = 7;
let server;
let baseUrl;
let originalSettings;

before(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
            const payload = JSON.parse(body);
            const user = payload.messages[1].content;
            const i = user.indexOf('{"slots"');
            const content = i >= 0 ? JSON.stringify({ slots: JSON.parse(user.slice(i)).slots.map(s => ({ id: s.id, text: s.text.replace('Bonjor', 'Bonjour') })) }) : 'OK';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    originalSettings = await billing.getSettings();
    await billing.saveSettings({ priceIn: 10, priceOut: 4, maxOutstanding: 0 });
});

afterEach(async () => {
    await aiModels.removeModel(null, 'basic');
    await knex('ai_usage').whereIn('user', [USER, OTHER]).del();
    await knex('ai_settlements').whereIn('user', [USER, OTHER]).del();
    await knex('ai_user_prefs').whereIn('user', [USER, OTHER]).del();
});

after(async () => {
    await billing.saveSettings(originalSettings);
    server.close();
    await knex.destroy();
});

const shared = () => ({ protocol: 'openai', baseUrl, model: 'shared-mock', keyMode: 'failover', temperature: '', maxTokens: '' });

describe('AI shared offer and billing', () => {
    it('keeps the shared models apart from the users\' own models', async () => {
        await aiModels.saveModel(null, 'basic', shared());
        await aiModels.addKey(null, 'basic', 'admin key', 'admin-key-0001');
        expect((await aiModels.getStatus(null)).tiers).to.deep.equal({ basic: true });
        expect((await aiModels.getStatus(USER)).enabled).to.equal(false);
        expect(JSON.stringify(await aiModels.getSettings(null))).to.not.contain('admin-key-0001');
    });

    it('records the tokens reported by the provider and prices them per million tokens', async () => {
        await aiModels.saveModel(null, 'basic', shared());
        await aiModels.addKey(null, 'basic', 'k', 'admin-key-0001');
        const meter = newMeter();
        const result = await correct(null, { tier: 'basic', editorType: 'ckeditor5', source: '<p>Bonjor</p>', meter });
        expect(result.source).to.contain('Bonjour');
        expect(meter).to.include({ input: 1000, output: 500, estimated: false, model: 'shared-mock' });
        // 1000 x 10 EUR/M + 500 x 4 EUR/M = 0.012 EUR = 12000 micro-EUR
        const cost = await billing.recordUsage(USER, { action: 'correct', tier: 'basic', model: meter.model, input: meter.input, output: meter.output, estimated: false });
        expect(cost).to.equal(12000);
        const balance = await billing.getBalance(USER);
        expect(balance).to.include({ outstandingMicro: 12000, inputTokens: 1000, outputTokens: 500, requests: 1 });
    });

    it('sums several calls of one request, and sums per user', async () => {
        await billing.recordUsage(USER, { action: 'rewrite', tier: 'basic', model: 'm', input: 2000, output: 1000, estimated: false });
        await billing.recordUsage(USER, { action: 'correct', tier: 'basic', model: 'm', input: 100, output: 50, estimated: true });
        await billing.recordUsage(OTHER, { action: 'correct', tier: 'basic', model: 'm', input: 100, output: 50, estimated: false });
        expect((await billing.getBalance(USER)).outstandingMicro).to.equal(2000 * 10 + 1000 * 4 + 100 * 10 + 50 * 4);
        const rows = await billing.listBalances();
        expect(rows.filter(r => [USER, OTHER].includes(r.userId))).to.have.length(2);
    });

    it('settles a balance without losing the history, and starts again from zero', async () => {
        await billing.recordUsage(USER, { action: 'generate', tier: 'basic', model: 'm', input: 1000, output: 1000, estimated: false });
        await billing.recordUsage(OTHER, { action: 'generate', tier: 'basic', model: 'm', input: 1000, output: 1000, estimated: false });
        const done = await billing.settle(1, USER);
        expect(done.settledMicro).to.equal(14000);
        expect((await billing.getBalance(USER)).outstandingMicro).to.equal(0);
        expect((await billing.getBalance(OTHER)).outstandingMicro).to.equal(14000);
        expect(await knex('ai_usage').where('user', USER).count({ c: '*' }).first().then(r => Number(r.c))).to.equal(1);
        expect((await billing.recentSettlements(USER))[0].amountMicro).to.equal(14000);
        expect((await billing.settle(1, USER)).settledMicro).to.equal(0);
        await billing.recordUsage(USER, { action: 'generate', tier: 'basic', model: 'm', input: 100, output: 0, estimated: false });
        expect((await billing.getBalance(USER)).outstandingMicro).to.equal(1000);
    });

    it('refuses requests once the spending limit is reached', async () => {
        await billing.saveSettings({ priceIn: 10, priceOut: 4, maxOutstanding: 0.01 });
        await billing.assertWithinLimit(USER);
        await billing.recordUsage(USER, { action: 'correct', tier: 'basic', model: 'm', input: 1000, output: 0, estimated: false });
        let error = null;
        try { await billing.assertWithinLimit(USER); } catch (err) { error = err; }
        expect(error).to.not.equal(null);
        await billing.settle(1, USER);
        await billing.assertWithinLimit(USER);
    });

    it('tracks the user consent to the shared AI', async () => {
        expect((await billing.getPrefs(USER)).accepted).to.equal(false);
        await billing.setAccepted(USER, true);
        expect((await billing.getPrefs(USER)).accepted).to.equal(true);
        await billing.setAccepted(USER, false);
        expect((await billing.getPrefs(USER)).accepted).to.equal(false);
    });

    it('callModel returns only the text and accumulates the meter', async () => {
        await aiModels.saveModel(null, 'basic', shared());
        await aiModels.addKey(null, 'basic', 'k', 'admin-key-0001');
        const meter = newMeter();
        expect(await callModel(null, 'basic', 'sys', 'user', meter)).to.equal('OK');
        await callModel(null, 'basic', 'sys', 'user', meter);
        expect(meter.input).to.equal(2000);
    });
});
