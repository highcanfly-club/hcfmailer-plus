// Charte graphique "McFly Parapente & Speedriding"
// Source : site lesailesdumontblanc (tailwind.config.ts, PricesPage.vue, MainFooter.vue, locales/fr-FR.json)

export const COLORS = {
  blue800: '#1e2470', // ambblue-800 "Léo dark" : titres, fond sombre, pied de page
  blue100: '#008adc', // ambblue-100 "Léo light" : liens, accents
  yellow500: '#ffed00', // ambyel-500 "Léo yel" : étoiles, boutons
  red500: '#d90012', // ambred-500 "Léo red"
  grey800: '#4e5861', // ambgrey-800 : texte courant
  grey600: '#8b8b8a', // ambgrey-600 "Léo grey"
  grey100: '#949ea7', // ambgrey-100 "Léo grey light"
  snow: '#e8ebec', // neige de aiguille_et_arrette.svg : fond de page
  white: '#ffffff',
};

// Neutraface Text (police du site). Les .woff2 sont servis par [URL_BASE]/static/mcfly/fonts.
// Les familles de repli (Avenir / Helvetica) ont un gabarit géométrique proche.
const FALLBACK = 'Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';
export const FONTS = {
  book: `NeutrafaceText-Book, ${FALLBACK}`,
  demi: `NeutrafaceText-Demi, ${FALLBACK}`,
  sc: `NeutrafaceText-BoldSC, ${FALLBACK}`, // titres du site : font-neutra-boldsc tracking-wider
};

export const SITE = 'https://mcfly-parapente.com';
export const LINKS = {
  tandem: `${SITE}/tandem-page`,
  stages: `${SITE}/stages`,
  speedriding: `${SITE}/stage-speedriding`,
  prices: `${SITE}/prices`,
};
export const ASSETS = '[URL_BASE]/static/mcfly';
export const IMG = {
  header: `${ASSETS}/img/header-aiguille.jpg`,
  feature: `${ASSETS}/img/feature-aiguille.jpg`,
  logoWhite: `${ASSETS}/img/logo-origami-white.png`,
  logoBlack: `${ASSETS}/img/logo-origami-black.png`,
};

// Données du pied de page du site (MainFooter.vue + fr-FR.json + social.json)
export const FOOTER = {
  company: 'McFly Parapente & Speedriding',
  address: ['siège social', '224, route des Tissières', '74400 Chamonix'],
  phone: '+33 (0) 6 20 46 55 57',
  phoneHref: 'tel:+33620465557',
  email: 'info@mcfly-parapente.com',
  minibio: 'Animée par Jérémy Picq, Hugues Bourdelle, Cyrilde Picq, Arthur Moindrot et Jean-Marc Benezech…',
  disclaimer: 'syndicat local siret:43859306300045 label ffvl:N°03940 agréement jeunesse et sports ET000173',
  social: [
    ['Facebook', 'https://www.facebook.com/mcfly.parapente.speedriding/'],
    ['Instagram', 'https://www.instagram.com/mcfly_parapente_et_speedriding/'],
    [
      'Tripadvisor',
      'https://www.tripadvisor.com/Attraction_Review-g187261-d1008501-Reviews-Les_Ailes_du_Mont_Blanc-Chamonix_Haute_Savoie_Auvergne_Rhone_Alpes.html',
    ],
  ],
  legal: [
    ['Politique de confidentialité', `${SITE}/policy?lang=fr-FR`],
    ['Conditions générales de vente', `${SITE}/cgv?lang=fr-FR`],
  ],
  ffvl: ['FFVL', 'https://federation.ffvl.fr/structure/471'],
};

// @font-face à placer dans le <head> (Mosaico, EmailBuilder, GrapesJS) : seuls Apple Mail, iOS, etc. chargent des polices web
export const FONT_FACE_CSS = [
  ['NeutrafaceText-Book', 'Book'],
  ['NeutrafaceText-Demi', 'Demi'],
  ['NeutrafaceText-BoldSC', 'BoldSC'],
]
  .map(
    ([family, file]) =>
      `@font-face{font-family:'${family}';font-style:normal;font-weight:normal;src:url('${ASSETS}/fonts/NeutrafaceText-${file}.woff2') format('woff2');}`
  )
  .join('\n');

