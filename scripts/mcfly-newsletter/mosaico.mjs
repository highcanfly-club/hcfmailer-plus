// Génère le modèle Mosaico "McFly parapente" (même mécanique que versafix-1 : blocs -ko-, thèmes, valeurs par défaut en ligne)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, FONTS, FONT_FACE_CSS, MOBILE_CSS, IMG, SITE, LINKS, FOOTER, SAMPLE } from './brand.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const versafix = fs.readFileSync(path.join(here, '../../client/static/mosaico/templates/versafix-1/template-versafix-1.html'), 'utf8').split('\n');

// Définitions génériques des propriétés (size, color, face, buttonStyle, blockSpacing, hrStyle...) reprises de versafix-1
const defsStart = versafix.findIndex((l) => l.trim() === 'id { widget: id }');
const defsEnd = versafix.findIndex((l) => l.includes('/* contents */'));
let genericDefs = versafix.slice(defsStart, defsEnd).join('\n');

const faceOptions = [
  [FONTS.book, 'Neutraface Book'],
  [FONTS.demi, 'Neutraface Demi'],
  [FONTS.sc, 'Neutraface Bold SC'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Georgia, serif', 'Georgia'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
]
  .map(([v, l]) => `${v}=${l}`)
  .join('|');
genericDefs = genericDefs.replace(/face \{ label: Font; widget: select; options: [^\n]*\n/, `face { label: Font; widget: select; options: ${faceOptions};\n`);
if (!genericDefs.includes(faceOptions)) throw new Error('face definition not replaced');

const frame = COLORS.snow;

// Remplissages communs (liés aux propriétés blockSpacing / thèmes de versafix)
const vpad = '-ko-padding: @[blockSpacing.horizontalSpacing]px; -ko-padding-top: @[blockSpacing.verticalSpacing]px; -ko-padding-bottom: @[blockSpacing.verticalSpacing]px;';
const rowPad = '-ko-padding-top: @[blockSpacing.topPadding]px; -ko-padding-bottom: @[blockSpacing.bottomPadding]px;';

function block(name, inner, { bg = COLORS.white, themeBg = true } = {}) {
  return `
    <!-- ${name} -->
    <table role="presentation" class="vb-outer" width="100%" cellpadding="0" border="0" cellspacing="0" bgcolor="${frame}" style="background-color: ${frame}; -ko-background-color: @[externalBackgroundColor]; -ko-attr-bgcolor: @[externalBackgroundColor]" data-ko-block="${name}">
      <tr><td class="vb-outer" align="center" valign="top" style="padding-left: 9px; padding-right: 9px; font-size: 0">
      <!--[if (gte mso 9)|(lte ie 8)]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td align="center" valign="top"><![endif]--><!--
      --><div style="margin: 0 auto; max-width: 600px; -mru-width: 0px"><table role="presentation" class="vb-row mcfly-container" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; background-color: ${bg}; ${themeBg ? '-ko-background-color: @[backgroundColor]; -ko-attr-bgcolor: @[backgroundColor];' : ''} max-width: 600px; -mru-width: 0px" bgcolor="${bg}" width="600">
${inner}
      </table></div><!--
    --><!--[if (gte mso 9)|(lte ie 8)]></td></tr></table><![endif]-->
    </td></tr>
    </table>
    <!-- /${name} -->
`;
}

const cell = (style, binding, attrs, content) =>
  `<td ${attrs} style="${style} ${binding}">${content}</td>`;

const titleStyleBind = (s) => `-ko-font-size: @[${s}.size]px; -ko-color: @${s}.color; -ko-font-family: @${s}.face; -ko-text-align: @${s}.align; -ko-attr-align: @${s}.align`;
const textStyleBind = (s) => `-ko-font-size: @[${s}.size]px; -ko-color: @${s}.color; -ko-font-family: @${s}.face; -ko-text-align: @${s}.align; -ko-attr-align: @${s}.align; -ko-line-height: @[${s}.lineHeight]`;

const button = (variant, dataLink = 'buttonLink', defaultText = 'EN SAVOIR PLUS', href = '') => `<table role="presentation" cellpadding="6" border="0" align="left" cellspacing="0" style="border-spacing: 0; mso-padding-alt: 13px 26px 13px 26px; margin-top: 2px; -ko-attr-cellpadding: @[Math.min(${variant}.verticalPadding, ${variant}.horizontalPadding)]; -ko-mso-padding-alt: @[${variant}.verticalPadding]px @[${variant}.horizontalPadding]px @[${variant}.verticalPadding]px @[${variant}.horizontalPadding]px; -ko-attr-align: @${variant}.align"><tr>
        <td width="auto" valign="middle" align="center" style="text-align:center; font-weight: normal; padding: 13px; padding-left: 26px; padding-right: 26px; background-color: ${COLORS.yellow500}; color: ${COLORS.blue800}; font-size: 15px; font-family: ${FONTS.demi}; letter-spacing: 1px; border-radius: 6px; border: 0px solid ${COLORS.blue800}; -ko-border-radius: @[${variant}.radius]px; -ko-attr-bgcolor: @${variant}.buttonColor; -ko-background-color: @${variant}.buttonColor; -ko-border: @[${variant}.borderWidth]px solid @${variant}.borderColor; -ko-border-if: ${variant}.borderWidth > 0; -ko-padding: @[${variant}.verticalPadding]px; -ko-padding-left: @[${variant}.horizontalPadding]px; -ko-padding-right: @[${variant}.horizontalPadding]px; -ko-font-size: @[${variant}.size]px; -ko-color: @${variant}.color; -ko-font-family: @${variant}.face" bgcolor="${COLORS.yellow500}"><a href="${href}" style="text-decoration: none; font-weight: normal; color: ${COLORS.blue800}; font-size: 15px; font-family: ${FONTS.demi}; -ko-font-size: @[${variant}.size]px; -ko-color: @${variant}.color; -ko-font-family: @${variant}.face; -ko-attr-href: @${dataLink}.url"><span data-ko-wrap="false" data-ko-editable="${dataLink}.text" style="text-transform: uppercase;">${defaultText}</span></a></td>
      </tr></table>`;

const star = `<span style="color: ${COLORS.yellow500};">&#9733;</span>&nbsp;`;
const imgTag = (src, width, h, extra = '', href = '') =>
  `<a href="${href}" style="display: inline-block;" data-ko-link="${extra}image.url"><img alt="" border="0" hspace="0" align="center" vspace="0" style="vertical-align:top; height: auto; margin: 0 auto; color: ${COLORS.grey800}; font-size: 16px; font-family: ${FONTS.book}; -ko-font-size: @[longTextStyle.size]px; -ko-color: @longTextStyle.color; -ko-font-family: @longTextStyle.face; -ko-attr-alt: @${extra}image.alt; -ko-attr-alt-if: ${extra}image.alt !== ''; width: 100%; max-width: ${width}px; height: auto" data-ko-editable="${extra}image.src" width="${width}" data-ko-placeholder-height="${h}" src="${src}"></a>`;

const link = (label, href) => `<a href="${href}" style="color: ${COLORS.white}; text-decoration: none;">${label}</a>`;

// --- Blocs ------------------------------------------------------------------------------------------

const preheaderBlock = `
    <!-- preheaderBlock -->
    <table role="presentation" class="vb-outer" width="100%" cellpadding="0" border="0" cellspacing="0" bgcolor="${frame}" style="background-color: ${frame}; -ko-background-color: @[backgroundColor]; -ko-attr-bgcolor: @[backgroundColor]" data-ko-block="preheaderBlock">
      <tr><td class="vb-outer" align="center" valign="top" style="padding-left: 9px; padding-right: 9px; font-size: 0">
      <div style="display: none; font-size:1px; line-height: 1px; max-height:0px; max-width: 0px; opacity: 0; overflow: hidden; -ko-bind-text: @preheaderText"></div>
      <div style="margin: 0 auto; max-width: 600px; -mru-width: 0px"><table role="presentation" class="vb-row" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; -mru-width: 0px" width="600">
        <tr><td align="center" valign="top" style="padding: 14px 9px 10px 9px; font-weight: normal; color: ${COLORS.grey800}; font-size: 12px; font-family: ${FONTS.book}; text-align: center; -ko-font-size: @[linkStyle.size]px; -ko-color: @linkStyle.color; -ko-font-family: @linkStyle.face"><a href="[LINK_BROWSER]" style="color: ${COLORS.grey800}; text-decoration: underline; -ko-color: @linkStyle.color" data-ko-wrap="false"><span data-ko-editable="webversionText">Voir cet email dans votre navigateur</span></a></td></tr>
      </table></div>
    </td></tr>
    </table>
    <!-- /preheaderBlock -->
`;

const headerInner = `
        <tr><td class="mcfly-header" background="${IMG.header}" bgcolor="${COLORS.blue800}" valign="top" height="260" style="height: 260px; background-color: ${COLORS.blue800}; background-image: url('${IMG.header}'); background-repeat: no-repeat; background-position: center bottom; background-size: 600px 260px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="mcfly-pad" valign="top" width="130" style="padding: 24px 0 0 28px;"><a href="${SITE}" style="display: inline-block;"><img class="mcfly-logo" alt="McFly parapente" border="0" width="110" style="display: block; border: 0; width: 110px; height: auto;" src="${IMG.logoWhite}"></a></td>
            <td class="mcfly-pad" valign="top" align="right" style="padding: 30px 28px 0 0;">
              <div class="mcfly-kicker" style="font-family: ${FONTS.demi}; font-size: 12px; line-height: 16px; letter-spacing: 3px; text-transform: uppercase; color: ${COLORS.yellow500}; -ko-font-size: @[kickerStyle.size]px; -ko-color: @kickerStyle.color; -ko-font-family: @kickerStyle.face"><span data-ko-editable="kickerText">Newsletter</span></div>
              <div class="mcfly-title" style="font-family: ${FONTS.sc}; font-variant: small-caps; font-size: 28px; line-height: 32px; letter-spacing: 1px; color: ${COLORS.white}; padding-top: 4px; -ko-font-size: @[bigTitleStyle.size]px; -ko-color: @bigTitleStyle.color; -ko-font-family: @bigTitleStyle.face"><span data-ko-editable="headerTitle">Les nouvelles de McFly</span></div>
            </td></tr></table>
        </td></tr>`;

const titleInner = `
        <tr><td class="mcfly-pad" align="left" valign="top" style="padding: 8px 40px 8px 40px; padding-top: 8px; padding-bottom: 8px; ${rowPad} font-weight: normal; color: ${COLORS.blue800}; font-size: 22px; font-family: ${FONTS.sc}; font-variant: small-caps; letter-spacing: 1.5px; text-align: left; ${titleStyleBind('sectionTitleStyle')}"><div style="padding-top: 24px;"><span style="font-weight: normal">${star}</span><span style="font-weight: normal" data-ko-editable="text">Les nouvelles de la saison</span></div></td></tr>`;

const textInner = `
        <tr><td class="mcfly-pad long-text links-color" align="left" valign="top" style="padding: 8px 40px 8px 40px; padding-top: 8px; padding-bottom: 8px; ${rowPad} font-weight: normal; color: ${COLORS.grey800}; font-size: 16px; font-family: ${FONTS.book}; text-align: left; line-height: 150%; ${textStyleBind('longTextStyle')}" data-ko-editable="longText"><p>${SAMPLE.greeting}</p><p>${SAMPLE.intro}</p></td></tr>`;

const articleInner = `
        <tr data-ko-display="imageVisible"><td class="mcfly-pad" align="center" valign="top" style="padding: 12px 40px 0 40px; font-size: 0;">${imgTag(IMG.feature, 520, 260, '', LINKS.tandem)}</td></tr>
        <tr data-ko-display="titleVisible"><td class="mcfly-pad" align="left" valign="top" style="padding: 18px 40px 4px 40px; font-weight: normal; color: ${COLORS.blue800}; font-size: 20px; font-family: ${FONTS.sc}; font-variant: small-caps; letter-spacing: 1.5px; text-align: left; ${titleStyleBind('titleTextStyle')}"><span style="font-weight: normal" data-ko-editable="titleText">${SAMPLE.featureTitle}</span></td></tr>
        <tr><td class="mcfly-pad long-text links-color" align="left" valign="top" style="padding: 4px 40px 4px 40px; font-weight: normal; color: ${COLORS.grey800}; font-size: 16px; font-family: ${FONTS.book}; text-align: left; line-height: 150%; ${textStyleBind('longTextStyle')}" data-ko-editable="longText"><p>${SAMPLE.featureText}</p></td></tr>
        <tr data-ko-display="buttonVisible"><td class="mcfly-pad" valign="top" align="left" style="padding: 8px 40px 16px 40px; -ko-attr-align: @buttonStyle.align">${button('buttonStyle', 'buttonLink', 'Découvrir', LINKS.tandem)}</td></tr>`;

const cardCol = (side, title, text, href) => `<!--[if (gte mso 9)|(lte ie 8)]><td align="left" valign="top" width="300"><![endif]--><!--
        --><div style="display:inline-block; vertical-align:top; width: 100%; max-width: 300px; -mru-width: 0px;" class="mcfly-col"><!--
          --><table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%;" width="300" align="left"><tr><td style="padding: 8px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid ${COLORS.snow}; border-top: 4px solid ${COLORS.yellow500}; border-radius: 6px;"><tr><td align="left" valign="top" style="padding: 18px 18px 6px 18px; text-align: left; font-weight: normal; color: ${COLORS.blue800}; font-size: 18px; font-family: ${FONTS.sc}; font-variant: small-caps; letter-spacing: 1.5px; ${titleStyleBind('cardTitleStyle')}"><span style="font-weight: normal" data-ko-editable="${side}Title">${title}</span></td></tr>
            <tr><td class="long-text links-color" align="left" valign="top" style="padding: 0 18px 8px 18px; font-weight: normal; color: ${COLORS.grey800}; font-size: 16px; font-family: ${FONTS.book}; text-align: left; line-height: 150%; ${textStyleBind('longTextStyle')}" data-ko-editable="${side}LongText"><p>${text}</p></td></tr>
            <tr><td align="left" valign="top" style="padding: 0 18px 20px 18px; font-family: ${FONTS.demi}; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;"><a href="${href}" style="text-decoration: none; color: ${COLORS.blue100}; -ko-attr-href: @${side}ButtonLink.url"><span data-ko-wrap="false" data-ko-editable="${side}ButtonLink.text">En savoir plus &rarr;</span></a></td></tr></table>
          </td></tr></table><!--
      --></div><!--[if (gte mso 9)|(lte ie 8)]></td><![endif]-->`;

const doubleInner = `
        <tr><td align="center" valign="top" style="font-size: 0; padding: 8px 28px 8px 28px; padding-top: 8px; padding-bottom: 8px; ${rowPad}"><!--[if (gte mso 9)|(lte ie 8)]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="544"><tr><![endif]--><!--
        -->${cardCol('left', SAMPLE.cards[0][0], SAMPLE.cards[0][1], SAMPLE.cards[0][2])}<!--
        -->${cardCol('right', SAMPLE.cards[1][0], SAMPLE.cards[1][1], SAMPLE.cards[1][2])}<!--
        --><!--[if (gte mso 9)|(lte ie 8)]></tr></table><![endif]--></td></tr>`;

const buttonInner = `
        <tr><td class="mcfly-pad" valign="top" align="left" style="padding: 8px 40px 8px 40px; padding-top: 8px; padding-bottom: 8px; ${rowPad} -ko-attr-align: @bigButtonStyle.align">${button('bigButtonStyle', 'buttonLink', 'Réserver', LINKS.prices)}</td></tr>`;

const promoInner = `
        <tr><td class="mcfly-pad" align="center" valign="top" style="padding: 12px 28px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.blue800}" style="background-color: ${COLORS.blue800}; border-radius: 8px; -ko-background-color: @[promoColor]; -ko-attr-bgcolor: @[promoColor]"><tr><td align="center" style="padding: 30px 28px;">
            <div style="font-family: ${FONTS.sc}; font-variant: small-caps; font-size: 26px; line-height: 32px; letter-spacing: 2px; color: ${COLORS.yellow500}; -ko-font-size: @[promoTitleStyle.size]px; -ko-color: @promoTitleStyle.color; -ko-font-family: @promoTitleStyle.face"><span data-ko-editable="promoTitle">Offre de saison</span></div>
            <div class="long-text links-color" style="margin: 10px 0 20px 0; font-family: ${FONTS.book}; font-size: 16px; line-height: 150%; color: ${COLORS.white}; -ko-font-size: @[promoTextStyle.size]px; -ko-color: @promoTextStyle.color; -ko-font-family: @promoTextStyle.face" data-ko-editable="promoText"><p>Réservez votre vol en parapente biplace au cœur du massif du Mont-Blanc.</p></div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center">${button('promoButtonStyle', 'buttonLink', 'Réserver', LINKS.prices)}</td></tr></table>
          </td></tr></table>
        </td></tr>`;

const hrInner = `
        <tr><td class="mcfly-pad" valign="top" align="center" style="padding: 8px 40px 8px 40px; padding-top: 8px; padding-bottom: 8px; ${rowPad}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-spacing: 0; width: 100%; -ko-width: @[hrStyle.hrWidth]%; -ko-attr-width: @[hrStyle.hrWidth]%"><tr><td width="100%" height="2" style="padding: 0; font-size: 1px; line-height: 2px; max-height: 2px; width: 100%; border-top: 2px dotted ${COLORS.grey100}; overflow: hidden; -ko-border-top: @[hrStyle.hrHeight]px dotted @hrStyle.color; -ko-line-height: @[hrStyle.hrHeight]px; -ko-max-height: @[hrStyle.hrHeight]px">&nbsp;</td></tr></table></td></tr>`;

const footerCols = (list) => list.map(([l, h]) => `<div style="padding: 0 0 8px 0;">${link(l, h)}</div>`).join('');
const fh = (t) => `<div style="font-family: ${FONTS.demi}; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${COLORS.yellow500}; padding: 0 0 12px 0;">${t}</div>`;
const ftext = `font-family: ${FONTS.book}; font-size: 13px; line-height: 20px; color: #c9cdea;`;
const footerBlock = `
    <!-- footerBlock -->
    <table role="presentation" class="vb-outer" width="100%" cellpadding="0" border="0" cellspacing="0" bgcolor="${frame}" style="background-color: ${frame}" data-ko-block="footerBlock">
      <tr><td class="vb-outer" align="center" valign="top" style="padding-left: 9px; padding-right: 9px; font-size: 0">
      <div style="margin: 0 auto; max-width: 600px; -mru-width: 0px"><table role="presentation" class="vb-row mcfly-container" border="0" cellpadding="0" cellspacing="0" width="600" bgcolor="${COLORS.blue800}" style="border-collapse: collapse; width: 100%; max-width: 600px; background-color: ${COLORS.blue800}; -ko-background-color: @[footerBackgroundColor]; -ko-attr-bgcolor: @[footerBackgroundColor]; -mru-width: 0px">
        <tr><td class="mcfly-pad" style="padding: 32px 28px 8px 28px; ${ftext}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="mcfly-col" valign="top" width="200" style="width: 200px; padding: 0 0 20px 0; ${ftext}">
              <a href="${SITE}" style="display: inline-block;"><img alt="${FOOTER.company}" border="0" width="96" style="display: block; border: 0; width: 96px; height: auto;" src="${IMG.logoWhite}"></a>
              <div style="padding-top: 14px; font-size: 13px; line-height: 20px; color: #c9cdea;" data-ko-editable="addressText"><p>${FOOTER.address.join('<br>')}</p></div>
              <div style="padding-top: 10px;"><a href="${FOOTER.phoneHref}" style="color: ${COLORS.white}; text-decoration: none;">${FOOTER.phone}</a><br><a href="mailto:${FOOTER.email}" style="color: ${COLORS.white}; text-decoration: none;">${FOOTER.email}</a></div>
            </td>
            <td class="mcfly-col" valign="top" width="170" style="width: 170px; padding: 0 0 20px 0; ${ftext}">${fh('Suivez-nous')}${footerCols(FOOTER.social)}</td>
            <td class="mcfly-col" valign="top" style="padding: 0 0 20px 0; ${ftext}">${fh('Légal')}${footerCols([...FOOTER.legal, FOOTER.ffvl])}</td>
          </tr></table>
        </td></tr>
        <tr><td class="mcfly-pad" style="padding: 0 28px 6px 28px; ${ftext} font-size: 12px;"><span data-ko-editable="minibioText">${FOOTER.minibio}</span></td></tr>
        <tr><td class="mcfly-pad" style="padding: 14px 28px 0 28px;"><div style="border-top: 1px solid #3a4190; font-size: 0; line-height: 0;">&nbsp;</div></td></tr>
        <tr><td class="mcfly-pad" style="padding: 14px 28px 4px 28px; ${ftext} font-size: 12px;"><span data-ko-editable="disclaimerText">${FOOTER.disclaimer}</span></td></tr>
        <tr><td class="mcfly-pad" style="padding: 0 28px 28px 28px; ${ftext} font-size: 12px;">&copy; Copyright 2018-2026 ${FOOTER.company} - Tous droits r&eacute;serv&eacute;s.<br>
          <a href="[LINK_PREFERENCES]" style="color: ${COLORS.white};" data-ko-wrap="false"><span data-ko-editable="preferencesText">G&eacute;rer mes pr&eacute;f&eacute;rences</span></a> &nbsp;|&nbsp; <a href="[LINK_UNSUBSCRIBE]" style="color: ${COLORS.white};" data-ko-wrap="false"><span data-ko-editable="unsubscribeText">Se d&eacute;sinscrire</span></a></td></tr>
      </table></div>
    </td></tr>
    </table>
    <!-- /footerBlock -->
`;

// --- Définitions de blocs ---------------------------------------------------------------------------

const blockDefs = `
      /* contents */
      preheaderText { label: PreHeader Text; extend: text; help: Ce texte est affiché par certains clients mail comme aperçu du message; }
      webversionText { label: Web Link Text; extend: text; }
      unsubscribeText { label: Unsubscribe Text; extend: text; }
      preferencesText { label: Preferences Text; extend: text; }
      kickerText { label: Kicker; extend: text; }
      headerTitle { label: Title; extend: text; }
      promoTitle { label: Promo Title; extend: text; }
      promoText { label: Promo Text; extend: text; }
      leftTitle { label: Left Title; extend: text; }
      rightTitle { label: Right Title; extend: text; }
      leftLongText { label: Left Text; extend: text }
      rightLongText { label: Right Text; extend: text }
      leftButtonLink { label: Left Link; extend: buttonLink }
      rightButtonLink { label: Right Link; extend: buttonLink }
      addressText { label: Address; extend: text; }
      minibioText { label: Team; extend: text; }
      disclaimerText { label: Legal Notice; extend: text; }
      titleVisible { label: Show Title; extend: visible; }
      buttonVisible { label: Show Button; extend: visible; }
      imageVisible { label: Show Image; extend: visible; }
      promoColor { label: Promo Background; extend: color }
      footerBackgroundColor { label: Footer Background; extend: color }
      promoTextStyle { label: Promo Text; extend: textStyle }
      promoButtonStyle { label: Promo Button; extend: buttonStyle }
      kickerStyle { label: Kicker; extend: textStyle }
      bigTitleStyle { label: Title; properties: face color size align }
      promoTitleStyle { label: Promo Title; properties: face color size align }
      sectionTitleStyle { label: Section Title; extend: textStyle }
      cardTitleStyle { label: Card Title; extend: textStyle }
      titleTextStyle { label: Title; extend: textStyle }
      bigButtonStyle { label: Big Button; extend: buttonStyle }
      longText { label: Paragraph; extend: text }

      contentTheme { label: Main Style; }
      contentTheme:preview { -ko-background-color: @[backgroundColor] }
      frameTheme { label: Frame Style; }
      frameTheme:preview { -ko-background-color: @[backgroundColor] }
      preheaderVisible { label: Show Preheader; extend: visible; help: Le bloc de pré-en-tête est le premier du message : lien vers la version web. }

      template { label: Page; theme: frameTheme; properties: preheaderVisible=true; version: 1.0.0; }
      preheaderBlock { label: Preheader Block; theme: frameTheme; visibility: _root_.preheaderVisible; }
      footerBlock { label: Footer; theme: frameTheme; }

      mcflyHeaderBlock { label: Header; theme: contentTheme; }
      mcflyTitleBlock { label: Section Title; properties: backgroundColor sectionTitleStyle; theme: contentTheme; }
      mcflyTextBlock { label: Text Block; theme: contentTheme; }
      mcflyArticleBlock imageVisible { label: Show Image; extend: visible; }
      mcflyArticleBlock { label: Image/Text Block; properties: backgroundColor titleVisible=true buttonVisible=true imageVisible=true titleTextStyle longTextStyle buttonStyle image titleText longText buttonLink; theme: contentTheme }
      mcflyDoubleBlock { label: 2 Cards Block; properties: backgroundColor cardTitleStyle longTextStyle leftTitle leftLongText leftButtonLink rightTitle rightLongText rightButtonLink; theme: contentTheme }
      mcflyButtonBlock { label: Button Block; properties: backgroundColor bigButtonStyle buttonLink; theme: contentTheme }
      mcflyPromoBlock { label: Promo Block; properties: backgroundColor promoColor promoTitleStyle promoTextStyle promoButtonStyle promoTitle promoText buttonLink; theme: contentTheme }
      mcflyHrBlock { label: Separator Block; properties: hrStyle; theme: contentTheme }

      preheaderBlock:preview,
      mcflyHeaderBlock:preview,
      mcflyTitleBlock:preview,
      mcflyTextBlock:preview,
      mcflyArticleBlock:preview,
      mcflyDoubleBlock:preview,
      mcflyButtonBlock:preview,
      mcflyPromoBlock:preview,
      mcflyHrBlock:preview { -ko-background-color: @[backgroundColor] }
      footerBlock:preview { -ko-background-color: @[footerBackgroundColor] }
`;

const pvStart = versafix.findIndex((l) => l.includes('data-ko-remove'));
const pvEnd = versafix.findIndex((l, i) => i > pvStart && l.includes('</style>'));
const previewStyle = versafix.slice(pvStart, pvEnd + 1);

export function buildMosaico() {
  const body = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="initial-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <title style="-ko-bind-text: @titleText">McFly Parapente & Speedriding</title>
  <style type="text/css">
${FONT_FACE_CSS}
${MOBILE_CSS}
    body { margin: 0; padding: 0; }
    .long-text p { margin: 0 0 14px 0; }
    .long-text p:last-child { margin-bottom: 0; }
    .long-text a, .long-text a:link, .long-text a:visited { color: ${COLORS.blue100}; }
    @media only screen and (max-width: 620px) { .mcfly-gap { display: none !important; } }
  </style>
  <style type="text/css">
    @supports -ko-blockdefs {
${genericDefs}
${blockDefs}
    }
  </style>
${previewStyle.join('\n')}
</head>
<!--[if !(gte mso 15)]-->
<body bgcolor="${frame}" text="${COLORS.grey800}" alink="${COLORS.blue100}" vlink="${COLORS.blue100}" style="background-color: ${frame}; color: ${COLORS.grey800};
  -ko-background-color: @_theme_.frameTheme.backgroundColor; -ko-attr-bgcolor: @_theme_.frameTheme.backgroundColor; -ko-color: @_theme_.frameTheme.longTextStyle.color;
  -ko-attr-text: @_theme_.frameTheme.longTextStyle.color; -ko-attr-alink: @_theme_.frameTheme.longTextStyle.linksColor;
  -ko-attr-vlink: @_theme_.frameTheme.longTextStyle.linksColor"><!--<![endif]--><center>

  <div data-ko-display="preheaderVisible" data-ko-wrap="false">
${preheaderBlock}
  </div>

${block('mcflyHeaderBlock', headerInner, { bg: COLORS.blue800, themeBg: false })}

  <div data-ko-container="main" data-ko-wrap="false">
${block('mcflyTitleBlock', titleInner)}
${block('mcflyTextBlock', textInner)}
${block('mcflyArticleBlock', articleInner)}
${block('mcflyHrBlock', hrInner)}
${block('mcflyDoubleBlock', doubleInner)}
${block('mcflyPromoBlock', promoInner)}
${block('mcflyButtonBlock', buttonInner)}
  </div>
${footerBlock}
</center><!--[if !(gte mso 15)]--></body><!--<![endif]--></html>
`;
  return body;
}

// Version "statique" (sans directives Mosaico) : sert de html par défaut du modèle tant que Mosaico n'a pas exporté
export function staticFromMosaico(html) {
  return html
    .replace(/<style type="text\/css">\s*@supports -ko-blockdefs[\s\S]*?<\/style>/, '')
    .replace(/<style type="text\/css" data-ko-remove="">[\s\S]*?<\/style>/, '')
    .replace(/\s*-ko-[a-z-]+:\s*[^;"]*(?:;|(?="))/g, '')
    .replace(/\s+-ko-attr-[a-z-]+="[^"]*"/g, '')
    .replace(/\s+data-ko-[a-z-]+="[^"]*"/g, '')
    .replace(/\s+data-ko-wrap="false"/g, '')
    .replace(/<title[^>]*>/, '<title>')
    .replace(/style="\s*"/g, '');
}
