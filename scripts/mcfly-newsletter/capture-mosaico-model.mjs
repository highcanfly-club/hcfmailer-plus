// Mosaico ne fabrique pas le contenu initial à partir du gabarit : il faut un "model" JSON.
// Ce script charge le gabarit dans l'éditeur Mosaico autonome (client/static/mosaico/editor.html), y insère les blocs
// par défaut, puis exporte model + metadata dans scripts/mcfly-newsletter/mosaico-model.json.
//
// Prérequis : serveur de dev lancé (bun run dev) et `playwright` résolvable (ex. NODE_PATH=/chemin/vers/node_modules).
// Usage     : bun scripts/mcfly-newsletter/build.mjs && node scripts/mcfly-newsletter/capture-mosaico-model.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const mosaicoDir = path.join(here, '../../client/static/mosaico');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.PUBLIC_URL || 'http://localhost:3004';
const tmpTemplateDir = path.join(mosaicoDir, 'templates/mcfly-tmp');
const tmpEditor = path.join(mosaicoDir, 'editor-tmp.html');

fs.mkdirSync(tmpTemplateDir, { recursive: true });
fs.writeFileSync(path.join(tmpTemplateDir, 'template.html'), fs.readFileSync(path.join(here, 'dist/mosaico-template.html'), 'utf8').replaceAll('[URL_BASE]', BASE));
fs.writeFileSync(tmpEditor, fs.readFileSync(path.join(mosaicoDir, 'editor.html'), 'utf8').replace('// plugins = [function(vm) {window.viewModel = vm;}];', 'plugins = [function(vm) {window.viewModel = vm;}];'));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await page.goto(`${BASE}/static/mosaico/editor-tmp.html#templates/mcfly-tmp/template.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const result = await page.evaluate((assets) => {
    const vm = window.viewModel;
    vm.loadDefaultBlocks();
    const blocks = vm.content().mainBlocks().blocks;
    // le bloc "bouton seul" reste disponible dans la palette mais n'est pas dans le contenu initial
    const idx = blocks().findIndex((b) => b().type() === 'mcflyButtonBlock');
    if (idx >= 0) blocks.splice(idx, 1);
    // Mosaico n'accepte comme src par défaut dans le gabarit que ses placeholders : l'image se fixe dans le model
    blocks().filter((b) => b().image).forEach((b) => b().image().src(assets.feature));
    return { model: vm.exportJSON(), metadata: vm.exportMetadata() };
  }, { feature: '[URL_BASE]/static/mcfly/img/feature-aiguille.jpg' });

  // Le serveur applique base()/unbase() sur [URL_BASE] ; on stocke donc les balises, pas l'URL de dev
  const model = result.model.replaceAll(BASE, '[URL_BASE]');
  fs.writeFileSync(path.join(here, 'mosaico-model.json'), JSON.stringify({ model, metadata: JSON.parse(result.metadata) }));
  console.log('mosaico-model.json écrit (', model.length, 'octets )');
} finally {
  await browser.close();
  fs.rmSync(tmpTemplateDir, { recursive: true, force: true });
  fs.rmSync(tmpEditor, { force: true });
}
