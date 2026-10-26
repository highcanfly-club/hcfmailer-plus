import knex from '../lib/knex.js';

const RETENTION_DAYS = 365;

async function record(userId, entry) {
    await knex('ai_audit').insert({
        user: userId,
        action: entry.action,
        source_type: entry.sourceType || null,
        source_id: entry.sourceId || null,
        campaign: entry.campaign || null,
        mode: entry.mode || null,
        tier: entry.tier || null,
        input_tokens: entry.input || 0,
        output_tokens: entry.output || 0,
        details: entry.details ? JSON.stringify(entry.details) : null
    });
}

async function purgeOld(days = RETENTION_DAYS) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    return await knex('ai_audit').where('created', '<', cutoff).del();
}

// Daily purge, started once by the web process
let timer = null;
function startPurgeSchedule() {
    if (timer) return;
    const run = () => purgeOld().catch(err => console.error('AI audit purge failed', err));
    run();
    timer = setInterval(run, 24 * 3600 * 1000);
    timer.unref();
}

export default { record, purgeOld, startPurgeSchedule, RETENTION_DAYS };
