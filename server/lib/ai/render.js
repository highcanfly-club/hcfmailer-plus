// Renders the stored source of a campaign/template into the html + text that are sent, the way the editors do on export.
import { renderToStaticMarkup } from '@usewaypoint/email-builder';
import { htmlToText } from 'html-to-text';
import juice from 'juice';
import mjml2html from 'mjml';

const PRE = '<!doctype html><html><head><meta charset="utf-8"><title></title></head><body>';
const POST = '</body></html>';

async function renderContent(editorType, source, { style = '', sourceType = 'html' } = {}) {
    let html;
    if (editorType === 'emailbuilder') {
        // already a complete HTML document (same call as the editor's export)
        html = renderToStaticMarkup(JSON.parse(source), { rootBlockId: 'root' });
    } else if (editorType === 'grapesjs' && sourceType === 'mjml') {
        const compiled = await mjml2html(`<mjml><mj-head></mj-head><mj-body>${source}</mj-body></mjml>`);
        html = compiled.html;
    } else if (editorType === 'grapesjs') {
        const body = /^\s*<body[^>]*>([\s\S]*)<\/body>\s*$/i.exec(source);
        html = PRE + juice(`<style>${style}</style>${body ? body[1] : source}`) + POST;
    } else {
        html = PRE + source + POST;
    }
    const text = htmlToText(html, { wordwrap: 100, selectors: [{ selector: 'img', format: 'skip' }, { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }] });
    return { html, text };
}

export { renderContent };
