// Run against the rebuilt bundle: npm run build, npx playwright install chromium,
// then node test/blockquotes-check.mjs. David/CI runs it; no server is required.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'slate-blockquotes-'));
const html = join(directory, 'page.html');
writeFileSync(html, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(root, 'slate.css')).href}">
<div id="host" style="height:1000px"></div>
<script src="${pathToFileURL(join(root, 'slate.js')).href}"></script>`);

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(async () => {
    window.editor = await window.SlateMarkdownEditor.mount(document.getElementById('host'), {
      persist: false, persistSettings: false, workspaceMode: 'preview',
      interactiveTasks: true, showReadyToast: false,
    });
  });
  const quotes = page.locator('#previewPane > .live-block > blockquote');
  async function render(markdown) {
    await page.evaluate(async markdown => {
      await window.editor.setMarkdown(markdown);
      await window.editor.setWorkspaceMode('preview');
    }, markdown);
  }
  const source = readFileSync(join(root, 'test/blockquotes.md'), 'utf8').replace(/\r\n?/g, '\n');
  const announcement = source.slice(source.indexOf('> **Personal'), source.indexOf('\n## Ordinary'));
  for (const theme of ['light', 'dark', 'paper']) {
    await render(announcement);
    await page.locator('#host').evaluate((host, theme) => { host.dataset.theme = theme; }, theme);
    assert.equal(await quotes.count(), 1, `${theme}: one quote must wrap the complete announcement`);
    assert.equal(await quotes.locator(':scope > p').count(), 5, `${theme}: blank quote markers separate paragraphs`);
    assert.equal(await quotes.locator(':scope > p:empty').count(), 0, 'no empty strips');
    const ribbon = page.locator('#previewPane blockquote:has(a[href="/pricing"])');
    assert.equal(await ribbon.count(), 1);
    assert.match(await ribbon.innerText(), /Personal plans are here[\s\S]*Card required/);
  }

  await render('> One paragraph\n> continued.\n>\n> Second paragraph.\n');
  assert.deepEqual(await quotes.locator(':scope > p').allTextContents(), ['One paragraph continued.', 'Second paragraph.']);
  await render('> First.\n\n> Second.\n');
  assert.equal(await quotes.count(), 2, 'an unquoted blank line separates quotes');
  await render('> First.\r\n>\r\n> Second.\r\n');
  assert.equal(await quotes.count(), 1, 'CRLF quote paragraphs stay grouped');
  await render('> Outer.\n>\n> > Inner.\n> >\n> > - One\n> > - Two\n>\n> End.\n');
  assert.equal(await quotes.count(), 1);
  assert.equal(await quotes.locator('blockquote').count(), 1, 'nested quote belongs to the outer one');
  assert.equal(await quotes.locator('blockquote ul > li').count(), 2);
  await render('> ```text\n> > literal quote marker\n> ```\n');
  assert.equal(await page.locator('#previewPane blockquote').count(), 1, 'quoted code must not create a nested quote');
  assert.equal(await quotes.locator('pre code').textContent(), '> literal quote marker');
  await render('```text\n> literal\n>\n> more literal\n```\n');
  assert.equal(await page.locator('#previewPane blockquote').count(), 0, 'fenced source is not parsed as quotes');
  await render('> [Unsafe link](javascript:alert(1))\n');
  assert.equal(await quotes.locator('a').count(), 0, 'quote rendering retains URL filtering');

  const tasks = '> Intro.\n>\n> - [ ] First\n> - [ ] Second\n> > - [ ] Nested\n\n- [ ] Outside\n';
  await render(tasks);
  const boxes = page.locator('#previewPane .task-checkbox');
  assert.equal(await boxes.count(), 4);
  await boxes.nth(1).check();
  let expected = tasks.replace('> - [ ] Second', '> - [x] Second');
  assert.equal(await page.evaluate(() => window.editor.getMarkdown()), expected);
  await boxes.nth(2).check();
  expected = expected.replace('> > - [ ] Nested', '> > - [x] Nested');
  assert.equal(await page.evaluate(() => window.editor.getMarkdown()), expected);
  await boxes.nth(3).check();
  expected = expected.replace('- [ ] Outside', '- [x] Outside');
  assert.equal(await page.evaluate(() => window.editor.getMarkdown()), expected);

  await render(source);
  const original = await page.evaluate(() => window.editor.getMarkdown());
  for (const mode of ['source', 'edit', 'preview']) {
    await page.evaluate(mode => window.editor.setWorkspaceMode(mode), mode);
    assert.equal(await page.evaluate(() => window.editor.getMarkdown()), original, `${mode}: preserve Markdown`);
  }
  const afterLine = source.split('\n').indexOf('## Ordinary paragraphs');
  const mappedLine = await page.locator('#previewPane > .live-block').evaluateAll(blocks =>
    blocks.find(block => block.dataset.source === '## Ordinary paragraphs')?.dataset.lineIndex);
  assert.equal(Number(mappedLine), afterLine, 'a grouped quote must not shift following source indexes');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Blockquotes: grouping, paragraphs, nesting, code, task mappings and source round-trip passed.');
} finally {
  await browser?.close();
  rmSync(directory, { recursive: true, force: true });
}
