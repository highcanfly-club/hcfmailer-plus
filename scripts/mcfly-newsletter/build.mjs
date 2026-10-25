// Génère les modèles de newsletter McFly parapente pour Mosaico, GrapesJS, EmailBuilder et CKEditor 5.
// Usage : bun scripts/mcfly-newsletter/build.mjs   → écrit scripts/mcfly-newsletter/dist/*.json (+ aperçus .html)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from '@usewaypoint/email-builder';
import {
  COLORS, FONTS, FONT_FACE_CSS, MOBILE_CSS, IMG, SITE, LINKS,
  header, footer, dottedRule, sectionTitle, paragraph, button, card, promo, SAMPLE,
} from './brand.mjs';
import { buildMosaico, staticFromMosaico } from './mosaico.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
fs.mkdirSync(dist, { recursive: true });

const outJson = (name, obj) => fs.writeFileSync(path.join(dist, name), JSON.stringify(obj));
const outHtml = (name, html) => fs.writeFileSync(path.join(dist, name), html);

const doc = (head, body) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>McFly Parapente</title><style>${head}</style></head><body>${body}</body></html>`;

// ---------------------------------------------------------------------------------------------------
// Corps HTML en tables + styles en ligne (GrapesJS, CKEditor 5)
// ---------------------------------------------------------------------------------------------------
function content() {
  return `<table role="presentation" class="mcfly-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${COLORS.white}" style="width:600px;max-width:100%;border-collapse:collapse;background-color:${COLORS.white};">
<tr><td class="mcfly-pad" style="padding:36px 40px 0 40px;">
${paragraph(SAMPLE.greeting)}
${sectionTitle('Les nouvelles de la saison')}
<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
${paragraph(SAMPLE.intro)}
<a href="${SITE}" target="_blank"><img src="${IMG.feature}" alt="L’Aiguille du Midi" width="520" style="display:block;border:0;width:100%;max-width:520px;height:auto;border-radius:6px;"></a>
<h3 style="margin:22px 0 8px 0;font-family:${FONTS.sc};font-variant:small-caps;font-weight:normal;font-size:20px;line-height:26px;letter-spacing:1.5px;color:${COLORS.blue800};">${SAMPLE.featureTitle}</h3>
${paragraph(SAMPLE.featureText)}
${button('Découvrir', LINKS.tandem)}
<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>
${dottedRule()}
<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
</td></tr>
<tr><td class="mcfly-pad" style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${card(SAMPLE.cards[0][0], SAMPLE.cards[0][1], SAMPLE.cards[0][2])}
<td class="mcfly-gap" width="16" style="width:16px;font-size:0;">&nbsp;</td>
${card(SAMPLE.cards[1][0], SAMPLE.cards[1][1], SAMPLE.cards[1][2])}
</tr></table>
</td></tr>
<tr><td class="mcfly-pad" style="padding:28px 40px 36px 40px;">
${promo()}
</td></tr>
</table>`;
}

const page = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.snow}" style="background-color:${COLORS.snow};"><tr><td align="center" style="padding:0 0 24px 0;">
<table role="presentation" class="mcfly-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px;max-width:100%;"><tr><td data-ai-lock="1" align="center" style="padding:14px 0 10px 0;font-family:${FONTS.book};font-size:12px;line-height:16px;color:${COLORS.grey800};"><a href="[LINK_BROWSER]" style="color:${COLORS.grey800};text-decoration:underline;">Voir cet email dans votre navigateur</a></td></tr></table>
${header()}
${content()}
${footer()}
</td></tr></table>`;

// --- GrapesJS (source HTML : <body> + style) -------------------------------------------------------
const css = `${FONT_FACE_CSS}\n${MOBILE_CSS}\n@media only screen and (max-width:620px){.mcfly-gap{display:none!important}}`;
const grapesSource = `<body style="margin:0;padding:0;background-color:${COLORS.snow};">${page()}</body>`;
outJson('grapesjs.json', { sourceType: 'html', source: grapesSource, style: css });
outHtml('grapesjs.preview.html', doc(css, `<div style="margin:0;background:${COLORS.snow}">${page()}</div>`));

