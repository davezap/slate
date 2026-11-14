// Named embeds (0.23.0). Builds slate.js with test/embed-edition.js (one `test-card` embed) into
// a temporary folder, then checks Edit, Preview and Source: a fenced `embed` block naming an
// edition embed is drawn by it and its controls work; unknown names, inherited names, several
// lines and an embed that throws stay code. Run: npm ci, npx playwright install chromium, then
// node test/embeds-check.mjs. No server is required.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'slate-embeds-'));
const bundle = join(directory, 'slate.js');
await build({
  entryPoints: [join(root, 'src/slate.js')], bundle: true, format: 'iife', target: 'es2020', outfile: bundle, logLevel: 'error',
  plugins: [{
    name: 'test-edition',
    setup(b) {
      b.onResolve({ filter: /^\.\/edition\.js$/ }, args =>
        resolve(args.resolveDir) === join(root, 'src') && !args.importer.endsWith('embed-edition.js')
          ? { path: join(root, 'test/embed-edition.js') } : null);
    },
  }],
});
const html = join(directory, 'page.html');
writeFileSync(html, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(root, 'slate.css')).href}">
<div id="host" style="height:1400px"></div>
<script src="${pathToFileURL(bundle).href}"></script>`);

const markdown = [
  '# Embeds', '',
  '```embed', 'test-card', '```', '',
  'Between.', '',
  '```embed', 'Test-Card  ', '```', '',
  '```embed', 'unknown-card', '```', '',
  '```embed', 'constructor', '```', '',
  '```embed', 'test-card', 'test-card', '```', '',
  '```embed', 'broken', '```', '',
  '```js', 'test-card', '```', '',
].join('\n');

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(async markdown => {
    window.editor = await window.SlateMarkdownEditor.mount(document.getElementById('host'), {
      persist: false, persistSettings: false, workspaceMode: 'preview', showReadyToast: false,
    });
    await window.editor.setMarkdown(markdown);
  }, markdown);

  for (const mode of ['preview', 'edit']) {
    await page.evaluate(async mode => { await window.editor.setWorkspaceMode(mode); }, mode);
    await page.waitForTimeout(400);
    const pane = mode === 'preview' ? '#previewPane' : '.cm-content';
    const found = await page.evaluate(pane => {
      const host = document.querySelector(pane);
      return {
        embeds: [...host.querySelectorAll('.slate-embed')].map(e => e.dataset.embed),
        cards: host.querySelectorAll('.test-card').length,
        code: [...host.querySelectorAll('pre code, .cm-slate-codeblock')].map(e => e.textContent).join('\n'),
      };
    }, pane);
    assert.deepEqual(found.embeds, ['test-card', 'test-card', 'broken'], `${mode}: embeds drawn`);
    assert.equal(found.cards, 2, `${mode}: test cards mounted`);
    for (const name of ['unknown-card', 'constructor']) assert.ok(found.code.includes(name), `${mode}: ${name} stays code`);
    const pressed = await page.evaluate(() => window.__pressed || 0);
    await page.locator(`${pane} .test-card-button`).first().click();
    assert.equal(await page.evaluate(() => window.__pressed), pressed + 1, `${mode}: the embed's button works`);
    if (mode === 'edit') {
      // Pressing the embed's own button leaves the block drawn (the cursor didn't move into its source).
      assert.equal(await page.locator('.cm-content .test-card').count(), 2, 'edit: still drawn after a press');
    }
  }
  await page.evaluate(async () => { await window.editor.setWorkspaceMode('source'); });
  assert.ok((await page.evaluate(() => window.editor.getMarkdown())).includes('```embed\ntest-card\n```'), 'source unchanged');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('Embeds check passed: drawn in Preview and Edit, controls work, other names stay code.');
} finally {
  await browser?.close();
  rmSync(directory, { recursive: true, force: true });
}
