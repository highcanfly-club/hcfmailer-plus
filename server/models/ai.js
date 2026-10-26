// AI settings of an owner: a user id (BYOK) or null (the administrator's shared AI, billed to the users).
// Keys are stored encrypted and only ever leave this module as plain text towards providers.
import knex from '../lib/knex.js';
import { enforce } from '../lib/helpers.js';
import interoperableErrors from '../../shared/interoperable-errors.js';
import { encrypt, decrypt, isConfigured } from '../lib/ai/crypto.js';
import { validateUrl } from '../lib/ai/http.js';
import { PROTOCOLS } from '../lib/ai/providers.js';
import { ProviderError } from '../lib/ai/providers.js';

const TIERS = ['basic', 'medium', 'high'];
const KEY_MODES = ['failover', 'roundrobin'];
const COOLDOWN_SECONDS = { keyProblem: 3600, rateLimited: 60, transient: 30 };

const byOwner = (query, owner, column = 'ai_models.user') => (owner === null ? query.whereNull(column) : query.where(column, owner));

function publicModel(row, keys) {
    return {
        id: row.id,
        tier: row.tier,
        protocol: row.protocol,
        baseUrl: row.base_url,
        model: row.model,
        keyMode: row.key_mode,
        temperature: row.temperature,
        maxTokens: row.max_tokens,
        keys: keys.map(k => ({ id: k.id, label: k.label, last4: k.last4, cooling: !!(k.cooldown_until && new Date(k.cooldown_until) > new Date()), uses: k.uses, failures: k.failures }))
    };
}

async function getSettings(owner) {
    const models = await byOwner(knex('ai_models'), owner);
    const keys = models.length ? await knex('ai_keys').whereIn('model', models.map(m => m.id)).orderBy('position').orderBy('id') : [];
    const result = {};
    for (const tier of TIERS) {
        const row = models.find(m => m.tier === tier);
        result[tier] = row ? publicModel(row, keys.filter(k => k.model === row.id)) : null;
    }
    return result;
}

// What the editors need to know: AI is offered only when at least one model has at least one key
async function getStatus(owner) {
    if (!isConfigured()) {
        return { enabled: false, tiers: {} };
    }
    const rows = await byOwner(knex('ai_models').join('ai_keys', 'ai_keys.model', 'ai_models.id'), owner).distinct('ai_models.tier');
    const tiers = {};
    rows.forEach(r => { tiers[r.tier] = true; });
    return { enabled: rows.length > 0, tiers };
}

function validateModelInput(data) {
    enforce(PROTOCOLS.includes(data.protocol), 'Invalid protocol');
    enforce(KEY_MODES.includes(data.keyMode), 'Invalid key mode');
    enforce(typeof data.model === 'string' && data.model.trim().length > 0 && data.model.length <= 255, 'Model is required');
    validateUrl(data.baseUrl); // throws when invalid / not https
    if (data.temperature !== null && data.temperature !== undefined && data.temperature !== '') {
        enforce(Number(data.temperature) >= 0 && Number(data.temperature) <= 2, 'Temperature must be between 0 and 2');
    }
    if (data.maxTokens !== null && data.maxTokens !== undefined && data.maxTokens !== '') {
        enforce(Number.isInteger(Number(data.maxTokens)) && Number(data.maxTokens) >= 256 && Number(data.maxTokens) <= 200000, 'Max tokens must be between 256 and 200000');
    }
}

async function saveModel(owner, tier, data) {
    enforce(TIERS.includes(tier), 'Invalid tier');
    validateModelInput(data);
    const row = {
        protocol: data.protocol,
        base_url: data.baseUrl.trim().replace(/\/+$/, ''),
        model: data.model.trim(),
        key_mode: data.keyMode,
        temperature: data.temperature === '' || data.temperature === undefined ? null : data.temperature,
        max_tokens: data.maxTokens === '' || data.maxTokens === undefined ? null : data.maxTokens
    };
    const existing = await byOwner(knex('ai_models'), owner).where('tier', tier).first();
    if (existing) {
        await knex('ai_models').where('id', existing.id).update(row);
        return existing.id;
    }
    const [id] = await knex('ai_models').insert({ user: owner, tier, ...row });
    return id;
}