// --- CKEditor 5 ---------------------------------------------------------------------------------------
// CKEditor 5 enveloppe les <table> dans des <figure> et les <img> dans des <figure class="image"> : les mises en page
// en tables imbriquées se déforment. On garde donc des tables seulement pour l'en-tête / pied de page (une image
// inline dans un <p> reste en place) et un flux de blocs (h2, p, liens-boutons, div) pour le contenu.
// Pas de <style> non plus (non conservé) : les polices Neutraface retombent sur Avenir / Helvetica hors machines équipées.
const inlineImg = (html) => html.replace(/(<a [^>]*>)?(<img [^>]*>)(<\/a>)?/g, (m, a, img, aEnd) => `<p style="margin:0;font-size:0;line-height:0;">${m}</p>`);
const pad = 'padding-left:40px;padding-right:40px;';
const ckP = (t) => `<p style="margin:0;${pad}padding-bottom:14px;font-family:${FONTS.book};font-size:16px;line-height:25px;color:${COLORS.grey800};">${t}</p>`;
const ckH = (lvl, size, t, top = 0) => `<h${lvl} style="margin:0;${pad}padding-top:${top}px;padding-bottom:8px;font-family:${FONTS.sc};font-variant:small-caps;font-weight:normal;font-size:${size}px;line-height:${size + 6}px;letter-spacing:1.5px;color:${COLORS.blue800};">${t}</h${lvl}>`;
const ckLink = (t, href, bg, fg) => `<p style="margin:0;${pad}padding-bottom:22px;"><a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;border-radius:6px;background-color:${bg};font-family:${FONTS.demi};font-size:15px;line-height:18px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:${fg};">${t}</a></p>`;
const ckSection = (title, text, href) => `<div style="margin:0 40px 18px 40px;padding:6px 0 0 0;border-top:4px solid ${COLORS.yellow500};"><h3 style="margin:0;padding:12px 0 6px 0;font-family:${FONTS.sc};font-variant:small-caps;font-weight:normal;font-size:18px;line-height:24px;letter-spacing:1.5px;color:${COLORS.blue800};">${title}</h3><p style="margin:0;padding-bottom:8px;font-family:${FONTS.book};font-size:15px;line-height:22px;color:${COLORS.grey800};">${text}</p><p style="margin:0;"><a href="${href}" target="_blank" style="font-family:${FONTS.demi};font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:${COLORS.blue100};">En savoir plus &rarr;</a></p></div>`;
const ckPage = () => `<div style="background-color:${COLORS.snow};padding:0 0 24px 0;">
<p data-ai-lock="1" style="margin:0;padding:14px 0 10px 0;text-align:center;font-family:${FONTS.book};font-size:12px;line-height:16px;color:${COLORS.grey800};"><a href="[LINK_BROWSER]" style="color:${COLORS.grey800};text-decoration:underline;">Voir cet email dans votre navigateur</a></p>
${inlineImg(header())}
<div style="background-color:${COLORS.white};max-width:600px;margin:0 auto;padding:36px 0 36px 0;">
${ckP(SAMPLE.greeting)}
${ckH(2, 22, '<span style="color:' + COLORS.yellow500 + ';">&#9733;</span>&nbsp;Les nouvelles de la saison')}
${ckP(SAMPLE.intro)}
${inlineImg(`<a href="${SITE}" target="_blank"><img src="${IMG.feature}" alt="L’Aiguille du Midi" width="520" style="display:block;border:0;width:520px;max-width:100%;height:auto;border-radius:6px;"></a>`).replace('margin:0;', 'margin:0;' + pad)}
${ckH(3, 20, SAMPLE.featureTitle, 22)}
${ckP(SAMPLE.featureText)}
${ckLink('Découvrir', LINKS.tandem, COLORS.yellow500, COLORS.blue800)}
<hr style="margin:6px 40px 22px 40px;border:0;border-top:2px dotted ${COLORS.grey100};">
${ckSection(SAMPLE.cards[0][0], SAMPLE.cards[0][1], SAMPLE.cards[0][2])}
${ckSection(SAMPLE.cards[1][0], SAMPLE.cards[1][1], SAMPLE.cards[1][2])}
<div style="margin:24px 40px 0 40px;padding:30px 28px;border-radius:8px;background-color:${COLORS.blue800};text-align:center;"><p style="margin:0;padding-bottom:10px;font-family:${FONTS.sc};font-variant:small-caps;font-size:26px;line-height:32px;letter-spacing:2px;color:${COLORS.yellow500};">Offre de saison</p><p style="margin:0;padding-bottom:20px;font-family:${FONTS.book};font-size:16px;line-height:24px;color:${COLORS.white};">Réservez votre vol en parapente biplace au cœur du massif du Mont-Blanc.</p><p style="margin:0;"><a href="${LINKS.prices}" target="_blank" style="display:inline-block;padding:13px 26px;border-radius:6px;background-color:${COLORS.yellow500};font-family:${FONTS.demi};font-size:15px;line-height:18px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:${COLORS.blue800};">Réserver</a></p></div>
</div>
${inlineImg(footer())}
</div>`;
outJson('ckeditor5.json', { source: ckPage() });
outHtml('ckeditor5.preview.html', doc('', ckPage()));

