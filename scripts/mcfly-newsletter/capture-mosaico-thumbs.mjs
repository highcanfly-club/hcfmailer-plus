// Génère les vignettes de blocs Mosaico (edres/<bloc>.png, 640 px de large) à partir de dist/mosaico.static.html.
// Le serveur les sert en repli pour tous les modèles Mosaico (server/routes/sandboxed-mosaico.js).
// Prérequis : serveur de dev lancé (images/polices de [URL_BASE]) et `playwright` résolvable (NODE_PATH).
// Usage : bun scripts/mcfly-newsletter/build.mjs && node scripts/mcfly-newsletter/capture-mosaico-thumbs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.PUBLIC_URL || 'http://localhost:3004';
const outDir = path.join(here, '../../client/static/mosaico/templates/mcfly-1/edres');
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(path.join(here, 'dist/mosaico.static.html'), 'utf8').replaceAll('[URL_BASE]', BASE);
const head = html.slice(0, html.indexOf('<body'));
const blocks = [...html.matchAll(/<!-- (mcfly\w+Block) -->([\s\S]*?)<!-- \/\1 -->/g)];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
for (const [, name, body] of blocks) {
  await page.setContent(`${head}<body style="margin:0;background:#e8ebec">${body}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))));
  await page.waitForTimeout(300);
  await page.locator('body > table').first().screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(name);
}
await browser.close();
