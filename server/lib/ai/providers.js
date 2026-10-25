// One thin adapter per protocol. All of them expose complete(model, apiKey, { system, user }) -> text.
// "mistral" and "openai" share the chat-completions format (OpenRouter, Ollama, vLLM... speak it too).
import { postJson } from './http.js';

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

const adapters = {
    async openai(model, apiKey, { system, user }) {
        const isOpenAI = /(^|\.)api\.openai\.com$/.test(new URL(model.base_url).hostname);
        const body = { model: model.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
        if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
        if (model.max_tokens) body[isOpenAI ? 'max_completion_tokens' : 'max_tokens'] = model.max_tokens;
        const json = await call(join(model.base_url, '/chat/completions'), { headers: { Authorization: `Bearer ${apiKey}` }, body }, 'openai');
        const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
        if (typeof text !== 'string') throw new ProviderError('openai: no content in response', { retryable: true });
        return text;
    },

    async anthropic(model, apiKey, { system, user }) {
        const body = { model: model.model, max_tokens: model.max_tokens || 8192, system, messages: [{ role: 'user', content: user }] };
        if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
        const json = await call(join(model.base_url, '/messages'), { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body }, 'anthropic');
        const text = (json.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
        if (!text) throw new ProviderError('anthropic: no text in response', { retryable: true });
        return text;
    },

    async gemini(model, apiKey, { system, user }) {
        const generationConfig = {};
        if (model.temperature !== null && model.temperature !== undefined) generationConfig.temperature = model.temperature;
        if (model.max_tokens) generationConfig.maxOutputTokens = model.max_tokens;
        const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig };
        const json = await call(join(model.base_url, `/models/${encodeURIComponent(model.model)}:generateContent`), { headers: { 'x-goog-api-key': apiKey }, body }, 'gemini');
        const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
        const text = (parts || []).map(p => p.text || '').join('');
        if (!text) throw new ProviderError('gemini: no text in response', { retryable: true });
        return text;
    },

    async cohere(model, apiKey, { system, user }) {
        const body = { model: model.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
        if (model.temperature !== null && model.temperature !== undefined) body.temperature = model.temperature;
        if (model.max_tokens) body.max_tokens = model.max_tokens;
        const json = await call(join(model.base_url, '/chat'), { headers: { Authorization: `Bearer ${apiKey}` }, body }, 'cohere');
        const text = ((json.message && json.message.content) || []).filter(p => p.type === 'text').map(p => p.text).join('');
        if (!text) throw new ProviderError('cohere: no text in response', { retryable: true });
        return text;
    }
};
adapters.mistral = adapters.openai;

async function complete(model, apiKey, prompt) {
    const adapter = adapters[model.protocol];
    if (!adapter) {
        throw new ProviderError(`Unsupported protocol ${model.protocol}`);
    }
    return await adapter(model, apiKey, prompt);
}

export { complete, ProviderError, PROTOCOLS, DEFAULT_BASE_URLS };
