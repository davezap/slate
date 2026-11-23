// Outline and #anchor jumps land on the heading (0.26.1). Serves this folder over HTTP under a
// strict Content-Security-Policy, opens a long document with a Mermaid diagram in every section,
// and checks: a jump made while the diagrams are still drawing ends with the heading at the top;
// later jumps between sections do too and still scroll smoothly; once the reader scrolls, a block
// changing size no longer pulls the view back.
// Run: npm run build, then node test/reveal-hold-check.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/favicon.ico') return void res.writeHead(204).end();
  if (path === '/page.css') return void res.writeHead(200, { 'content-type': 'text/css' }).end('html, body { height: 100%; margin: 0; } #host { height: 100vh; }');
  if (path === '/page.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "script-src 'self'; style-src 'self'" });
    res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/slate.css"><link rel="stylesheet" href="/page.css"><div id="host"></div><script src="/slate.js"></script><script src="/test/diagram-zoom-page.js"></script>');
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

const lines = ['# Acme handbook', ''];
for (let s = 1; s <= 8; s++) {
  lines.push(`## ${s}. Section ${s}`, '');
  for (let i = 0; i < 6; i++) lines.push('Some text in the section, a few words long.', '');
  lines.push('```mermaid', 'flowchart TD');
  for (let i = 0; i < 8; i++) lines.push(`  A${s}_${i}[Step ${i} of part ${s}] --> A${s}_${i + 1}[Step ${i + 1}]`);
  lines.push('```', '');
}
const markdown = lines.join('\n');
const lineOf = s => lines.indexOf(`## ${s}. Section ${s}`);

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/style-src|inline style/i.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/page.html`);
  await page.evaluate(() => window.ready);
  await page.evaluate(async markdown => { await window.editor.setMarkdown(markdown); await window.editor.setWorkspaceMode('preview'); }, markdown);

  /** The heading's distance from the top of the pane, in px, once the view settles. */
  const offset = s => page.evaluate(title => {
    const pane = document.querySelector('#previewPane');
    const heading = [...pane.querySelectorAll('h2')].find(h => h.textContent.includes(title));
    return Math.round(heading.getBoundingClientRect().top - pane.getBoundingClientRect().top);
  }, `Section ${s}`);
  const drawn = () => page.evaluate(() => document.querySelectorAll('#previewPane .slate-diagram.is-drawn').length);

  // Straight away, as an #anchor link does: the diagrams above are still being drawn.
  await page.evaluate(line => window.editor.revealLine(line), lineOf(6));
  assert.ok(await drawn() < 8, 'the jump happened before every diagram was drawn');
  await page.waitForFunction(() => document.querySelectorAll('#previewPane .slate-diagram.is-drawn').length === 8, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  assert.ok(Math.abs(await offset(6)) <= 2, `section 6 at the top after the diagrams drew (was ${await offset(6)} px)`);

  // Back and forth, as with Document Nav clicks; each jump still scrolls smoothly.
  for (const s of [2, 3, 2, 7, 3]) {
    const steps = await page.evaluate(async line => {
      const pane = document.querySelector('#previewPane');
      let count = 0;
      const onScroll = () => { count += 1; };
      pane.addEventListener('scroll', onScroll);
      window.editor.revealLine(line);
      // Until the view has been still for 300 ms (a long smooth scroll takes over a second).
      let last = -1;
      for (let still = 0; still < 3;) {
        await new Promise(r => setTimeout(r, 100));
        still = pane.scrollTop === last ? still + 1 : 0;
        last = pane.scrollTop;
      }
      pane.removeEventListener('scroll', onScroll);
      return count;
    }, lineOf(s));
    assert.ok(steps > 2, `the jump to section ${s} scrolled smoothly (${steps} scroll events)`);
    assert.ok(Math.abs(await offset(s)) <= 2, `section ${s} at the top (was ${await offset(s)} px)`);
  }

  // Once the reader scrolls, a block above changing size doesn't pull the view back.
  await page.evaluate(line => window.editor.revealLine(line), lineOf(5));
  await page.waitForTimeout(1200);
  const pane = page.locator('#previewPane');
  const box = await pane.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.querySelector('#previewPane').scrollTop);
  await page.evaluate(() => { document.querySelector('#previewPane .slate-diagram').style.minHeight = '900px'; });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('#previewPane').scrollTop);
  assert.ok(Math.abs(after - before) < 400, `the reader's own scroll is left alone (${before} -> ${after})`);

  assert.deepEqual(errors, []);
  console.log('reveal hold: ok');
} finally {
  await browser?.close();
  server.close();
}
