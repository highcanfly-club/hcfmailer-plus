// Metering of the shared AI: prices, usage rows, balance ("encours") per user and settlement once a bill is paid.
// A settlement marks the user's open usage rows as settled and keeps a record of the amount; history is never deleted.
import knex from '../lib/knex.js';
import { enforce } from '../lib/helpers.js';
import interoperableErrors from '../../shared/interoperable-errors.js';

const toNumber = v => Number(v);

async function getSettings() {
    const row = await knex('ai_shared_settings').where('id', 1).first();
    return { priceIn: toNumber(row.price_in), priceOut: toNumber(row.price_out), currency: row.currency, maxOutstanding: toNumber(row.max_outstanding) };
}

async function saveSettings(data) {
    for (const field of ['priceIn', 'priceOut', 'maxOutstanding']) {
        enforce(typeof data[field] !== 'undefined' && data[field] !== '' && Number.isFinite(Number(data[field])) && Number(data[field]) >= 0 && Number(data[field]) <= 100000, `Invalid ${field}`);
    }
    await knex('ai_shared_settings').where('id', 1).update({ price_in: Number(data.priceIn), price_out: Number(data.priceOut), max_outstanding: Number(data.maxOutstanding) });
}

// Price per million tokens = micro-currency per token, so the cost of a request is an exact integer
function computeCostMicro(settings, input, output) {
    return Math.round(input * settings.priceIn + output * settings.priceOut);
}

async function getPrefs(userId) {
    const row = await knex('ai_user_prefs').where('user', userId).first();
    return { accepted: !!(row && row.shared_accepted), acceptedAt: row ? row.accepted_at : null };
}

async function setAccepted(userId, accepted) {
    const row = { shared_accepted: accepted, accepted_at: accepted ? new Date() : null };
    const existing = await knex('ai_user_prefs').where('user', userId).first();
    if (existing) {
        await knex('ai_user_prefs').where('user', userId).update(accepted ? row : { shared_accepted: false });
    } else {
        await knex('ai_user_prefs').insert({ user: userId, ...row });
    }
}

async function recordUsage(userId, { action, tier, model, input, output, estimated }) {
    if (!input && !output) {
        return null;
    }
    const settings = await getSettings();
    const cost = computeCostMicro(settings, input, output);
    await knex('ai_usage').insert({ user: userId, action, tier, model: (model || '').slice(0, 255), input_tokens: input, output_tokens: output, estimated: !!estimated, cost_micro: cost });
    return cost;
}

async function getBalance(userId) {
    const row = await knex('ai_usage').where('user', userId).whereNull('settlement')
        .select(knex.raw('coalesce(sum(cost_micro),0) as cost'), knex.raw('coalesce(sum(input_tokens),0) as input'), knex.raw('coalesce(sum(output_tokens),0) as output'), knex.raw('count(*) as requests'), knex.raw('min(created) as since'))
        .first();
    return { outstandingMicro: toNumber(row.cost), inputTokens: toNumber(row.input), outputTokens: toNumber(row.output), requests: toNumber(row.requests), since: row.since };
}

async function recentUsage(userId, limit = 20) {
    const rows = await knex('ai_usage').where('user', userId).orderBy('id', 'desc').limit(limit);
    return rows.map(r => ({ created: r.created, action: r.action, tier: r.tier, inputTokens: r.input_tokens, outputTokens: r.output_tokens, costMicro: toNumber(r.cost_micro), settled: r.settlement !== null, estimated: !!r.estimated }));
}

async function recentSettlements(userId, limit = 10) {
    const rows = await knex('ai_settlements').where('user', userId).orderBy('id', 'desc').limit(limit);
    return rows.map(r => ({ created: r.created, amountMicro: toNumber(r.amount_micro), requests: r.requests }));
}

// Refuses a request when the user's balance reached the limit set by the administrator (0 = unlimited)
async function assertWithinLimit(userId) {
    const settings = await getSettings();
    if (settings.maxOutstanding > 0) {
        const balance = await getBalance(userId);
        if (balance.outstandingMicro >= settings.maxOutstanding * 1e6) {
            throw new interoperableErrors.PermissionDeniedError('Shared AI spending limit reached: please settle your balance with the administrator');
        }
    }
}

// Administrator's overview: everyone with an open balance, then everyone with past usage
async function listBalances() {
    const rows = await knex('ai_usage').join('users', 'users.id', 'ai_usage.user').whereNull('ai_usage.settlement').groupBy('users.id', 'users.username', 'users.name')
        .select('users.id', 'users.username', 'users.name', knex.raw('sum(ai_usage.cost_micro) as cost'), knex.raw('sum(ai_usage.input_tokens) as input'), knex.raw('sum(ai_usage.output_tokens) as output'), knex.raw('count(*) as requests'), knex.raw('min(ai_usage.created) as since'))
        .orderBy('cost', 'desc');
    return rows.map(r => ({ userId: r.id, username: r.username, name: r.name, outstandingMicro: toNumber(r.cost), inputTokens: toNumber(r.input), outputTokens: toNumber(r.output), requests: toNumber(r.requests), since: r.since }));
}

async function listSettlements(limit = 30) {
    const rows = await knex('ai_settlements').join('users', 'users.id', 'ai_settlements.user').orderBy('ai_settlements.id', 'desc').limit(limit)
        .select('ai_settlements.*', 'users.username');
    return rows.map(r => ({ id: r.id, username: r.username, created: r.created, amountMicro: toNumber(r.amount_micro), requests: r.requests }));
}

// "The bill has been paid": closes the user's open usage, keeping a record of what was settled
async function settle(adminId, userId) {
    return await knex.transaction(async tx => {
        const open = await tx('ai_usage').where('user', userId).whereNull('settlement').forUpdate()
            .select(tx.raw('coalesce(sum(cost_micro),0) as cost'), tx.raw('coalesce(sum(input_tokens),0) as input'), tx.raw('coalesce(sum(output_tokens),0) as output'), tx.raw('count(*) as requests'))
            .first();
        if (toNumber(open.requests) === 0) {
            return { settledMicro: 0 };
        }
        const [id] = await tx('ai_settlements').insert({ user: userId, amount_micro: toNumber(open.cost), input_tokens: toNumber(open.input), output_tokens: toNumber(open.output), requests: toNumber(open.requests), settled_by: adminId });
        await tx('ai_usage').where('user', userId).whereNull('settlement').update({ settlement: id });
        return { settledMicro: toNumber(open.cost), settlementId: id };
    });
}

export default {
    getSettings, saveSettings, computeCostMicro, getPrefs, setAccepted, recordUsage, getBalance, recentUsage, recentSettlements,
    assertWithinLimit, listBalances, listSettlements, settle
};