async function removeModel(owner, tier) {
    await byOwner(knex('ai_models'), owner).where('tier', tier).del(); // keys are removed by the foreign key cascade
}

async function addKey(owner, tier, label, apiKey) {
    enforce(typeof apiKey === 'string' && apiKey.trim().length >= 8 && apiKey.length <= 1000, 'Invalid API key');
    const model = await byOwner(knex('ai_models'), owner).where('tier', tier).first();
    if (!model) {
        throw new interoperableErrors.NotFoundError();
    }
    const count = (await knex('ai_keys').where('model', model.id).count({ c: '*' }).first()).c;
    const clean = apiKey.trim();
    const [id] = await knex('ai_keys').insert({
        model: model.id,
        label: (label || '').slice(0, 100),
        secret: encrypt(clean),
        last4: clean.slice(-4),
        position: Number(count)
    });
    return id;
}

async function removeKey(owner, keyId) {
    const key = await byOwner(knex('ai_keys').join('ai_models', 'ai_models.id', 'ai_keys.model').where('ai_keys.id', keyId), owner).first('ai_keys.id');
    if (!key) {
        throw new interoperableErrors.NotFoundError();
    }
    await knex('ai_keys').where('id', keyId).del();
}

// Picks the keys in the order they must be tried: round-robin rotates the starting point on every request,
// failover starts from the first key. Keys cooling down after an error go last.
async function orderedKeys(model) {
    const keys = await knex('ai_keys').where('model', model.id).orderBy('position').orderBy('id');
    if (keys.length === 0) {
        return [];
    }
    let ordered = keys;
    if (model.key_mode === 'roundrobin') {
        // atomic across pods: the counter lives in the database
        await knex('ai_models').where('id', model.id).increment('rr_counter', 1);
        const { rr_counter: counter } = await knex('ai_models').where('id', model.id).first('rr_counter');
        const start = (counter - 1) % keys.length;
        ordered = [...keys.slice(start), ...keys.slice(0, start)];
    }
    const now = new Date();
    const ready = ordered.filter(k => !k.cooldown_until || new Date(k.cooldown_until) <= now);
    const cooling = ordered.filter(k => k.cooldown_until && new Date(k.cooldown_until) > now);
    return [...ready, ...cooling];
}

async function markFailure(keyId, err) {
    const seconds = err.keyProblem ? COOLDOWN_SECONDS.keyProblem : (err.status === 429 ? COOLDOWN_SECONDS.rateLimited : COOLDOWN_SECONDS.transient);
    await knex('ai_keys').where('id', keyId).update({
        cooldown_until: new Date(Date.now() + seconds * 1000),
        failures: knex.raw('failures + 1')
    });
}

// Runs fn(model, plainKey) with the configured key strategy. Only errors flagged as retryable move on to the next key.
async function withKey(owner, tier, fn) {
    const model = await byOwner(knex('ai_models'), owner).where('tier', tier).first();
    if (!model) {
        throw new interoperableErrors.NotFoundError();
    }
    const keys = await orderedKeys(model);
    if (keys.length === 0) {
        throw new interoperableErrors.NotFoundError();
    }
    let lastError;
    for (const key of keys) {
        try {
            const result = await fn(model, decrypt(key.secret));
            await knex('ai_keys').where('id', key.id).update({ uses: knex.raw('uses + 1'), cooldown_until: null });
            return result;
        } catch (err) {
            lastError = err;
            if (err instanceof ProviderError && err.retryable) {
                await markFailure(key.id, err);
                continue; // failover and round-robin both fall through to the next key
            }
            throw err;
        }
    }
    throw lastError;
}

export default {
    TIERS,
    getSettings,
    getStatus,
    saveModel,
    removeModel,
    addKey,
    removeKey,
    withKey
};
