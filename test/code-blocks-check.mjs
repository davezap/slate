// Code blocks (Slate 0.25.0): longer fences hold shorter ones, code spans of any length, and the
// Copy button. Run against the rebuilt bundle: npm run build, then node test/code-blocks-check.mjs.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'slate-code-'));
const html = join(directory, 'page.html');
writeFileSync(html, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(root, 'slate.css')).href}">
<div id="host" style="height:1000px"></div>
<script src="${pathToFileURL(join(root, 'slate.js')).href}"></script>`);

let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(async () => {
    window.editor = await window.SlateMarkdownEditor.mount(document.getElementById('host'), {
      persist: false, persistSettings: false, workspaceMode: 'preview', showReadyToast: false,
    });
  });
  async function render(markdown) {
    await page.evaluate(async markdown => {
      await window.editor.setMarkdown(markdown);
      await window.editor.setWorkspaceMode('preview');
    }, markdown);
  }
  const pane = page.locator('#previewPane');

  // A four-backtick block shows a three-backtick card inside it, as text.
  const example = '3. Put this in `dashboard.md`:\n\n   ````markdown\n   # Team dashboard\n\n   ```card\n   title: Open jobs\n   show: count\n   ```\n   ````\n\nAfter.\n';
  await render(example);
  assert.equal(await pane.locator('pre code').count(), 1, 'one code block');
  assert.equal(await pane.locator('pre code').textContent(), '# Team dashboard\n\n```card\ntitle: Open jobs\nshow: count\n```');
  assert.equal(await pane.locator('.slate-card').count(), 0, 'the inner card is text, not a card');
  assert.equal(await pane.locator('p', { hasText: 'After.' }).count(), 1);

  // Tildes, and a closing fence must use the same character.
  await render('~~~text\n```\nstill code\n~~~\nOutside.\n');
  assert.equal(await pane.locator('pre code').textContent(), '```\nstill code');

  // Code spans of any length.
  await render('A card starts with ```` ```card ```` and ends with ```` ``` ````; `plain` and `` a`b `` too.\n');
  assert.deepEqual(await pane.locator('p code').allInnerTexts(), ['```card', '```', 'plain', 'a`b']);
  await render('An unmatched `` run stays.\n');
  assert.match((await pane.locator('p').first().innerText()).replace(/\u00a0/g, ' '), /An unmatched `` run stays\./);
  assert.equal(await pane.locator('p code').count(), 0);

  // Copy button: on text blocks, not on cards or diagrams.
  await render('```text\nline one\nline two\n```\n\n```card\ntitle: X\nshow: count\nsource: none.csv\n```\n');
  assert.equal(await pane.locator('.slate-code-copy').count(), 1, 'only the text block has a Copy button');
  await pane.locator('.slate-code').hover();
  await pane.locator('.slate-code-copy').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'line one\nline two');
  assert.ok(await pane.locator('.slate-code-copy.is-copied').count(), 'shows Copied');
  assert.equal(await page.evaluate(() => window.editor.getMarkdown()), '```text\nline one\nline two\n```\n\n```card\ntitle: X\nshow: count\nsource: none.csv\n```\n', 'copying changes nothing');

  // The outline skips headings inside long fences.
  await render('# Real\n\n````markdown\n```\n# Not a heading\n```\n````\n\n## Also real\n');
  const outline = await page.evaluate(() => [...document.querySelectorAll('#documentOutline [data-heading-id], #documentOutline a, #documentOutline button.outline-item')].map(e => e.textContent.trim()).filter(Boolean));
  assert.ok(!outline.some(text => text.includes('Not a heading')), `outline: ${outline.join(' | ')}`);

  assert.deepEqual(errors, []);
  console.log('code blocks: ok');
} finally {
  await browser?.close();
  rmSync(directory, { recursive: true, force: true });
}
