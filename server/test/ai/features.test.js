// Integration test against the dev database (needs the dev stack: `bun run dev:infra`) and a local mock provider.
// Run:  set -a && source .env.dev && set +a && NODE_ENV=development AI_ENCRYPTION_KEY=test-secret AI_ALLOW_PRIVATE_HOSTS=1 (cd server && npx mocha --exit test/ai/features.test.js)
import http from 'http';
import { expect } from 'chai';

process.env.AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || 'test-secret';
process.env.AI_ALLOW_PRIVATE_HOSTS = '1';

const { default: knex } = await import('../../lib/knex.js');
const { default: aiModels } = await import('../../models/ai.js');
const { correct, generate } = await import('../../lib/ai/features.js');

const USER = 5;
let server;
let baseUrl;
const seenKeys = [];

// A fake OpenAI-compatible provider: "bad-key" is refused, otherwise it upper-cases the "Bonjor" typo fix and echoes slots



const settings = (keyMode) => ({ protocol: 'openai', baseUrl, model: 'mock', keyMode, temperature: '', maxTokens: '' });

describe('AI features', () => {
    before(async () => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
                const key = (req.headers.authorization || '').replace('Bearer ', '');
                seenKeys.push(key);
                if (key === 'bad-key-0000') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: { message: 'invalid key' } }));
                }
                const payload = JSON.parse(body);
                const user = payload.messages[1].content;
                const wantsSubject = payload.messages[0].content.includes('"subject"');
                const input = JSON.parse(user.slice(user.indexOf('{"slots"')));
                const slots = input.slots.map(s => ({ id: s.id, text: s.text.replace('Bonjor', 'Bonjour').replace('Texte', 'Nouveau texte') }));
                const content = JSON.stringify({ slots, ...(wantsSubject ? { subject: 'Objet généré', preheader: 'Aperçu' } : {}) });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + content + '\n```' } }] }));
            });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    });

    afterEach(async () => {
        await aiModels.removeModel(USER, 'basic');
        await aiModels.removeModel(USER, 'high');
        seenKeys.length = 0;
    });

    after(async () => {
        server.close();
    });

    it('is disabled until a model has a key', async () => {
        expect((await aiModels.getStatus(USER)).enabled).to.equal(false);
        await aiModels.saveModel(USER, 'basic', settings('failover'));
        expect((await aiModels.getStatus(USER)).enabled).to.equal(false);
        await aiModels.addKey(USER, 'basic', 'k1', 'good-key-1111');
        expect((await aiModels.getStatus(USER)).tiers).to.deep.equal({ basic: true });
    });

    it('never exposes the stored keys', async () => {
        await aiModels.saveModel(USER, 'basic', settings('failover'));
        await aiModels.addKey(USER, 'basic', 'k1', 'good-key-1111');
        const dump = JSON.stringify(await aiModels.getSettings(USER));
        expect(dump).to.not.contain('good-key-1111');
        expect(dump).to.contain('"last4":"1111"');
        const [{ secret }] = await knex('ai_keys').select('secret');
        expect(secret).to.not.contain('good-key');
        const rows = await knex('ai_keys').select('secret');
        expect(rows.every(r => r.secret.split('.').length === 3)).to.equal(true);
    });

    it('fails over to the next key and corrects text without touching tags or merge tags', async () => {
        await aiModels.saveModel(USER, 'basic', settings('failover'));
        await aiModels.addKey(USER, 'basic', 'bad', 'bad-key-0000');
        await aiModels.addKey(USER, 'basic', 'good', 'good-key-1111');
        const html = '<p style="x">Bonjor [MERGE_FIRST_NAME], <a href="https://a.b/c">voir</a></p><div data-ai-lock="1"><p>Bonjor légal</p></div>';
        const result = await correct(USER, { tier: 'basic', editorType: 'ckeditor5', source: html });
        expect(result.changed).to.equal(1);
        expect(result.source).to.contain('Bonjour [MERGE_FIRST_NAME], <a href="https://a.b/c">voir</a>').and.to.contain('Bonjor légal');
        expect(seenKeys).to.deep.equal(['bad-key-0000', 'good-key-1111']);
    });

    it('sets embedded data: images aside, so large images do not matter, and restores them', async () => {
        await aiModels.saveModel(USER, 'basic', settings('failover'));
        await aiModels.addKey(USER, 'basic', 'k', 'good-key-1111');
        const bigImage = 'data:image/png;base64,' + 'A'.repeat(400000);
        const html = `<p>Bonjor</p><img src="${bigImage}">`;
        const result = await correct(USER, { tier: 'basic', editorType: 'ckeditor5', source: html });
        expect(result.source).to.contain('Bonjour').and.to.contain(bigImage);
    });

    it('alternates keys in round-robin mode', async () => {
        await aiModels.saveModel(USER, 'basic', settings('roundrobin'));
        await aiModels.addKey(USER, 'basic', 'a', 'good-key-aaaa');
        await aiModels.addKey(USER, 'basic', 'b', 'good-key-bbbb');
        for (let i = 0; i < 4; i++) {
            await correct(USER, { tier: 'basic', editorType: 'ckeditor5', source: '<p>Bonjor</p>' });
        }
        expect(seenKeys).to.deep.equal(['good-key-aaaa', 'good-key-bbbb', 'good-key-aaaa', 'good-key-bbbb']);
    });

    it('generates from an empty Email Builder document using the skeleton and returns a subject', async () => {
        await aiModels.saveModel(USER, 'high', settings('failover'));
        await aiModels.addKey(USER, 'high', 'k', 'good-key-1111');
        const result = await generate(USER, { tier: 'high', editorType: 'emailbuilder', source: JSON.stringify({ root: { type: 'EmailLayout', data: { childrenIds: [] } } }), options: { brief: 'Newsletter de test', references: [], brand: '' } });
        expect(result.subject).to.equal('Objet généré');
        const doc = JSON.parse(result.source);
        expect(doc.t1.data.props.text).to.equal('Nouveau texte du premier sujet.');
        expect(result.source).to.contain('[LINK_UNSUBSCRIBE]');
    });
});
