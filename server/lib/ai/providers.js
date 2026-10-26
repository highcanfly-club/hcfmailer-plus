// One thin adapter per protocol. All of them expose complete(model, apiKey, { system, user }) -> { text, usage }
// where usage = { input, output, estimated } in tokens, as reported by the provider (estimated when it reports nothing).
// "mistral" and "openai" share the chat-completions format (OpenRouter, Ollama, vLLM... speak it too).
import { postJson, postStream } from './http.js';

class ProviderError extends Error {
    constructor(message, { status = null, retryable = false, keyProblem = false } = {}) {
        super(message);
        this.status = status;
        this.retryable = retryable; // try another key / later
        this.keyProblem = keyProblem; // the key itself is refused (401/403)
    }
}

const PROTOCOLS = ['anthropic', 'openai', 'gemini', 'cohere', 'mistral'];
const DEFAULT_BASE_URLS = {
    anthropic: 'https://api.anthropic.com/v1',
    openai: 'https://api.openai.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    cohere: 'https://api.cohere.com/v2',
    mistral: 'https://api.mistral.ai/v1'
};

const estimateTokens = text => Math.ceil(String(text || '').length / 4);
const usageOf = (input, output, prompt, text) => {
    const hasUsage = Number.isFinite(input) && Number.isFinite(output) && (input > 0 || output > 0);
    return hasUsage ? { input, output, estimated: false } : { input: estimateTokens(prompt.system) + estimateTokens(prompt.user), output: estimateTokens(text), estimated: true };
};

const join = (base, path) => base.replace(/\/+$/, '') + path;

function failure(res, provider) {
    const detail = (res.json && (res.json.error && (res.json.error.message || res.json.error) || res.json.message)) || res.text.slice(0, 200);
    const message = `${provider}: HTTP ${res.status}${detail ? ' - ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : ''}`;
    return new ProviderError(message, {
        status: res.status,
        keyProblem: res.status === 401 || res.status === 403,
        retryable: res.status === 401 || res.status === 403 || res.status === 408 || res.status === 429 || res.status >= 500
    });
}

async function call(url, options, provider) {
    let res;
    try {
        res = await postJson(url, options);
    } catch (err) {
        throw new ProviderError(`${provider}: ${err.message}`, { retryable: true });
    }
    if (res.status < 200 || res.status >= 300) {
        throw failure(res, provider);
    }
    if (!res.json) {
        throw new ProviderError(`${provider}: response is not JSON`, { retryable: true });
    }
    return res.json;
}

