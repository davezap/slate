// Code colouring (0.26.0). Serves this folder over HTTP under a strict Content-Security-Policy and
// checks: a code file (.py) shows in the editor in Preview, read only and coloured by its
// extension's language, and stays coloured in Edit; a file whose extension isn't known stays
// plain; fenced code blocks in a Markdown Preview are coloured by the fence's language (```js,
// ```py) without changing their text, and an unknown one stays plain; only the language asked
// for loads; the theme changes the colours; printing a code file prints all of it, coloured;
// the view switcher has no Preview button. Also times a long file, for reference.
// Run: npm run build, then node test/code-colour-check.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const requested = [];
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  requested.push(path);
  if (path === '/favicon.ico') return void res.writeHead(204).end();
  if (path === '/page.css') return void res.writeHead(200, { 'content-type': 'text/css' }).end('html, body { height: 100%; margin: 0; } #host { height: 100vh; }');
  if (path === '/page.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "script-src 'self'; style-src 'self'" });
    res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/slate.css"><link rel="stylesheet" href="/page.css"><div id="host"></div><script src="/slate.js"></script><script src="/test/code-colour-page.js"></script>');
    return;
  }
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const python = 'import os\n\n# A comment\ndef greet(name):\n    return f"Hello {name}" + str(42)\n';
const markdown = [
  '# Code', '',
  '```js', 'const answer = 42; // the answer', 'function hi() { return "hi"; }', '```', '',
  '```py title="x"', 'def f():\n    return None', '```', '',
  '```nosuchlanguage', 'plain words if else', '```', '',
].join('\n');

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/style-src|inline style/i.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/page.html`);
  await page.evaluate(() => window.ready);

  // No Preview button: Edit and Source only.
  assert.deepEqual(await page.$$eval('.view-button', buttons => buttons.map(b => b.dataset.workspaceMode)), ['edit', 'source']);

  // A Markdown page with fences: coloured by the fence's language, text unchanged.
  assert.equal(requested.filter(p => p.startsWith('/languages/')).length, 0, 'nothing loads before code shows');
  await page.evaluate(async markdown => { await window.editor.setMarkdown(markdown); }, markdown);
  await page.waitForSelector('#previewPane code[data-language="js"] .tok-keyword', { timeout: 10000 });
  await page.waitForSelector('#previewPane code[data-language="py"] .tok-keyword', { timeout: 10000 });
  assert.equal(await page.textContent('#previewPane code[data-language="js"]'), 'const answer = 42; // the answer\nfunction hi() { return "hi"; }');
  assert.ok(await page.$('#previewPane code[data-language="js"] .tok-comment'), 'js comment coloured');
  assert.ok(await page.$('#previewPane code[data-language="js"] .tok-string'), 'js string coloured');
  await page.waitForFunction(() => document.querySelector('#previewPane code[data-language="nosuchlanguage"]')?.dataset.coloured === 'plain');
  assert.equal(await page.$('#previewPane code[data-language="nosuchlanguage"] span'), null, 'unknown language stays plain');
  const keywordColour = () => page.$eval('#previewPane code[data-language="js"] .tok-keyword', e => getComputedStyle(e).color);
  const light = await keywordColour();
  await page.evaluate(() => { document.getElementById('host').dataset.theme = 'dark'; });
  const dark = await keywordColour();
  assert.notEqual(light, dark, 'the theme changes code colours');
  await page.evaluate(() => { delete document.getElementById('host').dataset.theme; });

  // A Python file: in Preview the editor shows it, read only and coloured.
  await page.evaluate(async python => {
    await window.editor.setPlainText(true, { fileName: 'C:\\work\\hello.py' });
    await window.editor.setMarkdown(python);
  }, python);
  await page.waitForSelector('.editor-pane .cm-content .tok-keyword', { timeout: 10000 });
  assert.equal(await page.evaluate(() => window.editor.getCodeLanguage()), 'Python');
  assert.equal(await page.evaluate(() => window.editor.getWorkspaceMode()), 'preview');
  assert.ok(await page.isVisible('.editor-pane .cm-editor'), 'the editor shows in Preview');
  assert.equal(await page.isVisible('#previewPane'), false, 'the rendered preview is hidden');
  assert.equal(await page.getAttribute('.editor-pane .cm-content', 'contenteditable'), 'false', 'read only in Preview');
  assert.ok(await page.$('.editor-pane .cm-content .tok-comment'));
  assert.ok(await page.$('.editor-pane .cm-content :is(.tok-string, .tok-string2)'));
  const loaded = requested.filter(p => p.startsWith('/languages/'));
  assert.ok(loaded.length < 12, `only the languages needed load (${loaded.length} files)`);

  // Edit: the same editor, editable, still coloured.
  await page.evaluate(() => window.editor.setWorkspaceMode('edit'));
  assert.equal(await page.getAttribute('.editor-pane .cm-content', 'contenteditable'), 'true');
  assert.ok(await page.$('.editor-pane .cm-content .tok-keyword'));
  await page.evaluate(() => window.editor.setWorkspaceMode('preview'));

  // Printing a code file: the whole text, coloured, then back.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.textContent('#previewPane pre.slate-print-code'), python);
  assert.ok(await page.$('#previewPane pre.slate-print-code .tok-keyword'));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.$('#previewPane pre.slate-print-code'), null);

  // An extension CodeMirror doesn't know stays plain.
  await page.evaluate(async () => {
    await window.editor.setPlainText(true, { fileName: 'notes.txt' });
    await window.editor.setMarkdown('if else return 42\n');
  });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.editor.getCodeLanguage()), null);
  assert.equal(await page.$('.editor-pane .cm-content [class*="tok-"]'), null, 'plain text has no colours');

  // Back to Markdown: the rendered Preview again.
  await page.evaluate(async markdown => {
    await window.editor.setPlainText(false);
    await window.editor.setMarkdown(markdown);
  }, markdown);
  assert.ok(await page.isVisible('#previewPane h1'));
  assert.equal(await page.isVisible('.editor-pane .cm-editor'), false);

  // For reference: a long JavaScript file, from setMarkdown to coloured in Preview.
  const long = Array.from({ length: 20000 }, (_, i) => `function f${i}(a, b) { return a + b * ${i}; } // line ${i}`).join('\n') + '\n';
  const ms = await page.evaluate(async long => {
    const start = performance.now();
    await window.editor.setPlainText(true, { fileName: 'big.js' });
    await window.editor.setMarkdown(long);
    while (!document.querySelector('.editor-pane .cm-content .tok-keyword')) await new Promise(r => setTimeout(r, 5));
    return Math.round(performance.now() - start);
  }, long);
  console.log(`20,000-line .js file coloured in Preview after ${ms} ms (${long.length.toLocaleString()} characters)`);

  assert.deepEqual(errors, []);
  console.log('code colour: ok');
} finally {
  await browser?.close();
  server.close();
}
