// Regression smoke test for the third-party libraries the server relies on, exercised the way the application uses them.
// Run before and after updating dependencies:  set -a && source ../.env.dev && set +a && NODE_ENV=development npx mocha test/lib-smoke.test.js
import { expect } from 'chai';
import { Readable } from 'stream';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import libmime from 'libmime';
import { parse } from 'csv-parse';
import mjml2html from 'mjml';
import { htmlToText } from 'html-to-text';
import * as he from 'he';

const { default: tools } = await import('../lib/tools.js');
const { default: shortid } = await import('../lib/shortid.js');
const { default: config } = await import('../lib/config.js');

describe('server libraries smoke test', () => {
    it('config exposes the application settings', () => {
        expect(config.www.trustedPort).to.be.a('number');
        expect(config.roles.global.master.admin).to.equal(true);
    });

    it('nanoid-based short ids are valid', () => {
        const id = shortid.generate();
        expect(shortid.isValid(id)).to.equal(true);
        expect(id).to.have.length(config.cid && config.cid.length ? config.cid.length : 10);
    });

    it('jsdom + juice prepare the html of a campaign (inlined styles, no <style> left to client-side)', async () => {
        const html = await tools.prepareHtml('<html><head><style>p{color:#ff0000}</style></head><body><p class="x">Bonjour</p><a href="https://a.b/c?d=1&amp;e=2">lien</a></body></html>');
        expect(html).to.match(/<p[^>]*style="color:\s*#ff0000/i);
        expect(html).to.contain('href="https://a.b/c?d=1&amp;e=2"');
    });

    it('merge tags are replaced and encoded with he / html-to-text', () => {
        const merge = { FIRST_NAME: 'Jérémy & co', MERGE_NOTE: '<p>Hello <b>world</b></p>' };
        expect(tools.formatTemplate('Bonjour [FIRST_NAME]', 'simple', merge, true)).to.equal('Bonjour J&eacute;r&eacute;my & co');
        expect(tools.formatTemplate('Bonjour [FIRST_NAME]', 'simple', merge, false)).to.equal('Bonjour Jérémy & co');
        expect(tools.formatTemplate('[MERGE_NOTE]', 'simple', merge, false).trim()).to.equal('Hello world');
        expect(he.decode('&eacute;&amp;')).to.equal('é&');
        expect(htmlToText('<h1>Titre</h1><p>Texte <a href="https://x.y">lien</a></p>')).to.contain('TITRE');
    });

    it('handlebars tag language works', () => {
        expect(tools.formatTemplate('Salut {{FIRST_NAME}}', 'hbs', { FIRST_NAME: 'Ronan' }, true)).to.equal('Salut Ronan');
    });

    it('mjml compiles a template (asynchronously since v5)', async () => {
        const { html, errors } = await mjml2html('<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>');
        expect(errors || []).to.have.length(0);
        expect(html).to.contain('Hello').and.to.contain('<!doctype html>'.toLowerCase().slice(0, 9));
    });

    it('csv-parse reads an import file the way the importer configures it', async () => {
        const rows = [];
        const parser = parse({ comment: '#', delimiter: ';', skip_empty_lines: true });
        Readable.from(['email;nom\n', 'a@b.fr;Dupont\n', '# comment\n', 'c@d.fr;"Du;pont"\n']).pipe(parser);
        for await (const row of parser) rows.push(row);
        expect(rows).to.deep.equal([['email', 'nom'], ['a@b.fr', 'Dupont'], ['c@d.fr', 'Du;pont']]);
    });

    it('libmime encodes non-ascii header words', () => {
        const encoded = libmime.encodeWords('Élèves des Ailes');
        expect(encoded).to.match(/^=\?UTF-8\?/);
        expect(libmime.decodeWords(encoded)).to.equal('Élèves des Ailes');
    });

    it('validates email addresses', async () => {
        expect((await tools.validateEmail('ronan@example.com'))).to.equal(0);
        expect((await tools.validateEmail('pas un email'))).to.not.equal(0);
    });

    it('nodemailer -> smtp-server -> mailparser round trip keeps headers, html and attachments', async () => {
        let raw = '';
        const server = new SMTPServer({
            authOptional: true,
            disabledCommands: ['STARTTLS'],
            onData(stream, session, callback) {
                stream.on('data', c => { raw += c; });
                stream.on('end', callback);
            }
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            const transport = nodemailer.createTransport({ host: '127.0.0.1', port: server.server.address().port, secure: false, tls: { rejectUnauthorized: false }, ignoreTLS: true });
            await transport.sendMail({
                from: { name: 'McFly parapente', address: 'info@example.com' },
                to: 'dest@example.com',
                subject: 'Newsletter d’octobre – Élèves',
                html: '<p>Bonjour <b>vous</b></p>',
                text: 'Bonjour vous',
                headers: { 'X-Campaign': 'newsletter-56' },
                attachments: [{ filename: 'note.txt', content: 'contenu' }]
            });
            const mail = await simpleParser(raw);
            expect(mail.subject).to.equal('Newsletter d’octobre – Élèves');
            expect(mail.html).to.contain('<b>vous</b>');
            expect(mail.headers.get('x-campaign')).to.equal('newsletter-56');
            expect(mail.attachments[0].filename).to.equal('note.txt');
        } finally {
            server.close();
        }
    });
});
