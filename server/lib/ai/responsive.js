// "Make it responsive" support. The model never rewrites the HTML: it returns a small stylesheet of @media rules which
// is validated against a whitelist and added next to the content. Elements are addressed through data-ai-r attributes
// that this module adds to the source, so that rules can target elements that have no class.
import * as cheerio from 'cheerio';

const MAX_DIGEST_CHARS = 40000;
const MARKER = 'data-ai-responsive';
const CSS_MARKER_START = '/* ai-responsive:start */';
const CSS_MARKER_END = '/* ai-responsive:end */';

const ALLOWED_PROPERTIES = new Set([
    'font-size', 'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'word-break', 'overflow-wrap', 'hyphens',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'width', 'max-width', 'min-width', 'height', 'min-height', 'max-height',
    'display', 'background-size', 'background-position', 'white-space', 'vertical-align'
]);
const VALUE_OK = /^[a-zA-Z0-9\s.,%()#+*/-]+$/; // no quotes, url(), semicolons, braces or backslashes
const FORBIDDEN_IN_VALUE = /url\s*\(|expression|javascript|@import|var\s*\(|attr\s*\(/i;
// h1-h3: the native Email Builder headings cannot carry attributes, they are reached through their tag
const SELECTOR_OK = /^(\[data-ai-r="[A-Za-z0-9_-]+"\]|\.[A-Za-z_][A-Za-z0-9_-]*|h[1-3])$/;
const MEDIA_OK = /^@media\s+(only\s+screen\s+and\s+)?\(\s*max-width\s*:\s*(\d{3,4})px\s*\)$/i;

// --- digest ------------------------------------------------------------------------------------------------------------
function annotate($, prefix) {
    let n = 0;
    $('*').each((i, el) => {
        if (['script', 'style', 'head', 'title', 'meta', 'link'].includes(el.name)) return;
        $(el).attr('data-ai-r', `${prefix}${++n}`);
    });
}

function digestOfHtml($, maxText = 60) {
    const copy = cheerio.load($.html(), null, false);
    copy('style, script, head, title, meta, link').remove();
    copy('*').contents().each(function strip() {
        if (this.type === 'comment') copy(this).remove();
        else if (this.type === 'text' && this.data.length > maxText) this.data = this.data.slice(0, maxText) + '…';
    });
    copy('[src],[href],[background]').each((i, el) => {
        for (const a of ['src', 'href', 'background']) {
            const v = copy(el).attr(a);
            if (v && v.length > 50) copy(el).attr(a, v.slice(0, 50) + '…');
        }
    });
    return copy.html().replace(/>\s+</g, '><');
}

function forHtml(source, style) {
    const body = /^(\s*<body[^>]*>)([\s\S]*)(<\/body>\s*)$/i.exec(source);
    const $ = cheerio.load(body ? body[2] : source, null, false);
    annotate($, '');
    const digest = digestOfHtml($);
    const ids = new Set($('[data-ai-r]').map((i, el) => $(el).attr('data-ai-r')).get());

    const apply = (css, usedIds) => {
        // Keep the data-ai-r attributes only on the elements the rules use
        $('[data-ai-r]').each((i, el) => {
            if (!usedIds.has($(el).attr('data-ai-r'))) $(el).removeAttr('data-ai-r');
        });
        const out = $.html();
        const cleanStyle = (style || '').replace(new RegExp(`${CSS_MARKER_START.replace(/[*/]/g, '\\$&')}[\\s\\S]*?${CSS_MARKER_END.replace(/[*/]/g, '\\$&')}`), '').trim();
        return { source: body ? body[1] + out + body[3] : out, style: `${cleanStyle}\n${CSS_MARKER_START}\n${css}\n${CSS_MARKER_END}`.trim() };
    };
    return { digest: `<css-note>Les éléments portent un attribut data-ai-r. Les feuilles de style existantes ne sont pas montrées.</css-note>\n${digest}`, ids, apply };
}

function forEmailBuilder(source) {
    const doc = JSON.parse(source);
    const lines = [];
    const ids = new Set();
    const htmlBlocks = [];
    const order = (doc.root && doc.root.data && doc.root.data.childrenIds) || Object.keys(doc);

    const visit = blockId => {
        const block = doc[blockId];
        if (!block || !block.data) return;
        const props = block.data.props || {};
        if (block.type === 'Html' && typeof props.contents === 'string') {
            const $ = cheerio.load(props.contents, null, false);
            annotate($, `${blockId}_`);
            $('[data-ai-r]').each((i, el) => ids.add($(el).attr('data-ai-r')));
            lines.push(`BLOC Html "${blockId}":\n${digestOfHtml($)}`);
            htmlBlocks.push({ $, props });
        } else {
            const text = typeof props.text === 'string' ? ` text="${props.text.slice(0, 60)}"` : '';
            const reach = block.type === 'Heading'
                ? `ciblable uniquement par le sélecteur de balise ${props.level || 'h2'} (il vise alors tous les titres ${props.level || 'h2'} du mail)`
                : 'rendu natif, non ciblable par CSS';
            lines.push(`BLOC ${block.type} "${blockId}"${text} (${reach}; ne mets jamais l'identifiant du bloc dans un sélecteur)`);
        }
        const kids = [...(props.childrenIds || []), ...((props.columns || []).flatMap(c => c.childrenIds || []))];
        kids.forEach(visit);
    };
    order.forEach(visit);

    const apply = (css, usedIds) => {
        for (const { $, props } of htmlBlocks) {
            $('[data-ai-r]').each((i, el) => {
                if (!usedIds.has($(el).attr('data-ai-r'))) $(el).removeAttr('data-ai-r');
            });
            props.contents = $.html();
        }
        // One dedicated block holds the generated rules: a new run replaces it
        doc['ai-responsive-css'] = { type: 'Html', data: { style: { padding: { top: 0, right: 0, bottom: 0, left: 0 } }, props: { contents: `<style ${MARKER}="1">${css}</style>` } } };
        const children = (doc.root.data.childrenIds || []).filter(id => id !== 'ai-responsive-css');
        doc.root.data.childrenIds = ['ai-responsive-css', ...children];
        return { source: JSON.stringify(doc), style: undefined };
    };
    return { digest: lines.join('\n'), ids, apply };
}

function build(editorType, source, style) {
    const result = editorType === 'emailbuilder' ? forEmailBuilder(source) : forHtml(source, style);
    if (result.digest.length > MAX_DIGEST_CHARS) {
        throw new Error('Content too large to be analysed for responsiveness');
    }
    return result;
}

// --- validation --------------------------------------------------------------------------------------------------------
// Accepts only: @media (max-width: Npx) { selector, selector { property: value; ... } ... } blocks
function sanitizeCss(css, validIds, onReject = () => {}) {
    const reject = reason => {
        onReject(reason);
        return null;
    };
    if (typeof css !== 'string') return reject('css is not a string');
    const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const out = [];
    const used = new Set();
    const mediaRe = /(@media[^{]+)\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g;
    let consumed = 0;
    let m;
    while ((m = mediaRe.exec(cleaned)) !== null) {
        if (cleaned.slice(consumed, m.index).trim() !== '') return reject('content outside @media blocks'); // anything outside @media blocks is refused
        consumed = mediaRe.lastIndex;
        const query = m[1].trim().replace(/\s+/g, ' ');
        const q = MEDIA_OK.exec(query);
        if (!q || Number(q[2]) < 280 || Number(q[2]) > 1000) return reject(`unsupported media query: ${query}`);
        const rules = [];
        const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
        let r;
        while ((r = ruleRe.exec(m[2])) !== null) {
            const selectors = r[1].split(',').map(s => s.trim());
            const badSelector = selectors.find(s => !SELECTOR_OK.test(s));
            if (badSelector) return reject(`selector not allowed: ${badSelector}`);
            const known = [];
            for (const s of selectors) {
                const id = /^\[data-ai-r="([^"]+)"\]$/.exec(s);
                if (id && !validIds.has(id[1])) {
                    onReject(`unknown element id ignored: ${id[1]}`);
                    continue;
                }
                if (id) used.add(id[1]);
                known.push(s);
            }
            if (known.length === 0) continue;
            const decls = [];
            for (const d of r[2].split(';').map(x => x.trim()).filter(Boolean)) {
                const idx = d.indexOf(':');
                if (idx < 0) return reject(`malformed declaration: ${d}`);
                const prop = d.slice(0, idx).trim().toLowerCase();
                const value = d.slice(idx + 1).replace(/!important/i, '').trim();
                if (!ALLOWED_PROPERTIES.has(prop)) return reject(`property not allowed: ${prop}`);
                if (!VALUE_OK.test(value) || FORBIDDEN_IN_VALUE.test(value) || value.length > 80) return reject(`value not allowed for ${prop}: ${value}`);
                decls.push(`${prop}:${value}!important`);
            }
            if (decls.length) rules.push(`${known.join(',')}{${decls.join(';')}}`);
        }
        if (rules.length) out.push(`${query}{${rules.join('')}}`);
    }
    if (cleaned.slice(consumed).trim() !== '') return reject('content outside @media blocks');
    return out.length ? { css: out.join('\n'), used } : reject('no usable rule');
}

export { build, sanitizeCss };
