import passport from '../../lib/passport.js';
import routerFactory from '../../lib/router-async.js';
import config from '../../lib/config.js';
import { castToInteger, enforce } from '../../lib/helpers.js';
import interoperableErrors from '../../../shared/interoperable-errors.js';
import aiModels from '../../models/ai.js';
import aiBilling from '../../models/ai-billing.js';
import templates from '../../models/templates.js';
import campaigns from '../../models/campaigns.js';
import { isConfigured } from '../../lib/ai/crypto.js';
import { PROTOCOLS, DEFAULT_BASE_URLS, ProviderError } from '../../lib/ai/providers.js';
import { correct, rewrite, generate, responsive, resolveTier, callModel, newMeter } from '../../lib/ai/features.js';
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

const isGlobalAdmin = user => !!((config.roles.global[user.role] || {}).admin);

function requireAdmin(req, res, next) {
    if (!isGlobalAdmin(req.user)) {
        return res.status(403).json({ message: 'Administrator only' });
    }
    return next();
}

// Which AI serves this user: their own keys (BYOK) first; otherwise the administrator's shared AI, billed to the user once
// they accepted the offer ("offer" = available but not accepted yet); otherwise nothing.
async function getPlan(userId) {
    const own = await aiModels.getStatus(userId);
    if (own.enabled) {
        return { mode: 'byok', owner: userId, tiers: own.tiers };
    }
    const shared = await aiModels.getStatus(null);
    if (shared.enabled) {
        const prefs = await aiBilling.getPrefs(userId);
        return { mode: prefs.accepted ? 'shared' : 'offer', owner: null, tiers: shared.tiers };
    }
    return { mode: 'none', owner: userId, tiers: {} };
}

async function describeBilling(userId) {
    const [settings, balance] = await Promise.all([aiBilling.getSettings(), aiBilling.getBalance(userId)]);
    return { prices: { in: settings.priceIn, out: settings.priceOut, currency: settings.currency, maxOutstanding: settings.maxOutstanding }, balance };
}

router.getAsync('/ai/status', passport.loggedIn, async (req, res) => {
    const plan = await getPlan(req.user.id);
    const result = { enabled: plan.mode !== 'none', mode: plan.mode, tiers: plan.tiers };
    if (plan.mode === 'shared' || plan.mode === 'offer') {
        Object.assign(result, await describeBilling(req.user.id));
    }
    return res.json(result);
});

