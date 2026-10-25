// The three user-facing AI actions (correct, rewrite, generate). They all work on text slots (see slots.js) so the
// layout of the template never goes through the model, and every reply is validated before it is applied.
import aiModels from '../../models/ai.js';
import { complete } from './providers.js';
import { extractSlots, prepare, validateReply } from './slots.js';
import { skeleton } from './skeletons.js';

const MAX_SOURCE_CHARS = 200000;
const CHUNK_SLOTS = 25;
const CHUNK_CHARS = 8000;
const MAX_GENERATE_SLOTS = 80;
const MAX_GENERATE_CHARS = 30000;

// Which tier each action prefers; the other tiers are used when the preferred one is not configured
const TIER_PREFERENCE = {
    correct: ['basic', 'medium', 'high'],
    rewrite: ['medium', 'high', 'basic'],
    generate: ['high', 'medium', 'basic']
};

const COMMON_RULES = `Règles impératives :
- Tu reçois une liste JSON de "slots" {id, kind, text}. "text" est du texte d'email, éventuellement avec des balises HTML en ligne (<b>, <a href>, <span>...).
- Conserve EXACTEMENT toutes les balises HTML et leurs attributs (href compris), et tous les jetons de la forme §1§, §2§... (ils représentent des balises de fusion : ne les modifie, ne les traduis, ne les supprime jamais, et n'en ajoute pas).
- Les slots de kind "heading" sont des titres courts, "link" des libellés de bouton ou de lien (très courts), "alt" des textes alternatifs d'image, "text" des paragraphes.
- Réponds uniquement avec un objet JSON {"slots":[{"id":"...","text":"..."}]}, sans commentaire ni bloc de code.`;

