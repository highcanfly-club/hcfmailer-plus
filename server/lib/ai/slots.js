// Text "slots": the editable pieces of text of a template, extracted so that the AI only ever sees and returns text,
// never the layout. HTML sources (CKEditor, GrapesJS) and Email Builder documents (JSON) are both supported.
// Markup stays intact: only the text goes through the model, and anything that comes back altered is rejected.
import * as cheerio from 'cheerio';

const INLINE = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 'span', 'br', 'sup', 'sub', 'small', 'font', 'mark', 'abbr', 's', 'code']);
const SKIP = new Set(['script', 'style', 'head', 'title', 'svg', 'noscript', 'textarea']);
const HAS_LETTERS = /\p{L}/u;
const MERGE_TAG = /\[[A-Z][A-Z0-9_]{2,}(?:\|[^\]]*)?\]|\{\{[^}]+\}\}/g;
const TOKEN = /§(\d+)§/g;

// --- merge tags protection -------------------------------------------------------------------------------------------
function maskTags(text) {
    const tags = [];
    const masked = text.replace(MERGE_TAG, tag => {
        tags.push(tag);
        return `§${tags.length}§`;
    });
    return { masked, tags };
}

function unmaskTags(text, tags) {
    const used = new Set();
    const result = text.replace(TOKEN, (m, n) => {
        used.add(Number(n));
        return tags[Number(n) - 1] !== undefined ? tags[Number(n) - 1] : m;
    });
    const complete = tags.every((t, i) => used.has(i + 1));
    const count = (text.match(TOKEN) || []).length;
    return { text: result, ok: complete && count === tags.length };
}

// Inline structure that must survive: tag names (br ignored) AND all their attributes. Comparing the complete attribute
// set means the model can neither retarget a link nor attach an event handler or a style to any element.
const ATTR = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function signature(html) {
    const sig = [];
    for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g)) {
        const name = m[2].toLowerCase();
        if (name === 'br') continue;
        const attrs = [...m[3].matchAll(ATTR)].map(a => `${a[1].toLowerCase()}=${(a[2] || '').replace(/^["']|["']$/g, '')}`).sort().join(',');
        sig.push(`${m[1]}${name}[${attrs}]`);
    }
    return sig.join(',');
}

const stripTags = text => text.replace(/<[^>]*>/g, '');

// --- HTML ------------------------------------------------------------------------------------------------------------
function isLocked($, el) {
    return $(el).closest('[data-ai-lock]').length > 0;
}

function isSlotElement($, el) {
    if (el.type !== 'tag' || SKIP.has(el.name)) return false;
    const children = el.children || [];
    const hasText = children.some(c => c.type === 'text' && HAS_LETTERS.test(c.data));
    if (!hasText) return false;
    return children.every(c => c.type === 'text' || c.type === 'comment' || (c.type === 'tag' && INLINE.has(c.name)));
}

function kindOf(el) {
    if (/^h[1-6]$/.test(el.name)) return 'heading';
    if (el.name === 'a') return 'link';
    return 'text';
}

function extractHtml(source, prefix = '') {
    const body = /^(\s*<body[^>]*>)([\s\S]*)(<\/body>\s*)$/i.exec(source);
    const inner = body ? body[2] : source;
    const $ = cheerio.load(inner, null, false);
    const slots = [];
    const elements = new Map();

    const walk = node => {
        if (node.type !== 'tag' || SKIP.has(node.name)) return;
        if (isSlotElement($, node)) {
            if (!isLocked($, node)) {
                const id = `${prefix}${slots.length + 1}`;
                slots.push({ id, kind: kindOf(node), format: 'html', text: $(node).html() });
                elements.set(id, node);
            }
            return;
        }
        (node.children || []).forEach(walk);
    };
    ($.root().contents().toArray()).forEach(walk);

    const apply = texts => {
        for (const [id, el] of elements) {
            if (texts.has(id)) $(el).html(texts.get(id));
        }
        const out = $.html();
        return body ? body[1] + out + body[3] : out;
    };
    return { slots, apply };
}

// --- Email Builder (JSON) --------------------------------------------------------------------------------------------
function extractEmailBuilder(source) {
    const doc = JSON.parse(source);
    const slots = [];
    const setters = new Map();
    const htmlParts = new Map();

    for (const [blockId, block] of Object.entries(doc)) {
        if (blockId === 'root' || !block || !block.data) continue;
        const props = block.data.props || {};
        const plain = (field, kind) => {
            if (typeof props[field] === 'string' && HAS_LETTERS.test(props[field])) {
                const id = `${blockId}.${field}`;
                slots.push({ id, kind, format: 'text', text: props[field] });
                setters.set(id, value => { props[field] = value; });
            }
        };
        switch (block.type) {
            case 'Heading': plain('text', 'heading'); break;
            case 'Button': plain('text', 'link'); break;
            case 'Image': plain('alt', 'alt'); break;
            case 'Text':
                if (typeof props.text === 'string' && HAS_LETTERS.test(props.text)) {
                    const id = `${blockId}.text`;
                    slots.push({ id, kind: 'text', format: 'html', text: props.text });
                    setters.set(id, value => { props.text = value; });
                }
                break;
            case 'Html':
                if (typeof props.contents === 'string') {
                    const sub = extractHtml(props.contents, `${blockId}#`);
                    sub.slots.forEach(s => slots.push(s));
                    if (sub.slots.length) htmlParts.set(blockId, { sub, props });
                }
                break;
            default:
        }
    }

    const apply = texts => {
        for (const [id, setter] of setters) {
            if (texts.has(id)) setter(texts.get(id));
        }
        for (const { sub, props } of htmlParts.values()) {
            props.contents = sub.apply(texts);
        }
        return JSON.stringify(doc);
    };
    return { slots, apply };
}

function extractSlots(editorType, source) {
    if (editorType === 'emailbuilder') return extractEmailBuilder(source || '{}');
    return extractHtml(source || '');
}

// Prepares slots for the model (masked tags) and validates what comes back
function prepare(slots) {
    return slots.map(s => ({ ...s, ...maskTags(s.text) }));
}

function validateReply(slot, newText) {
    if (typeof newText !== 'string' || newText.trim() === '') return null;
    if (slot.format === 'text') {
        const cleaned = stripTags(newText);
        const { text, ok } = unmaskTags(cleaned, slot.tags);
        return ok ? text : null;
    }
    if (signature(newText) !== signature(slot.masked)) return null;
    const { text, ok } = unmaskTags(newText, slot.tags);
    return ok ? text : null;
}

// Final check of a replacement text (real merge tags, not masked) before it is written into a document: same merge tags
// and same inline structure (tags, link targets) as the original text of the slot
const tagList = text => (text.match(MERGE_TAG) || []).slice().sort().join('\u0000');

function validateFinal(slot, newText) {
    if (typeof newText !== 'string' || newText.trim() === '' || newText.length > 20000) return null;
    if (tagList(newText) !== tagList(slot.text)) return null;
    if (slot.format === 'text') return stripTags(newText);
    return signature(newText) === signature(slot.text) ? newText : null;
}

export { extractSlots, prepare, validateReply, validateFinal, maskTags, unmaskTags, signature };
