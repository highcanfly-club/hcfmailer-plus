// The "meter" that follows an AI request around: it counts the tokens (billing), streams progress events to the client
// when it listens (onEvent), carries the abort signal, and - in debug mode - records a trace of the whole LLM session.
//
// The trace is returned to the user who asked for it in the response of that same request. It is never stored: it holds
// the prompts, which contain the text of the newsletters. API keys never enter it (they are not part of the prompts,
// and are scrubbed from every recorded text anyway).
const estimateTokens = text => Math.ceil(String(text || '').length / 4);

const KEY_PATTERNS = [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g, /\bsk-[A-Za-z0-9_-]{12,}/g, /\bAIza[0-9A-Za-z_-]{20,}/g, /\bnvapi-[A-Za-z0-9_-]{12,}/g];

function scrub(text, secrets) {
    let out = String(text === undefined || text === null ? '' : text);
    for (const secret of secrets) {
        if (secret && secret.length >= 8) out = out.split(secret).join('[key]');
    }
    for (const pattern of KEY_PATTERNS) out = out.replace(pattern, '[key]');
    return out;
}

function newMeter({ debug = false, onEvent = null, signal = null } = {}) {
    const trace = { calls: [], notes: [] };
    const secrets = new Set();
    const started = Date.now();
    const meter = {
        input: 0,
        output: 0,
        estimated: false,
        model: '',
        debug,
        onEvent,
        signal,
        streaming: !!onEvent,

        emit(event) {
            if (onEvent) onEvent(event);
        },

        // A named stage of the request, for the progress display ("research 2/6", "writing"...)
        step(step, data = {}) {
            meter.emit({ type: 'step', step, ...data });
            if (debug) trace.notes.push({ at: Date.now() - started, kind: 'step', step, ...data });
        },

        // Something worth showing in the debug trace only (a rejected reply, a refused tool call...)
        note(kind, data = {}) {
            if (debug) trace.notes.push({ at: Date.now() - started, kind, ...data });
        },

        secret(value) {
            secrets.add(value);
        },

        begin(info) {
            const call = { id: trace.calls.length + 1, purpose: info.purpose || '', tier: info.tier, system: info.system, user: info.user, protocol: '', model: '', host: '', reply: '', reasoning: '', attempts: [], usage: null, ms: 0, error: null, t0: Date.now() };
            trace.calls.push(call);
            meter.emit({ type: 'call-start', call: call.id, purpose: call.purpose, tier: call.tier });
            return call;
        },

        // Called for each key tried by the failover: the live buffers restart from zero
        attempt(call, modelRow) {
            call.reply = '';
            call.reasoning = '';
            call.protocol = modelRow.protocol;
            call.model = modelRow.model;
            try { call.host = new URL(modelRow.base_url).host; } catch { call.host = ''; }
            const attempt = { n: call.attempts.length + 1, error: null };
            call.attempts.push(attempt);
            if (attempt.n > 1) meter.emit({ type: 'attempt', call: call.id, n: attempt.n });
            return attempt;
        },

        delta(call, kind, text) {
            call[kind === 'text' ? 'reply' : 'reasoning'] += text;
            meter.emit({ type: kind, call: call.id, delta: text });
        },

        end(call, { usage = null, error = null } = {}) {
            call.ms = Date.now() - call.t0;
            call.usage = usage;
            call.error = error ? String(error.message || error) : null;
            meter.emit({ type: 'call-end', call: call.id, ms: call.ms, usage, error: call.error, model: call.model });
        },

        // Tokens of a call that was cut short by the user: the provider bills what it generated
        addAborted(call, prompt) {
            meter.input += estimateTokens(prompt.system) + estimateTokens(prompt.user);
            meter.output += estimateTokens(call.reply + call.reasoning);
            meter.estimated = true;
        },

        trace() {
            if (!debug) return undefined;
            const clean = text => scrub(text, secrets);
            return {
                totalMs: Date.now() - started,
                tokens: { input: meter.input, output: meter.output, estimated: meter.estimated },
                calls: trace.calls.map(c => ({
                    id: c.id, purpose: c.purpose, tier: c.tier, protocol: c.protocol, model: c.model, host: c.host,
                    system: clean(c.system), user: clean(c.user), reply: clean(c.reply), reasoning: clean(c.reasoning),
                    attempts: c.attempts.map(a => ({ n: a.n, error: a.error ? clean(a.error) : null })),
                    usage: c.usage, ms: c.ms || Date.now() - c.t0, error: c.error ? clean(c.error) : null
                })),
                notes: trace.notes.map(n => JSON.parse(clean(JSON.stringify(n))))
            };
        }
    };
    return meter;
}

export { newMeter, estimateTokens, scrub };
