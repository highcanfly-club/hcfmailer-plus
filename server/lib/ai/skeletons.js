// Minimal starting points used by "generate" when the editor is empty (the user did not start from a template)
const FOOTER = '<div data-ai-lock="1" style="text-align:center;font-size:12px;color:#777;padding:16px;"><a href="[LINK_PREFERENCES]">Gérer mes préférences</a> | <a href="[LINK_UNSUBSCRIBE]">Se désinscrire</a></div>';

const HTML = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#333;">
<h1 style="font-size:26px;">Titre de la newsletter</h1>
<p style="font-size:16px;line-height:24px;">Introduction de la newsletter.</p>
<h2 style="font-size:20px;">Premier sujet</h2>
<p style="font-size:16px;line-height:24px;">Texte du premier sujet.</p>
<h2 style="font-size:20px;">Second sujet</h2>
<p style="font-size:16px;line-height:24px;">Texte du second sujet.</p>
<p style="font-size:16px;line-height:24px;"><a href="#" style="display:inline-block;padding:12px 24px;background:#1e2470;color:#ffffff;text-decoration:none;border-radius:6px;">En savoir plus</a></p>
${FOOTER}
</div>`;

const P = (top, right, bottom, left) => ({ top, right, bottom, left });
function emailBuilder() {
    return JSON.stringify({
        root: { type: 'EmailLayout', data: { backdropColor: '#F5F5F5', canvasColor: '#FFFFFF', textColor: '#262626', fontFamily: 'MODERN_SANS', childrenIds: ['title', 'intro', 'h1', 't1', 'h2', 't2', 'cta', 'footer'] } },
        title: { type: 'Heading', data: { props: { level: 'h1', text: 'Titre de la newsletter' }, style: { textAlign: 'left', padding: P(24, 24, 8, 24) } } },
        intro: { type: 'Text', data: { props: { text: 'Introduction de la newsletter.' }, style: { padding: P(8, 24, 8, 24) } } },
        h1: { type: 'Heading', data: { props: { level: 'h2', text: 'Premier sujet' }, style: { padding: P(16, 24, 4, 24) } } },
        t1: { type: 'Text', data: { props: { text: 'Texte du premier sujet.' }, style: { padding: P(4, 24, 8, 24) } } },
        h2: { type: 'Heading', data: { props: { level: 'h2', text: 'Second sujet' }, style: { padding: P(16, 24, 4, 24) } } },
        t2: { type: 'Text', data: { props: { text: 'Texte du second sujet.' }, style: { padding: P(4, 24, 8, 24) } } },
        cta: { type: 'Button', data: { props: { text: 'En savoir plus', url: '#', buttonBackgroundColor: '#1e2470', buttonTextColor: '#FFFFFF' }, style: { padding: P(16, 24, 16, 24) } } },
        footer: { type: 'Html', data: { props: { contents: FOOTER }, style: { padding: P(8, 24, 24, 24) } } }
    });
}

function skeleton(editorType) {
    return editorType === 'emailbuilder' ? emailBuilder() : HTML;
}

export { skeleton };