const PROMPTS = {
    correct: () => `Tu es un correcteur professionnel. Corrige l'orthographe, la grammaire, la conjugaison, l'accentuation et la ponctuation (typographie française : espace insécable avant ; : ! ? » et après «). Ne change ni le sens, ni le ton, ni la longueur, ni le vocabulaire sauf pour corriger une faute. Un slot sans faute doit être renvoyé tel quel. Garde la langue d'origine.\n${COMMON_RULES}`,
    rewrite: ({ instruction }) => `Tu es un rédacteur professionnel d'emailings. Réécris les textes selon cette consigne de l'utilisateur : « ${instruction} ». Garde la langue d'origine sauf demande contraire, des longueurs comparables et le sens des informations (dates, prix, noms, liens).\n${COMMON_RULES}`,
    generate: ({ references, brand }) => `Tu es un rédacteur professionnel d'emailings. Tu remplis les slots d'un modèle de newsletter existant avec un contenu nouveau, d'après le brief de l'utilisateur. Respecte approximativement la longueur de chaque slot d'origine (ils donnent la structure et le gabarit). N'invente ni prix, ni dates, ni chiffres, ni liens qui ne figurent pas dans le brief ; reste factuel. Le champ "text" d'un slot "alt" décrit une image du mail.
${brand ? `\nProfil de marque / ton :\n${brand}\n` : ''}${references.length ? `\nExemples de newsletters passées de l'utilisateur (pour le ton et le style uniquement, ne recopie pas leur contenu) :\n${references.map(r => `--- ${r.name}\n${r.text}`).join('\n')}\n` : ''}
En plus de "slots", ajoute à l'objet JSON les champs "subject" (objet de l'email, 60 caractères maximum) et "preheader" (texte d'aperçu, 100 caractères maximum).
${COMMON_RULES}`
};

function parseJsonReply(text) {
    const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < start) {
        throw new Error('The model did not return JSON');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
}

function chunk(slots) {
    const chunks = [];
    let current = [];
    let chars = 0;
    for (const slot of slots) {
        if (current.length && (current.length >= CHUNK_SLOTS || chars + slot.masked.length > CHUNK_CHARS)) {
            chunks.push(current);
            current = [];
            chars = 0;
        }
        current.push(slot);
        chars += slot.masked.length;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

async function resolveTier(userId, action, requested) {
    const status = await aiModels.getStatus(userId);
    if (!status.enabled) {
        return null;
    }
    if (requested && status.tiers[requested]) {
        return requested;
    }
    return TIER_PREFERENCE[action].find(t => status.tiers[t]) || null;
}

async function callModel(userId, tier, system, user) {
    return await aiModels.withKey(userId, tier, (model, apiKey) => complete(model, apiKey, { system, user }));
}

// Embedded images (data: URIs) can weigh hundreds of KB and mean nothing to the model: they are set aside while the
// text is processed, then put back in place.
function stashDataUris(source) {
    const stash = [];
    const stripped = source.replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=_-]+/gi, uri => {
        stash.push(uri);
        return `data:ai-stash-${stash.length - 1}`;
    });
    const restore = text => text.replace(/data:ai-stash-(\d+)/g, (m, i) => stash[Number(i)] !== undefined ? stash[Number(i)] : m);
    return { stripped, restore };
}

async function runOnSlots({ userId, action, tier, editorType, source: originalSource, options }) {
    if (typeof originalSource !== 'string') {
        throw new Error('Content missing');
    }
    const { stripped: source, restore } = stashDataUris(originalSource);
    if (source.length > MAX_SOURCE_CHARS) {
        throw new Error(`Content too large (${Math.round(source.length / 1000)} KB of markup, 200 KB maximum)`);
    }
    const result = await processSlots({ userId, action, tier, editorType, source, options });
    return { ...result, source: restore(result.source) };
}

async function processSlots({ userId, action, tier, editorType, source, options }) {
    let working = source;
    let parsed = extractSlots(editorType, working);
    let usedSkeleton = false;
    if (parsed.slots.length === 0 && action === 'generate') {
        working = skeleton(editorType);
        parsed = extractSlots(editorType, working);
        usedSkeleton = true;
    }
    const slots = prepare(parsed.slots);
    if (slots.length === 0) {
        return { source, changed: 0, rejected: 0, tier, empty: true };
    }

    const replies = new Map();
    let meta = {};
    const system = PROMPTS[action](options);
    const batches = action === 'generate' ? [slots] : chunk(slots);

    if (action === 'generate') {
        const chars = slots.reduce((n, s) => n + s.masked.length, 0);
        if (slots.length > MAX_GENERATE_SLOTS || chars > MAX_GENERATE_CHARS) {
            throw new Error('The template is too large for a one-shot generation');
        }
    }

    let rejected = 0;
    for (const batch of batches) {
        const payload = { slots: batch.map(s => ({ id: s.id, kind: s.kind, text: s.masked })) };
        const user = action === 'generate' ? `Brief :\n${options.brief}\n\nSlots du modèle :\n${JSON.stringify(payload)}` : JSON.stringify(payload);
        const reply = parseJsonReply(await callModel(userId, tier, system, user));
        if (action === 'generate') {
            meta = { subject: typeof reply.subject === 'string' ? reply.subject.slice(0, 200) : null, preheader: typeof reply.preheader === 'string' ? reply.preheader.slice(0, 300) : null };
        }
        for (const item of Array.isArray(reply.slots) ? reply.slots : []) {
            const slot = batch.find(s => s.id === String(item.id));
            if (!slot) continue;
            const valid = validateReply(slot, item.text);
            if (valid === null) {
                rejected++;
            } else if (valid !== slot.text) {
                replies.set(slot.id, valid);
            }
        }
    }

    return { source: replies.size || usedSkeleton ? parsed.apply(replies) : source, changed: replies.size, rejected, tier, ...meta };
}

const correct = (userId, args) => runOnSlots({ userId, action: 'correct', ...args, options: {} });
const rewrite = (userId, args) => runOnSlots({ userId, action: 'rewrite', ...args });
const generate = (userId, args) => runOnSlots({ userId, action: 'generate', ...args });

export { correct, rewrite, generate, resolveTier, parseJsonReply, callModel };