// Every protocol describes: how to build the request (`build`), how to read a complete response (`parse`) and how to
// read one server-sent event when streaming (`delta`). `parse` and `delta` both produce { text, reasoning, usage }.
// The reasoning ("thinking") of the model is only available when the provider sends it (openai-compatible hosts,
// anthropic with extended thinking, gemini thoughts, cohere thinking).
const protocols = {
    openai: {
        build(model, apiKey, { system, user }, stream) {
            const isOpenAI = /(^|\.)api\.openai\.com$/.test(new URL(model.base_url).hostname);
            const body = { model: model.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
            if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
            if (model.max_tokens) body[isOpenAI ? 'max_completion_tokens' : 'max_tokens'] = model.max_tokens;
            if (stream) {
                body.stream = true;
                if (model.protocol !== 'mistral') body.stream_options = { include_usage: true };
            }
            return { url: join(model.base_url, '/chat/completions'), headers: { Authorization: `Bearer ${apiKey}` }, body };
        },
        parse(json) {
            const message = json.choices && json.choices[0] && json.choices[0].message;
            const content = message && message.content;
            return { text: typeof content === 'string' ? content : '', reasoning: (message && (message.reasoning_content || message.reasoning)) || '', usage: [json.usage && json.usage.prompt_tokens, json.usage && json.usage.completion_tokens] };
        },
        delta(evt) {
            const choice = evt.choices && evt.choices[0];
            const d = (choice && choice.delta) || {};
            let text = d.content;
            if (Array.isArray(text)) text = text.map(p => (typeof p === 'string' ? p : p.text || '')).join(''); // mistral may send content parts
            return { text: typeof text === 'string' ? text : '', reasoning: d.reasoning_content || d.reasoning || '', usage: evt.usage ? [evt.usage.prompt_tokens, evt.usage.completion_tokens] : null };
        }
    },

    anthropic: {
        build(model, apiKey, { system, user }, stream) {
            const body = { model: model.model, max_tokens: model.max_tokens || 8192, system, messages: [{ role: 'user', content: user }] };
            if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
            if (stream) body.stream = true;
            return { url: join(model.base_url, '/messages'), headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body };
        },
        parse(json) {
            const parts = json.content || [];
            return {
                text: parts.filter(p => p.type === 'text').map(p => p.text).join(''),
                reasoning: parts.filter(p => p.type === 'thinking').map(p => p.thinking).join(''),
                usage: [json.usage && json.usage.input_tokens, json.usage && json.usage.output_tokens]
            };
        },
        delta(evt) {
            if (evt.type === 'message_start') return { usage: [evt.message && evt.message.usage && evt.message.usage.input_tokens, null] };
            if (evt.type === 'message_delta') return { usage: [null, evt.usage && evt.usage.output_tokens] };
            if (evt.type === 'content_block_delta' && evt.delta) {
                if (evt.delta.type === 'text_delta') return { text: evt.delta.text };
                if (evt.delta.type === 'thinking_delta') return { reasoning: evt.delta.thinking };
            }
            if (evt.type === 'error') throw new ProviderError(`anthropic: ${(evt.error && evt.error.message) || 'stream error'}`, { retryable: true });
            return {};
        }
    },

    gemini: {
        build(model, apiKey, { system, user }, stream) {
            const generationConfig = {};
            if (model.temperature !== null && model.temperature !== undefined) generationConfig.temperature = model.temperature;
            if (model.max_tokens) generationConfig.maxOutputTokens = model.max_tokens;
            const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig };
            const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
            return { url: join(model.base_url, `/models/${encodeURIComponent(model.model)}:${method}`), headers: { 'x-goog-api-key': apiKey }, body };
        },
        parse(json) {
            return geminiChunk(json);
        },
        delta(evt) {
            return geminiChunk(evt);
        }
    },

    cohere: {
        build(model, apiKey, { system, user }, stream) {
            const body = { model: model.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
            if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
            if (model.max_tokens) body.max_tokens = model.max_tokens;
            if (stream) body.stream = true;
            return { url: join(model.base_url, '/chat'), headers: { Authorization: `Bearer ${apiKey}` }, body };
        },
        parse(json) {
            const parts = (json.message && json.message.content) || [];
            const tokens = (json.usage && (json.usage.tokens || json.usage.billed_units)) || {};
            return {
                text: parts.filter(p => p.type === 'text').map(p => p.text).join(''),
                reasoning: parts.filter(p => p.type === 'thinking').map(p => p.thinking).join(''),
                usage: [tokens.input_tokens, tokens.output_tokens]
            };
        },
        delta(evt) {
            if (evt.type === 'content-delta') {
                const content = (evt.delta && evt.delta.message && evt.delta.message.content) || {};
                return { text: content.text || '', reasoning: content.thinking || '' };
            }
            if (evt.type === 'message-end') {
                const tokens = (evt.delta && evt.delta.usage && (evt.delta.usage.tokens || evt.delta.usage.billed_units)) || {};
                return { usage: [tokens.input_tokens, tokens.output_tokens] };
            }
            return {};
        }
    }
};
protocols.mistral = protocols.openai;

function geminiChunk(json) {
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const meta = json.usageMetadata;
    return {
        text: parts.filter(p => !p.thought).map(p => p.text || '').join(''),
        reasoning: parts.filter(p => p.thought).map(p => p.text || '').join(''),
        usage: meta ? [meta.promptTokenCount, (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0)] : null
    };
}

// One streaming request: deltas are pushed to the hooks as they arrive, the complete answer is returned at the end
async function streamCall(proto, request, provider, hooks) {
    let res;
    let text = '';
    let reasoning = '';
    let inTokens = null;
    let outTokens = null;
    let failure_ = null;
    try {
        res = await postStream(request.url, {
            headers: request.headers,
            body: request.body,
            signal: hooks.signal,
            onEvent: ({ data }) => {
                if (data === '[DONE]') return;
                let evt;
                try { evt = JSON.parse(data); } catch { return; }
                if (evt.error && !evt.choices) { // some hosts report a failure in the middle of the stream
                    failure_ = new ProviderError(`${provider}: ${typeof evt.error === 'string' ? evt.error : evt.error.message || JSON.stringify(evt.error)}`.slice(0, 300), { retryable: true });
                    return;
                }
                const d = proto.delta(evt);
                if (d.reasoning) { reasoning += d.reasoning; if (hooks.onReasoning) hooks.onReasoning(d.reasoning); }
                if (d.text) { text += d.text; if (hooks.onText) hooks.onText(d.text); }
                if (d.usage) {
                    if (Number.isFinite(d.usage[0])) inTokens = d.usage[0];
                    if (Number.isFinite(d.usage[1])) outTokens = d.usage[1];
                }
            }
        });
    } catch (err) {
        if (err.name === 'AbortError') throw Object.assign(new ProviderError(`${provider}: aborted`), { aborted: true, partial: { text, reasoning } });
        throw new ProviderError(`${provider}: ${err.message}`, { retryable: true });
    }
    if (res.status < 200 || res.status >= 300) throw failure(res, provider);
    if (failure_) throw failure_;
    return { text, reasoning, usage: [inTokens, outTokens] };
}

async function complete(model, apiKey, prompt, hooks = {}) {
    const proto = protocols[model.protocol];
    if (!proto) {
        throw new ProviderError(`Unsupported protocol ${model.protocol}`);
    }
    const provider = model.protocol;
    const stream = !!(hooks.onText || hooks.onReasoning);
    const request = proto.build(model, apiKey, prompt, stream);
    let out;
    if (stream) {
        out = await streamCall(proto, request, provider, hooks);
    } else {
        out = proto.parse(await call(request.url, { headers: request.headers, body: request.body }, provider));
    }
    if (!out.text) {
        throw new ProviderError(`${provider}: no ${model.protocol === 'openai' || model.protocol === 'mistral' ? 'content' : 'text'} in response`, { retryable: true });
    }
    return { text: out.text, reasoning: out.reasoning || '', usage: usageOf(out.usage && out.usage[0], out.usage && out.usage[1], prompt, out.text) };
}

export { complete, ProviderError, PROTOCOLS, DEFAULT_BASE_URLS };