export const MOBILE_CSS = `
@media only screen and (max-width:620px){
  .mcfly-container{width:100%!important}
  .mcfly-col{display:block!important;width:100%!important;max-width:100%!important}
  .mcfly-header{background-size:cover!important}
  .mcfly-pad{padding-left:20px!important;padding-right:20px!important}
  .mcfly-kicker{font-size:11px!important;letter-spacing:2px!important}
  .mcfly-title{font-size:22px!important;line-height:26px!important;letter-spacing:.5px!important}
}
@media only screen and (max-width:380px){
  .mcfly-title{font-size:18px!important;line-height:22px!important}
  .mcfly-logo{width:84px!important;height:auto!important}
}
@media only screen and (max-width:340px){
  .mcfly-title{font-size:16px!important;line-height:20px!important}
}`;

// ---------------------------------------------------------------------------------------------------
// Fragments HTML (styles en ligne, tables) utilisés par GrapesJS, CKEditor 5 et les blocs Html d'EmailBuilder
// ---------------------------------------------------------------------------------------------------

const star = `<span style="color:${COLORS.yellow500};">&#9733;</span>&nbsp;`;

export function header({ kicker = 'Newsletter', title = 'Les nouvelles de McFly' } = {}) {
  return `<table role="presentation" class="mcfly-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px;max-width:100%;border-collapse:collapse;">
<tr><td class="mcfly-header" background="${IMG.header}" bgcolor="${COLORS.blue800}" valign="top" height="260" style="height:260px;background-color:${COLORS.blue800};background-image:url('${IMG.header}');background-repeat:no-repeat;background-position:center bottom;background-size:600px 260px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="mcfly-pad" valign="top" width="130" style="padding:24px 0 0 28px;"><a href="${SITE}" target="_blank"><img class="mcfly-logo" src="${IMG.logoWhite}" alt="McFly parapente" width="110" style="display:block;border:0;width:110px;height:auto;"></a></td>
<td class="mcfly-pad" valign="top" align="right" style="padding:30px 28px 0 0;">
<div class="mcfly-kicker" style="font-family:${FONTS.demi};font-size:12px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.yellow500};">${kicker}</div>
<div class="mcfly-title" style="font-family:${FONTS.sc};font-variant:small-caps;font-size:28px;font-size:clamp(19px,6.2vw,28px);line-height:32px;letter-spacing:1px;color:${COLORS.white};padding-top:4px;">${title}</div>
</td></tr></table>
</td></tr></table>`;
}

export function dottedRule() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 0;border-top:2px dotted ${COLORS.grey100};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

export function sectionTitle(text) {
  return `<h2 style="margin:0;font-family:${FONTS.sc};font-variant:small-caps;font-weight:normal;font-size:22px;line-height:28px;letter-spacing:1.5px;color:${COLORS.blue800};">${star}${text}</h2>`;
}

export function paragraph(text) {
  return `<p style="margin:0 0 14px 0;font-family:${FONTS.book};font-size:16px;line-height:25px;color:${COLORS.grey800};">${text}</p>`;
}

export function button(text, href, { primary = true } = {}) {
  const bg = primary ? COLORS.yellow500 : COLORS.blue800;
  const fg = primary ? COLORS.blue800 : COLORS.white;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" style="border-radius:6px;background-color:${bg};"><a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONTS.demi};font-size:15px;line-height:18px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:${fg};">${text}</a></td></tr></table>`;
}

export function card(title, text, href) {
  return `<td class="mcfly-col" width="252" valign="top" style="width:252px;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.snow};border-top:4px solid ${COLORS.yellow500};border-radius:6px;"><tr><td style="padding:18px 18px 20px 18px;">
<h3 style="margin:0 0 8px 0;font-family:${FONTS.sc};font-variant:small-caps;font-weight:normal;font-size:18px;line-height:24px;letter-spacing:1.5px;color:${COLORS.blue800};">${title}</h3>
<p style="margin:0 0 12px 0;font-family:${FONTS.book};font-size:15px;line-height:22px;color:${COLORS.grey800};">${text}</p>
<a href="${href}" target="_blank" style="font-family:${FONTS.demi};font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:${COLORS.blue100};">En savoir plus &rarr;</a>
</td></tr></table></td>`;
}

export function promo({ title = 'Offre de saison', text = 'Réservez votre vol en parapente biplace au cœur du massif du Mont-Blanc.', cta = 'Réserver', href = LINKS.prices } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.blue800}" style="background-color:${COLORS.blue800};border-radius:8px;"><tr><td align="center" style="padding:30px 28px;">
<div style="font-family:${FONTS.sc};font-variant:small-caps;font-size:26px;line-height:32px;letter-spacing:2px;color:${COLORS.yellow500};">${title}</div>
<p style="margin:10px 0 20px 0;font-family:${FONTS.book};font-size:16px;line-height:24px;color:${COLORS.white};">${text}</p>
${button(cta, href, { primary: true })}
</td></tr></table>`;
}

