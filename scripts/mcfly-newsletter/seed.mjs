// Installe (ou met à jour) les modèles McFly parapente dans un namespace HCFMailer+.
//
// Usage :
//   bun scripts/mcfly-newsletter/build.mjs
//   set -a && source .env.dev && set +a
//   bun scripts/mcfly-newsletter/seed.mjs [--namespace 2] [--dry-run] [--update]
//
// Variables : MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE (celles de .env.dev).
// Pour la production : ouvrir un `kubectl port-forward` vers MySQL et pointer MYSQL_HOST/MYSQL_PORT dessus.
// Par défaut, un modèle qui existe déjà (même nom, même namespace) est laissé tel quel : les utilisateurs peuvent l'avoir personnalisé.
// --update remplace le contenu des modèles existants (à n'utiliser que pour déployer une nouvelle version du design).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { convert } from 'html-to-text';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = (f) => fs.readFileSync(path.join(here, 'dist', f), 'utf8');
const args = process.argv.slice(2);
const namespace = Number(args.includes('--namespace') ? args[args.indexOf('--namespace') + 1] : 2);
const dryRun = args.includes('--dry-run');
const update = args.includes('--update');

const PREFIX = 'McFly parapente';
const NAMES = {
  mosaicoTemplate: `${PREFIX} (modèle Mosaico)`,
  mosaico: `${PREFIX} - Mosaico`,
  grapesjs: `${PREFIX} - GrapesJS`,
  emailbuilder: `${PREFIX} - EmailBuilder`,
  ckeditor5: `${PREFIX} - CKEditor 5`,
};

const toText = (html) =>
  convert(html, { wordwrap: 100, selectors: [{ selector: 'img', format: 'skip' }, { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }] });

const mosaicoHtml = dist('mosaico-template.html');
const mosaicoStatic = dist('mosaico.static.html');
const captured = JSON.parse(fs.readFileSync(path.join(here, 'mosaico-model.json'), 'utf8'));
const grapes = JSON.parse(dist('grapesjs.json'));
const ck5 = JSON.parse(dist('ckeditor5.json'));
const eb = dist('emailbuilder.json');

const pre = '<!doctype html><html><head><meta charset="utf-8"><title></title></head><body>';
const post = '</body></html>';

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: 'utf8mb4',
});

async function upsert(table, name, row) {
  const [found] = await conn.execute(`select id from ${table} where name = ? and namespace = ?`, [name, namespace]);
  if (dryRun) return found[0]?.id ?? 0;
  if (found.length && !update) {
    console.log(`  ${table} #${found[0].id} existe déjà, inchangé : ${name}`);
    return found[0].id;
  }
  if (found.length) {
    const cols = Object.keys(row);
    await conn.execute(`update ${table} set ${cols.map((c) => `\`${c}\` = ?`).join(', ')} where id = ?`, [...cols.map((c) => row[c]), found[0].id]);
    console.log(`  ${table} #${found[0].id} mis à jour : ${name}`);
    return found[0].id;
  }
  const cols = ['name', 'namespace', ...Object.keys(row)];
  const [res] = await conn.execute(`insert into ${table} (${cols.map((c) => `\`${c}\``).join(', ')}) values (${cols.map(() => '?').join(', ')})`, [name, namespace, ...Object.keys(row).map((c) => row[c])]);
  console.log(`  ${table} #${res.insertId} créé : ${name}`);
  return res.insertId;
}

try {
  const [ns] = await conn.execute('select id, name from namespaces where id = ?', [namespace]);
  if (!ns.length) throw new Error(`namespace ${namespace} introuvable`);
  console.log(`Namespace ${ns[0].id} (${ns[0].name})${dryRun ? ' - dry run' : ''}`);

  // 1. Modèle Mosaico (HTML complet du gabarit, balises [URL_BASE] résolues par le serveur à la volée)
  const mosaicoTemplateId = await upsert('mosaico_templates', NAMES.mosaicoTemplate, {
    description: 'Gabarit Mosaico McFly parapente : en-tête Aiguille du Midi, polices Neutraface, pied de page du site',
    type: 'html',
    tag_language: 'simple',
    data: JSON.stringify({ html: mosaicoHtml }),
  });

  // 2. Modèles de campagne, un par éditeur
  const metadata = { ...captured.metadata, template: `[SANDBOX_URL_BASE]/mosaico/templates/${mosaicoTemplateId}/index.html` };
  const base = { tag_language: 'simple' };
  await upsert('templates', NAMES.mosaico, {
    ...base,
    description: 'Newsletter McFly parapente (Mosaico)',
    type: 'mosaico',
    data: JSON.stringify({ mosaicoTemplate: mosaicoTemplateId, metadata: JSON.stringify(metadata), model: captured.model }),
    html: mosaicoStatic,
    text: toText(mosaicoStatic),
  });
  await upsert('templates', NAMES.grapesjs, {
    ...base,
    description: 'Newsletter McFly parapente (GrapesJS, HTML)',
    type: 'grapesjs',
    data: JSON.stringify(grapes),
    html: dist('grapesjs.preview.html'),
    text: toText(grapes.source),
  });
  await upsert('templates', NAMES.emailbuilder, {
    ...base,
    description: 'Newsletter McFly parapente (EmailBuilder)',
    type: 'emailbuilder',
    data: JSON.stringify({ source: eb }),
    html: dist('emailbuilder.preview.html'),
    text: toText(dist('emailbuilder.preview.html')),
  });
  await upsert('templates', NAMES.ckeditor5, {
    ...base,
    description: 'Newsletter McFly parapente (CKEditor 5)',
    type: 'ckeditor5',
    data: JSON.stringify({ source: ck5.source }),
    html: pre + ck5.source + post,
    text: toText(ck5.source),
  });
} finally {
  await conn.end();
}
