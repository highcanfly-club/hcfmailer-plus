import { expect } from 'chai';
import { build, sanitizeCss } from '../../lib/ai/responsive.js';

describe('AI responsive', () => {
    const html = '<body style="x"><table><tr><td><div class="title" style="font-size:28px">Les nouvelles de McFly Parapente et Speedriding</div></td></tr></table></body>';

    it('annotates elements and builds a digest without images or long text', () => {
        const { digest, ids } = build('grapesjs', html, '.a{color:red}');
        expect(digest).to.contain('data-ai-r="3"').and.to.contain('font-size:28px');
        expect(ids.has('1')).to.equal(true);
    });

    it('accepts media rules on known elements and forces !important', () => {
        const { ids } = build('grapesjs', html, '');
        const ok = sanitizeCss('@media only screen and (max-width:480px){ [data-ai-r="3"]{ font-size: 20px; line-height:24px } .title{letter-spacing:.5px} }', ids);
        expect(ok.css).to.contain('font-size:20px!important').and.to.contain('line-height:24px!important');
        expect([...ok.used]).to.deep.equal(['3']);
    });

    it('rejects anything outside the whitelist', () => {
        const { ids } = build('grapesjs', html, '');
        const bad = [
            '@media (max-width:480px){ [data-ai-r="3"]{ background:url(http://evil/x) } }',
            '@media (max-width:480px){ [data-ai-r="3"]{ color:red } }',
            '@media (max-width:480px){ [data-ai-r="999"]{ font-size:10px } }',
            '@media (max-width:480px){ body{ font-size:10px } }',
            '@import url(x); @media (max-width:480px){ .title{font-size:10px} }',
            'body{font-size:10px}',
            '@media (max-width:480px){ .title{font-size:10px} } </style><script>alert(1)</script>'
        ];
        bad.forEach(css => expect(sanitizeCss(css, ids), css).to.equal(null));
    });

    it('keeps valid rules when one selector targets an unknown element, and accepts h1-h3 tags', () => {
        const { ids } = build('grapesjs', html, '');
        const warnings = [];
        const ok = sanitizeCss('@media (max-width:430px){ [data-ai-r="3"],[data-ai-r="block-title"]{ font-size:20px } h2{font-size:18px} [data-ai-r="nope"]{font-size:9px} }', ids, w => warnings.push(w));
        expect(ok.css).to.contain('[data-ai-r="3"]{font-size:20px!important}').and.to.contain('h2{font-size:18px!important}').and.to.not.contain('nope');
        expect(warnings).to.have.length(2);
        expect(sanitizeCss('@media (max-width:430px){ [data-ai-r="nope"]{ font-size:9px } }', ids)).to.equal(null);
    });

    it('writes the rules into a dedicated Email Builder block, replacing a previous one', () => {
        const doc = { root: { type: 'EmailLayout', data: { childrenIds: ['h'] } }, h: { type: 'Html', data: { props: { contents: '<div class="t">Titre</div>' } } } };
        const { ids, apply } = build('emailbuilder', JSON.stringify(doc));
        const { css, used } = sanitizeCss('@media (max-width:480px){ [data-ai-r="h_1"]{ font-size:18px } }', ids);
        const first = JSON.parse(apply(css, used).source);
        expect(first.root.data.childrenIds).to.deep.equal(['ai-responsive-css', 'h']);
        const again = build('emailbuilder', JSON.stringify(first));
        const second = JSON.parse(again.apply(css, used).source);
        expect(second.root.data.childrenIds.filter(i => i === 'ai-responsive-css')).to.have.length(1);
        expect(second.h.data.props.contents).to.contain('data-ai-r="h_1"');
    });
});
