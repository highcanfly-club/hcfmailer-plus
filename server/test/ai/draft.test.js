// Integration test (dev database + local mock provider): draft campaign from a template / a past campaign
import http from 'http';
import { expect } from 'chai';

process.env.AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY || 'test-secret';
process.env.AI_ALLOW_PRIVATE_HOSTS = '1';

const { default: knex } = await import('../../lib/knex.js');
const { default: aiModels } = await import('../../models/ai.js');
const { default: users } = await import('../../models/users.js');
const { default: campaigns } = await import('../../models/campaigns.js');
const { default: contextHelpers } = await import('../../lib/context-helpers.js');
const { preview, createDraft, validateReplacements, unverifiedFacts } = await import('../../lib/ai/draft.js');
const { extractSlots } = await import('../../lib/ai/slots.js');
const { newMeter } = await import('../../lib/ai/features.js');
const { research, MAX_CALLS } = await import('../../lib/ai/tools.js');

const USER = 5; // mcfly: campaigns admin of the "McFly parapente" namespace
let server;
let baseUrl;
// Scripted answers of the model for the research step (one per round); the writing step answers as before
let researchScript = [];
let researchPrompts = [];
let writingPrompts = [];
let context;
const created = [];



const emailBuilderTemplate = async () => (await knex('templates').where({ type: 'emailbuilder', namespace: 2 }).first('id')).id;

