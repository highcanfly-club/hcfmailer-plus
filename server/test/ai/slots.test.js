import { expect } from 'chai';
import { extractSlots, prepare, validateReply } from '../../lib/ai/slots.js';

describe('AI slots', () => {
    it('extracts text blocks of an HTML source and keeps the markup', () => {
        const html = '<body style="x"><table><tr><td><h2 style="c">Titre</h2><p>Bonjour [MERGE_FIRST_NAME], <a href="https://a.b/c">lien</a> ici.</p></td></tr></table><div data-ai-lock="1"><p>Mentions légales</p></div></body>';
        const { slots, apply } = extractSlots('grapesjs', html);
        expect(slots.map(s => s.kind)).to.deep.equal(['heading', 'text']);
        const texts = new Map([[slots[0].id, 'Nouveau titre']]);
        const out = apply(texts);
        expect(out).to.contain('<body style="x">').and.to.contain('Nouveau titre').and.to.contain('Mentions légales');
        expect(out).to.contain('href="https://a.b/c"');
    });

    it('masks merge tags and rejects replies that lose them or alter links', () => {
        const { slots } = extractSlots('ckeditor5', '<p>Bonjour [MERGE_FIRST_NAME], <a href="https://a.b">voir</a></p>');
        const [slot] = prepare(slots);
        expect(slot.masked).to.contain('§1§');
        expect(validateReply(slot, 'Salut §1§, <a href="https://a.b">voir</a>')).to.equal('Salut [MERGE_FIRST_NAME], <a href="https://a.b">voir</a>');
        expect(validateReply(slot, 'Salut, <a href="https://a.b">voir</a>')).to.equal(null);
        expect(validateReply(slot, 'Salut §1§, <a href="https://evil.example">voir</a>')).to.equal(null);
        expect(validateReply(slot, 'Salut §1§, <a href="https://a.b" onmouseover="alert(1)">voir</a>')).to.equal(null);
        expect(validateReply(slot, 'Salut §1§, <a style="x:y" href="https://a.b">voir</a>')).to.equal(null);
        expect(validateReply(slot, 'Salut §1§, <a href=\'https://a.b\'>voir</a>')).to.not.equal(null); // quotes may change, not the attributes
    });

    it('handles Email Builder documents, including Html blocks', () => {
        const doc = {
            root: { type: 'EmailLayout', data: { childrenIds: ['a', 'b', 'c', 'd'] } },
            a: { type: 'Heading', data: { props: { text: 'Hello world', level: 'h2' } } },
            b: { type: 'Text', data: { props: { text: 'Un paragraphe <b>gras</b>.' } } },
            c: { type: 'Image', data: { props: { url: 'x', alt: 'Une image' } } },
            d: { type: 'Html', data: { props: { contents: '<div data-ai-lock="1"><p>Fixe</p></div><p>Variable</p>' } } }
        };
        const { slots, apply } = extractSlots('emailbuilder', JSON.stringify(doc));
        expect(slots.map(s => s.id)).to.deep.equal(['a.text', 'b.text', 'c.alt', 'd#1']);
        const out = JSON.parse(apply(new Map([['a.text', 'Bonjour'], ['d#1', 'Changé']])));
        expect(out.a.data.props.text).to.equal('Bonjour');
        expect(out.d.data.props.contents).to.contain('Fixe').and.to.contain('Changé');
    });
});