export function footer() {
  const f = FOOTER;
  const link = (label, href) =>
    `<a href="${href}" target="_blank" style="color:${COLORS.white};text-decoration:none;">${label}</a>`;
  const items = (list) => list.map(([l, h]) => `<div style="padding:0 0 8px 0;">${link(l, h)}</div>`).join('');
  const h = (t) =>
    `<div style="font-family:${FONTS.demi};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.yellow500};padding:0 0 12px 0;">${t}</div>`;
  const text = `font-family:${FONTS.book};font-size:13px;line-height:20px;color:#c9cdea;`;
  return `<table role="presentation" data-ai-lock="1" class="mcfly-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${COLORS.blue800}" style="width:600px;max-width:100%;border-collapse:collapse;background-color:${COLORS.blue800};">
<tr><td class="mcfly-pad" style="padding:32px 28px 8px 28px;${text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="mcfly-col" valign="top" width="200" style="width:200px;padding:0 0 20px 0;${text}">
<a href="${SITE}" target="_blank"><img src="${IMG.logoWhite}" alt="${f.company}" width="96" style="display:block;border:0;width:96px;height:auto;"></a>
<div style="padding-top:14px;">${f.address.join('<br>')}</div>
<div style="padding-top:10px;"><a href="${f.phoneHref}" style="color:${COLORS.white};text-decoration:none;">${f.phone}</a><br><a href="mailto:${f.email}" style="color:${COLORS.white};text-decoration:none;">${f.email}</a></div>
</td>
<td class="mcfly-col" valign="top" width="170" style="width:170px;padding:0 0 20px 0;${text}">${h('Suivez-nous')}${items(f.social)}</td>
<td class="mcfly-col" valign="top" style="padding:0 0 20px 0;${text}">${h('Légal')}${items(f.legal)}${items([f.ffvl])}</td>
</tr></table>
</td></tr>
<tr><td class="mcfly-pad" style="padding:0 28px 6px 28px;${text}font-size:12px;">${f.minibio}</td></tr>
<tr><td class="mcfly-pad" style="padding:14px 28px 0 28px;"><div style="border-top:1px solid #3a4190;font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td class="mcfly-pad" style="padding:14px 28px 4px 28px;${text}font-size:12px;">${f.disclaimer}</td></tr>
<tr><td class="mcfly-pad" style="padding:0 28px 28px 28px;${text}font-size:12px;">&copy; Copyright 2018-2026 ${f.company} - Tous droits r&eacute;serv&eacute;s.<br>
<a href="[LINK_PREFERENCES]" style="color:${COLORS.white};">G&eacute;rer mes pr&eacute;f&eacute;rences</a> &nbsp;|&nbsp; <a href="[LINK_UNSUBSCRIBE]" style="color:${COLORS.white};">Se d&eacute;sinscrire</a></td></tr>
</table>`;
}

export const SAMPLE = {
  greeting: 'Bonjour [FIRST_NAME],',
  intro: 'Les conditions sont au rendez-vous au-dessus de la vallée de Chamonix : voici les nouvelles de la saison, nos prochaines dates de stages et les idées de vols du moment.',
  featureTitle: 'Vol biplace au cœur du Mont-Blanc',
  featureText: 'Décollez de Planpraz ou du Brévent et survolez l’Aiguille du Midi, la mer de Glace et la vallée de Chamonix en toute sécurité avec nos pilotes diplômés d’État.',
  cards: [
    ['Stages collectifs', 'Initiation et perfectionnement en petit groupe, du premier gonflage au vol autonome.', LINKS.stages],
    ['Speedriding', 'Glisse et vol en montagne : stages d’initiation et sorties encadrées par nos moniteurs.', LINKS.speedriding],
  ],
};
