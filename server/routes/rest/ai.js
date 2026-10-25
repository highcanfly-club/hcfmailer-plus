import passport from '../../lib/passport.js';
import routerFactory from '../../lib/router-async.js';
import { castToInteger, enforce } from '../../lib/helpers.js';
import interoperableErrors from '../../../shared/interoperable-errors.js';
import aiModels from '../../models/ai.js';
import templates from '../../models/templates.js';
import campaigns from '../../models/campaigns.js';
import { isConfigured } from '../../lib/ai/crypto.js';
import { PROTOCOLS, DEFAULT_BASE_URLS, ProviderError } from '../../lib/ai/providers.js';
import { correct, rewrite, generate, resolveTier, callModel } from '../../lib/ai/features.js';
import * as cheerio from 'cheerio';

const router = routerFactory.create();

const EDITOR_TYPES = ['ckeditor', 'ckeditor5', 'grapesjs', 'emailbuilder'];
const MAX_REFERENCES = 3;
const REFERENCE_CHARS = 4000;

// Plain per-user limiter: 30 AI requests per minute is far above any human use and protects the provider quota
const hits = new Map();
function rateLimit(userId) {
    const now = Date.now();
    const recent = (hits.get(userId) || []).filter(t => now - t < 60000);
    if (recent.length >= 30) {
        throw new interoperableErrors.PermissionDeniedError('Too many AI requests, try again in a minute');
    }
    recent.push(now);
    hits.set(userId, recent);
}

function sendError(res, err) {
    if (err instanceof ProviderError) {
        return res.status(502).json({ message: err.message });
    }
    throw err;
}

router.getAsync('/ai/status', passport.loggedIn, async (req, res) => {
    return res.json(await aiModels.getStatus(req.user.id));
});

router.getAsync('/ai/settings', passport.loggedIn, async (req, res) => {
    return res.json({
        configured: isConfigured(),
        protocols: PROTOCOLS,
        defaultBaseUrls: DEFAULT_BASE_URLS,
        models: await aiModels.getSettings(req.user.id)
    });
});

router.putAsync('/ai/settings/:tier', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    enforce(isConfigured(), 'AI is not enabled on this server');
    await aiModels.saveModel(req.user.id, req.params.tier, req.body);
    return res.json();
});

router.deleteAsync('/ai/settings/:tier', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await aiModels.removeModel(req.user.id, req.params.tier);
    return res.json();
});

router.postAsync('/ai/settings/:tier/keys', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    enforce(isConfigured(), 'AI is not enabled on this server');
    return res.json({ id: await aiModels.addKey(req.user.id, req.params.tier, req.body.label, req.body.apiKey) });
});

router.deleteAsync('/ai/keys/:keyId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await aiModels.removeKey(req.user.id, castToInteger(req.params.keyId));
    return res.json();
});

router.postAsync('/ai/settings/:tier/test', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    rateLimit(req.user.id);
    try {
        const reply = await callModel(req.user.id, req.params.tier, 'Réponds uniquement par le mot OK.', 'Test de connexion.');
        return res.json({ ok: true, reply: reply.slice(0, 100) });
    } catch (err) {
        if (err instanceof ProviderError) {
            return res.json({ ok: false, message: err.message });
        }
        if (err instanceof interoperableErrors.NotFoundError) {
            return res.json({ ok: false, message: 'No model or no key configured for this tier' });
        }
        throw err;
    }
});

function checkContent(body) {
    enforce(EDITOR_TYPES.includes(body.editorType), 'Unsupported editor');
    enforce(typeof body.source === 'string', 'Content is missing');
}

async function withTier(req, res, action, handler) {
    rateLimit(req.user.id);
    checkContent(req.body);
    const tier = await resolveTier(req.user.id, action, req.body.tier);
    if (!tier) {
        return res.status(400).json({ message: 'No AI model configured' });
    }
    try {
        return res.json(await handler(tier));
    } catch (err) {
        return sendError(res, err);
    }
}

router.postAsync('/ai/correct', passport.loggedIn, passport.csrfProtection, (req, res) =>
    withTier(req, res, 'correct', tier => correct(req.user.id, { tier, editorType: req.body.editorType, source: req.body.source })));

router.postAsync('/ai/rewrite', passport.loggedIn, passport.csrfProtection, (req, res) => {
    enforce(typeof req.body.instruction === 'string' && req.body.instruction.trim() && req.body.instruction.length <= 2000, 'Instruction required');
    return withTier(req, res, 'rewrite', tier => rewrite(req.user.id, { tier, editorType: req.body.editorType, source: req.body.source, options: { instruction: req.body.instruction.trim() } }));
});

// Past newsletters used as style references. Reads go through the regular model layer with the user's own context,
// so the existing namespace permissions apply: a campaign admin only reaches the namespaces they are allowed to see.
async function referenceTexts(context, references) {
    const result = [];
    for (const ref of (Array.isArray(references) ? references : []).slice(0, MAX_REFERENCES)) {
        const id = castToInteger(ref.id);
        let name;
        let html;
        if (ref.type === 'template') {
            const tmpl = await templates.getById(context, id, false);
            name = tmpl.name;
            html = tmpl.html || '';
        } else if (ref.type === 'campaign') {
            const campaign = await campaigns.getById(context, id, false);
            name = campaign.name;
            html = (campaign.data && campaign.data.sourceCustom && campaign.data.sourceCustom.html) || '';
        } else {
            continue;
        }
        const text = cheerio.load(html).root().find('body, :root').first().text().replace(/\s+/g, ' ').trim().slice(0, REFERENCE_CHARS);
        if (text) result.push({ name, text });
    }
    return result;
}

router.postAsync('/ai/generate', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    enforce(typeof req.body.brief === 'string' && req.body.brief.trim() && req.body.brief.length <= 5000, 'Brief required');
    const references = await referenceTexts(req.context, req.body.references);
    const brand = typeof req.body.brand === 'string' ? req.body.brand.slice(0, 2000) : '';
    return withTier(req, res, 'generate', tier => generate(req.user.id, {
        tier,
        editorType: req.body.editorType,
        source: req.body.source,
        options: { brief: req.body.brief.trim(), references, brand }
    }));
});

// Candidates for the "style references" picker: only what the user is allowed to view
router.getAsync('/ai/references', passport.loggedIn, async (req, res) => {
    const params = { draw: 1, start: 0, length: 100, search: { value: '' }, order: [{ column: 1, dir: 'asc' }], columns: [{ data: 0 }, { data: 1 }] };
    const [tmpl, camp] = await Promise.all([templates.listDTAjax(req.context, params), campaigns.listDTAjax(req.context, params)]);
    return res.json({
        templates: tmpl.data.map(r => ({ id: r[0], name: r[1] })),
        campaigns: camp.data.map(r => ({ id: r[0], name: r[1] }))
    });
});

export default router;