// --- Mosaico ---------------------------------------------------------------------------------------
const mosaico = buildMosaico();
outHtml('mosaico-template.html', mosaico);
outHtml('mosaico.static.html', staticFromMosaico(mosaico));

// --- EmailBuilder (JSON waypoint) -------------------------------------------------------------------
const P = (top, right, bottom, left) => ({ top, right, bottom, left });
const blocks = {
  'block-browser': {
    type: 'Html',
    data: { style: { color: COLORS.grey800, fontSize: 12, textAlign: 'center', fontFamily: 'GEOMETRIC_SANS', padding: P(14, 24, 10, 24) }, props: { contents: '<div data-ai-lock="1"><a href="[LINK_BROWSER]" style="color:#4e5861;text-decoration:underline">Voir cet email dans votre navigateur</a></div>' } },
  },
  'block-header': {
    type: 'Html',
    data: { style: { padding: P(0, 0, 0, 0) }, props: { contents: `<style>${FONT_FACE_CSS}${MOBILE_CSS}</style>${header()}` } },
  },
  'block-greeting': {
    type: 'Text',
    data: { style: { color: COLORS.grey800, fontSize: 16, fontFamily: 'GEOMETRIC_SANS', padding: P(0, 0, 14, 0) }, props: { text: SAMPLE.greeting } },
  },
  'block-title': {
    type: 'Heading',
    data: { style: { color: COLORS.blue800, fontFamily: 'GEOMETRIC_SANS', fontWeight: 'bold', textAlign: 'left', padding: P(0, 0, 10, 0) }, props: { level: 'h2', text: '★ LES NOUVELLES DE LA SAISON' } },
  },
  'block-intro': {
    type: 'Text',
    data: { style: { color: COLORS.grey800, fontSize: 16, fontFamily: 'GEOMETRIC_SANS', padding: P(0, 0, 16, 0) }, props: { text: SAMPLE.intro } },
  },
  'block-image': {
    type: 'Image',
    data: { style: { padding: P(0, 0, 0, 0), textAlign: 'center' }, props: { url: IMG.feature, alt: 'L’Aiguille du Midi', linkHref: SITE, contentAlignment: 'middle' } },
  },
  'block-feature-title': {
    type: 'Heading',
    data: { style: { color: COLORS.blue800, fontFamily: 'GEOMETRIC_SANS', fontWeight: 'bold', textAlign: 'left', padding: P(22, 0, 8, 0) }, props: { level: 'h3', text: SAMPLE.featureTitle.toUpperCase() } },
  },
  'block-feature-text': {
    type: 'Text',
    data: { style: { color: COLORS.grey800, fontSize: 16, fontFamily: 'GEOMETRIC_SANS', padding: P(0, 0, 16, 0) }, props: { text: SAMPLE.featureText } },
  },
  'block-feature-button': {
    type: 'Button',
    data: { style: { fontFamily: 'GEOMETRIC_SANS', fontWeight: 'bold', textAlign: 'left', padding: P(0, 0, 24, 0) }, props: { text: 'DÉCOUVRIR', url: LINKS.tandem, buttonBackgroundColor: COLORS.yellow500, buttonTextColor: COLORS.blue800, buttonStyle: 'rounded', size: 'medium', fullWidth: false } },
  },
  'block-divider': {
    type: 'Divider',
    data: { style: { padding: P(8, 0, 18, 0) }, props: { lineColor: COLORS.grey100, lineHeight: 2 } },
  },
  'block-cards': {
    type: 'ColumnsContainer',
    data: {
      style: { padding: P(0, 0, 0, 0) },
      props: { columnsCount: 2, columnsGap: 16, contentAlignment: 'top', columns: [{ childrenIds: ['card1-title', 'card1-text', 'card1-button'] }, { childrenIds: ['card2-title', 'card2-text', 'card2-button'] }, { childrenIds: [] }] },
    },
  },
  'block-promo': {
    type: 'Html',
    data: { style: { padding: P(28, 0, 0, 0) }, props: { contents: promo() } },
  },
};
SAMPLE.cards.forEach(([title, text, href], i) => {
  const n = i + 1;
  blocks[`card${n}-title`] = { type: 'Heading', data: { style: { color: COLORS.blue800, fontFamily: 'GEOMETRIC_SANS', fontWeight: 'bold', textAlign: 'left', padding: P(0, 0, 6, 0) }, props: { level: 'h3', text: title.toUpperCase() } } };
  blocks[`card${n}-text`] = { type: 'Text', data: { style: { color: COLORS.grey800, fontSize: 15, fontFamily: 'GEOMETRIC_SANS', padding: P(0, 0, 10, 0) }, props: { text } } };
  blocks[`card${n}-button`] = { type: 'Button', data: { style: { fontFamily: 'GEOMETRIC_SANS', fontWeight: 'bold', textAlign: 'left', padding: P(0, 0, 0, 0) }, props: { text: 'EN SAVOIR PLUS', url: href, buttonBackgroundColor: COLORS.blue800, buttonTextColor: COLORS.white, buttonStyle: 'rounded', size: 'small', fullWidth: false } } };
});
blocks['block-body'] = {
  type: 'Container',
  data: {
    style: { backgroundColor: COLORS.white, padding: P(36, 40, 36, 40) },
    props: { childrenIds: ['block-greeting', 'block-title', 'block-intro', 'block-image', 'block-feature-title', 'block-feature-text', 'block-feature-button', 'block-divider', 'block-cards', 'block-promo'] },
  },
};
blocks['block-footer'] = { type: 'Html', data: { style: { padding: P(0, 0, 0, 0) }, props: { contents: footer() } } };

const emailbuilder = {
  root: {
    type: 'EmailLayout',
    data: {
      backdropColor: COLORS.snow,
      canvasColor: COLORS.white,
      textColor: COLORS.grey800,
      fontFamily: 'GEOMETRIC_SANS',
      childrenIds: ['block-browser', 'block-header', 'block-body', 'block-footer'],
    },
  },
  ...blocks,
};
outJson('emailbuilder.json', emailbuilder);
const ebHtml = renderToStaticMarkup(emailbuilder, { rootBlockId: 'root' });
outHtml('emailbuilder.preview.html', ebHtml);

console.log('Modèles écrits dans', dist);