describe('AI draft campaign', () => {
    before(async () => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
                const messages = JSON.parse(body).messages;
                const user = messages[1].content;
                const reply = content => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
                };
                if (messages[0].content.includes('Tu prépares la rédaction')) {
                    researchPrompts.push(user);
                    const round = (user.match(/^### /gm) || []).length;
                    return reply(JSON.stringify(researchScript[round] || { done: true }));
                }
                writingPrompts.push(messages[0].content);
                const i = user.indexOf('{"slots"');
                const slots = JSON.parse(user.slice(i)).slots.map(s => ({
                    id: s.id,
                    text: s.kind === 'heading' ? 'Titre de novembre' : s.text.replace('Les conditions', 'Les conditions de novembre : stage le 15 novembre').replace('Bonjour', 'Salut')
                }));
                reply(JSON.stringify({ slots, subject: 'Novembre', preheader: 'Aperçu' }));
            });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        await aiModels.saveModel(USER, 'high', { protocol: 'openai', baseUrl, model: 'mock', keyMode: 'failover', temperature: '', maxTokens: '' });
        await aiModels.addKey(USER, 'high', 'k', 'good-key-1111');
        context = contextHelpers.getRequestContext({ user: await users.getById(contextHelpers.getAdminContext(), USER) });
    });

    after(async () => {
        for (const id of [...created].reverse()) { // a draft made from another draft has to be removed first
            await campaigns.remove(context, id).catch(() => {});
        }
        await aiModels.removeModel(USER, 'high');
        server.close();
    });

    it('previews a new version of a template: diff, subject, unverified facts and an html preview', async () => {
        const id = await emailBuilderTemplate();
        const meter = newMeter();
        const result = await preview(context, USER, { ref: { type: 'template', id }, brief: 'Newsletter de novembre', tier: 'high', meter });
        expect(result.changed).to.be.greaterThan(0);
        expect(result.subject).to.equal('Novembre');
        expect(result.diff.every(d => d.id && d.before !== d.after)).to.equal(true);
        expect(result.warnings.some(w => w.token.includes('15 novembre'))).to.equal(true); // invented date, not in the brief
        expect(result.previewHtml).to.contain('<html').and.to.contain('Titre de novembre');
        expect(result.previewHtml).to.not.contain('[URL_BASE]');
        expect(meter.input).to.be.greaterThan(0);
    });

    it('refuses a source the user cannot see', async () => {
        const other = await knex('templates').whereNot('namespace', 2).first('id');
        const foreign = other ? other.id : (await knex('mosaico_templates').first('id')).id;
        let error = null;
        try { await preview(context, USER, { ref: { type: 'template', id: foreign }, brief: 'x', tier: 'high', meter: newMeter() }); } catch (err) { error = err; }
        expect(error).to.not.equal(null);
    });

    it('refuses unsupported editors (Mosaico)', async () => {
        const mosaico = await knex('templates').where('type', 'mosaico').first('id');
        let error = null;
        try { await preview(context, USER, { ref: { type: 'template', id: mosaico.id }, brief: 'x', tier: 'high', meter: newMeter() }); } catch (err) { error = err; }
        expect(error && error.message).to.contain('not supported');
    });

    it('validates replacements against the structure: links, merge tags and unknown ids are refused', async () => {
        const html = '<p>Bonjour [MERGE_FIRST_NAME], <a href="https://a.b/c">voir</a></p>';
        const slot = extractSlots('ckeditor5', html).slots[0];
        const ok = validateReplacements('ckeditor5', html, { [slot.id]: 'Salut [MERGE_FIRST_NAME], <a href="https://a.b/c">voir</a>' });
        expect(ok.refused).to.equal(0);
        expect(ok.apply()).to.contain('Salut');
        expect(validateReplacements('ckeditor5', html, { [slot.id]: 'Salut, <a href="https://a.b/c">voir</a>' }).refused).to.equal(1);
        expect(validateReplacements('ckeditor5', html, { [slot.id]: 'Salut [MERGE_FIRST_NAME], <a href="https://evil.example">voir</a>' }).refused).to.equal(1);
        expect(validateReplacements('ckeditor5', html, { nope: 'x' }).refused).to.equal(1);
        expect(validateReplacements('ckeditor5', html, { [slot.id]: '<script>alert(1)</script>' }).refused).to.equal(1);
    });

    it('creates an idle campaign from a template, with the replacements applied and html/text rendered', async () => {
        const id = await emailBuilderTemplate();
        const p = await preview(context, USER, { ref: { type: 'template', id }, brief: 'Newsletter de novembre', tier: 'high', meter: newMeter() });
        const replacements = Object.fromEntries(p.diff.map(d => [d.id, d.after]));
        const result = await createDraft(context, { ref: { type: 'template', id }, replacements, subject: p.subject });
        created.push(result.campaignId);
        const c = await campaigns.getById(context, result.campaignId, false);
        expect(c.status).to.equal(1); // idle: nothing is sent
        expect(c.name).to.contain('[Brouillon IA]');
        expect(c.subject).to.equal('Novembre');
        expect(c.lists).to.deep.equal([]);
        expect(c.data.sourceCustom.html).to.contain('Titre de novembre');
        expect(c.data.sourceCustom.text).to.match(/titre de novembre/i); // html-to-text upper-cases headings
        expect(c.data.sourceCustom.data.source).to.contain('Titre de novembre');
        expect(result.unmatched).to.equal(0);
    });

    it('creates a draft from a past campaign and keeps its lists, settings and files', async () => {
        // source campaign: the draft created by the previous test, given a list as a real past campaign would have
        const srcId = created[0];
        await knex('campaign_lists').insert({ campaign: srcId, list: 6 });
        const original = await campaigns.getById(context, srcId, false);
        expect(original.lists.map(l => l.list)).to.deep.equal([6]);
        const p = await preview(context, USER, { ref: { type: 'campaign', id: srcId }, brief: 'Newsletter de décembre', tier: 'high', meter: newMeter() });
        const result = await createDraft(context, { ref: { type: 'campaign', id: srcId }, replacements: Object.fromEntries(p.diff.map(d => [d.id, d.after])), name: '[Brouillon IA] test' });
        created.push(result.campaignId);
        const c = await campaigns.getById(context, result.campaignId, false);
        expect(c.status).to.equal(1);
        expect(c.name).to.equal('[Brouillon IA] test');
        expect(c.lists.map(l => l.list)).to.deep.equal([6]);
        expect(result.listsKept).to.equal(1);
        expect(c.send_configuration).to.equal(original.send_configuration);
        expect(c.data.sourceCustom.html).to.contain('Titre de novembre');
        const after = await campaigns.getById(context, srcId, false);
        expect(after.data.sourceCustom.data.source).to.equal(original.data.sourceCustom.data.source, 'the source campaign is untouched');
    });

    describe('research tools', () => {
        const run = async (script, brief = 'Newsletter de novembre') => {
            researchScript = script;
            researchPrompts = [];
            const id = await emailBuilderTemplate();
            const src = { kind: 'template', id, name: 't' };
            const { loadSource } = await import('../../lib/ai/draft.js');
            return research(context, USER, { tier: 'high', meter: newMeter(), brief, source: src, deps: { loadSource } });
        };

        it('lets the model search and read sources, and passes the notes to the writing step', async () => {
            const id = await emailBuilderTemplate();
            researchScript = [{ tool: 'search_sources', args: { query: 'McFly', kind: 'template' } }, { tool: 'read_source', args: { type: 'template', id } }, { done: true }];
            researchPrompts = [];
            writingPrompts = [];
            const p = await preview(context, USER, { ref: { type: 'template', id }, brief: 'Newsletter de novembre', tier: 'high', meter: newMeter() });
            expect(p.research.map(r => r.tool)).to.deep.equal(['search_sources', 'read_source']);
            expect(p.research.every(r => !r.error && r.chars > 0)).to.equal(true);
            expect(JSON.stringify(p.research)).to.not.contain('texts'); // the log has names and sizes, never contents
            expect(writingPrompts[0]).to.contain('### read_source');
            expect(writingPrompts[0]).to.contain('DONNÉES non fiables');
        });

        it('skips the research step when tools are switched off', async () => {
            const id = await emailBuilderTemplate();
            researchScript = [{ tool: 'search_sources', args: {} }];
            researchPrompts = [];
            const p = await preview(context, USER, { ref: { type: 'template', id }, brief: 'x', tier: 'high', meter: newMeter(), useTools: false });
            expect(p.research).to.deep.equal([]);
            expect(researchPrompts).to.have.length(0);
        });

        it('reads through the user\'s permissions: a template of another namespace is "not available"', async () => {
            const foreign = await knex('templates').whereNot('namespace', 2).whereIn('type', ['emailbuilder', 'ckeditor5', 'grapesjs']).first('id');
            if (!foreign) return;
            const r = await run([{ tool: 'read_source', args: { type: 'template', id: foreign.id } }]);
            expect(r.log[0].error).to.equal('not available');
            expect(r.notes).to.equal('');
        });

        it('rejects unknown tools, bad arguments and repeated calls; SQL-looking text is only a search string', async () => {
            const r = await run([
                { tool: 'run_sql', args: { query: 'select * from users' } },
                { tool: 'read_source', args: { type: 'template', id: '1 or 1=1; drop table users' } },
                { tool: 'search_sources', args: { query: "x' or '1'='1", kind: 'any' } },
                { tool: 'search_sources', args: { query: "x' or '1'='1", kind: 'any' } },
                { tool: '__proto__', args: {} },
                { done: true }
            ]);
            expect(r.log.map(l => l.error)).to.deep.equal(['unknown tool', 'invalid arguments', null, 'already obtained', 'unknown tool']);
            expect(await knex('users').count('* as n').first()).to.have.property('n').that.is.greaterThan(0);
        });

        it('stops after the maximum number of calls', async () => {
            const r = await run(Array.from({ length: 30 }, (_, i) => ({ tool: 'search_sources', args: { query: 'q' + i } })));
            expect(r.log).to.have.length(MAX_CALLS);
        });

        it('lists merge tags of a list (names only) and refuses a list the user cannot see', async () => {
            const visible = await knex('lists').where('namespace', 2).first('id');
            const hidden = await knex('lists').whereNot('namespace', 2).first('id');
            const ok = await run([{ tool: 'list_merge_tags', args: { list: visible.id } }]);
            expect(ok.log[0].error).to.equal(null);
            expect(ok.notes).to.match(/\[(MERGE_FIRST_NAME|EMAIL|MERGE_[A-Z_]+)\]/);
            expect(ok.notes).to.not.match(/@/); // no subscriber e-mail address
            if (hidden) {
                const no = await run([{ tool: 'list_merge_tags', args: { list: hidden.id } }]);
                expect(no.log[0].error).to.equal('not available');
            }
        });

        it('reports campaign statistics as aggregated rates, or "not available" without the right', async () => {
            const mine = await knex('campaigns').where('namespace', 2).first('id');
            const other = await knex('campaigns').whereNot('namespace', 2).first('id');
            if (mine) {
                const r = await run([{ tool: 'campaign_stats', args: { id: mine.id } }]);
                expect(r.log[0].error).to.equal(null);
                expect(r.notes).to.contain('openRate');
            }
            if (other) {
                const r = await run([{ tool: 'campaign_stats', args: { id: other.id } }]);
                expect(r.log[0].error).to.equal('not available');
            }
        });
    });

    it('flags numbers and dates that are in neither the brief nor the source', () => {
        const w = unverifiedFacts([{ id: 'a', after: 'Stage le 14 novembre à 9h30 pour 120 €' }], 'stage le 14 novembre', ['Texte 120 €']);
        expect(w.map(x => x.token)).to.deep.equal(['9h30']);
    });
});