// --- the user's own models (BYOK) and the administrator's shared models share the same handlers -------------------------
function registerSettingsRoutes(base, getOwner, guards) {
    router.getAsync(`${base}/settings`, ...guards, async (req, res) => {
        return res.json({
            configured: isConfigured(),
            protocols: PROTOCOLS,
            defaultBaseUrls: DEFAULT_BASE_URLS,
            models: await aiModels.getSettings(getOwner(req))
        });
    });

    router.putAsync(`${base}/settings/:tier`, ...guards, passport.csrfProtection, async (req, res) => {
        enforce(isConfigured(), 'AI is not enabled on this server');
        await aiModels.saveModel(getOwner(req), req.params.tier, req.body);
        return res.json();
    });

    router.deleteAsync(`${base}/settings/:tier`, ...guards, passport.csrfProtection, async (req, res) => {
        await aiModels.removeModel(getOwner(req), req.params.tier);
        return res.json();
    });

    router.postAsync(`${base}/settings/:tier/keys`, ...guards, passport.csrfProtection, async (req, res) => {
        enforce(isConfigured(), 'AI is not enabled on this server');
        return res.json({ id: await aiModels.addKey(getOwner(req), req.params.tier, req.body.label, req.body.apiKey) });
    });

    router.deleteAsync(`${base}/keys/:keyId`, ...guards, passport.csrfProtection, async (req, res) => {
        await aiModels.removeKey(getOwner(req), castToInteger(req.params.keyId));
        return res.json();
    });

    router.postAsync(`${base}/settings/:tier/test`, ...guards, passport.csrfProtection, async (req, res) => {
        rateLimit(req.user.id);
        try {
            const reply = await callModel(getOwner(req), req.params.tier, 'Réponds uniquement par le mot OK.', 'Test de connexion.');
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
}

registerSettingsRoutes('/ai', req => req.user.id, [passport.loggedIn]);
registerSettingsRoutes('/ai/admin', () => null, [passport.loggedIn, requireAdmin]);

// --- shared AI: offer, consent, balance --------------------------------------------------------------------------------
router.postAsync('/ai/shared/accept', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    enforce((await aiModels.getStatus(null)).enabled, 'No shared AI is available');
    await aiBilling.setAccepted(req.user.id, true);
    return res.json();
});

router.postAsync('/ai/shared/decline', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await aiBilling.setAccepted(req.user.id, false);
    return res.json();
});

router.getAsync('/ai/billing', passport.loggedIn, async (req, res) => {
    const [billing, prefs, shared, usage, settlements] = await Promise.all([
        describeBilling(req.user.id),
        aiBilling.getPrefs(req.user.id),
        aiModels.getStatus(null),
        aiBilling.recentUsage(req.user.id),
        aiBilling.recentSettlements(req.user.id)
    ]);
    return res.json({ ...billing, accepted: prefs.accepted, sharedAvailable: shared.enabled, usage, settlements });
});

// --- administrator: prices, balances, settlement -----------------------------------------------------------------------
router.getAsync('/ai/admin/pricing', passport.loggedIn, requireAdmin, async (req, res) => {
    return res.json(await aiBilling.getSettings());
});

router.putAsync('/ai/admin/pricing', passport.loggedIn, requireAdmin, passport.csrfProtection, async (req, res) => {
    await aiBilling.saveSettings(req.body);
    return res.json();
});

router.getAsync('/ai/admin/billing', passport.loggedIn, requireAdmin, async (req, res) => {
    return res.json({ balances: await aiBilling.listBalances(), settlements: await aiBilling.listSettlements() });
});

router.postAsync('/ai/admin/billing/:userId/settle', passport.loggedIn, requireAdmin, passport.csrfProtection, async (req, res) => {
    return res.json(await aiBilling.settle(req.user.id, castToInteger(req.params.userId)));
});

// --- editor actions ------------------------------------------------------------------------------------------------------
function checkContent(body) {
    enforce(EDITOR_TYPES.includes(body.editorType), 'Unsupported editor');
    enforce(typeof body.source === 'string', 'Content is missing');
}

// Runs an action on behalf of the user with the AI that serves them, and bills the shared AI usage
async function withTier(req, res, action, handler) {
    rateLimit(req.user.id);
    checkContent(req.body);
    const plan = await getPlan(req.user.id);
    if (plan.mode === 'offer') {
        return res.status(402).json({ code: 'offer', message: 'The shared AI has to be accepted first' });
    }
    if (plan.mode === 'none') {
        return res.status(400).json({ message: 'No AI model configured' });
    }
    if (plan.mode === 'shared') {
        await aiBilling.assertWithinLimit(req.user.id);
    }
    const tier = await resolveTier(plan.owner, action, req.body.tier);
    if (!tier) {
        return res.status(400).json({ message: 'No AI model configured' });
    }
    const meter = newMeter();
    try {
        const result = await handler({ owner: plan.owner, tier, meter });
        if (plan.mode === 'shared') {
            Object.assign(result, await meteredBilling(req.user.id, action, tier, meter));
        }
        return res.json(result);
    } catch (err) {
        if (plan.mode === 'shared') {
            await meteredBilling(req.user.id, action, tier, meter); // tokens of failed attempts were consumed too
        }
        return sendError(res, err);
    }
}

async function meteredBilling(userId, action, tier, meter) {
    const costMicro = await aiBilling.recordUsage(userId, { action, tier, model: meter.model, input: meter.input, output: meter.output, estimated: meter.estimated });
    const balance = await aiBilling.getBalance(userId);
    return { billing: { costMicro: costMicro || 0, inputTokens: meter.input, outputTokens: meter.output, outstandingMicro: balance.outstandingMicro } };
}

router.postAsync('/ai/correct', passport.loggedIn, passport.csrfProtection, (req, res) =>
    withTier(req, res, 'correct', ({ owner, tier, meter }) => correct(owner, { tier, meter, editorType: req.body.editorType, source: req.body.source })));

router.postAsync('/ai/rewrite', passport.loggedIn, passport.csrfProtection, (req, res) => {
    enforce(typeof req.body.instruction === 'string' && req.body.instruction.trim() && req.body.instruction.length <= 2000, 'Instruction required');
    return withTier(req, res, 'rewrite', ({ owner, tier, meter }) => rewrite(owner, { tier, meter, editorType: req.body.editorType, source: req.body.source, options: { instruction: req.body.instruction.trim() } }));
});

router.postAsync('/ai/responsive', passport.loggedIn, passport.csrfProtection, (req, res) => {
    enforce(typeof req.body.instruction === 'string' && req.body.instruction.trim() && req.body.instruction.length <= 2000, 'Instruction required');
    enforce(['emailbuilder', 'grapesjs'].includes(req.body.editorType), 'Responsive adjustments are not available for this editor');
    return withTier(req, res, 'responsive', ({ owner, tier, meter }) => responsive(owner, {
        tier,
        meter,
        editorType: req.body.editorType,
        source: req.body.source,
        style: typeof req.body.style === 'string' ? req.body.style : '',
        instruction: req.body.instruction.trim()
    }));
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
    return withTier(req, res, 'generate', ({ owner, tier, meter }) => generate(owner, {
        tier,
        meter,
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
