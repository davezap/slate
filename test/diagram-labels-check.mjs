// Diagram labels fit their boxes (0.26.1). Serves this folder over HTTP under a strict
// Content-Security-Policy (no style-src 'unsafe-inline', as on Metatrash and Collumii pages), with
// the page's text font a web font that arrives late and a narrower fallback until then, draws a
// Mermaid flowchart with subgraph titles and multi-line labels in Preview, and checks that no
// label's text is wider or taller than the box Mermaid drew for it, in the page and in the
// full-size copy. Before 0.26.1 the policy dropped Mermaid's style="" on labels, so they took
// Preview's line-height and word breaking and were cut off. Then zooms the page with CSS zoom (as
// Slate Viewer's Ctrl+wheel does on the website) and checks the diagram is drawn again and still
// fits (0.26.2: Mermaid measured at the zoomed size, so at 90% every box was 10% too small).
// Run: npm run build, then node test/diagram-labels-check.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Any woff2 text font will do; Slate Viewer's copy of Inter is used when it is next door.
const fontFile = [
  process.env.SLATE_TEST_FONT,
  join(root, '../Slate_Viewer/src/brand/fonts/inter-latin-wght-normal.woff2'),
  join(root, '../metatrash.com/viewer/src/brand/fonts/inter-latin-wght-normal.woff2'),
].find(path => path && existsSync(path));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const pageCss = (fontFile ? `@font-face{font-family:"Page Fallback";size-adjust:88%;src:url(/font.woff2?fallback) format('woff2')}
@font-face{font-family:Inter;font-display:swap;font-weight:100 900;src:url(/font.woff2) format('woff2')}
` : '') + 'html, body { height: 100%; margin: 0; font-family: Inter, "Page Fallback", sans-serif; } #host { height: 100vh; }';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/favicon.ico') return void res.writeHead(204).end();
  if (path === '/page.css') return void res.writeHead(200, { 'content-type': 'text/css' }).end(pageCss);
  if (path === '/font.woff2' && fontFile) {
    // The real font arrives late, so a diagram drawn at once would be measured in the fallback.
    if (!url.searchParams.has('fallback')) await new Promise(r => setTimeout(r, 1500));
    return void res.writeHead(200, { 'content-type': 'font/woff2' }).end(await readFile(fontFile));
  }
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

const markdown = ['# Acme system context', '', '```mermaid', 'flowchart LR',
  '  U[Field devices] --> P',
  '  subgraph CF["Cloudflare edge (~100 s origin timeout)"]', '    P[Cloudflare proxy]', '  end',
  '  subgraph WS["Web Studio (PHP on Windows IIS)"]',
  '    S["acme.example<br/>clsRemoteConnection.php / GPRS_server.php<br/>APIv2.php / file-upload.php"]', '  end',
  '  P -- "HTTPS token auth" --> S', '  S --> D[(SQL Server database)]', '```', ''].join('\n');

/** Labels whose text is wider or taller than their foreignObject box. */
function overflowing(selector) {
  return [...document.querySelectorAll(`${selector} foreignObject`)].map(box => {
    const inner = box.firstElementChild;
    return {
      text: box.textContent.trim(),
      width: Number(box.getAttribute('width')), needs: inner?.scrollWidth ?? 0,
      height: Number(box.getAttribute('height')), needsHeight: inner?.scrollHeight ?? 0,
    };
  }).filter(label => label.text && (label.needs > label.width + 1 || label.needsHeight > label.height + 1));
}

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
  await page.waitForSelector('#previewPane .slate-diagram.is-drawn .slate-diagram-canvas > svg', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  const labels = await page.locator('#previewPane .slate-diagram-canvas foreignObject').count();
  assert.ok(labels >= 6, `expected the diagram's labels, found ${labels}`);
  assert.deepEqual(await page.evaluate(overflowing, '#previewPane .slate-diagram-canvas'), [], 'labels fit their boxes in the page');
  // Mermaid's label styles are in effect despite the policy.
  const lineHeight = await page.evaluate(() => getComputedStyle(document.querySelector('#previewPane .slate-diagram-canvas foreignObject > div')).lineHeight);
  assert.equal(lineHeight, '24px', 'labels keep Mermaid\'s line-height 1.5, not Preview\'s 1.7');

  await page.locator('#previewPane .slate-diagram').hover();
  await page.locator('#previewPane .slate-diagram-expand').click();
  await page.waitForSelector('.slate-diagram-overlay .slate-diagram-stage > svg');
  assert.deepEqual(await page.evaluate(overflowing, '.slate-diagram-overlay .slate-diagram-stage'), [], 'labels fit their boxes full size');
  await page.keyboard.press('Escape');

  for (const zoom of ['0.9', '1.3']) {
    const before = await page.evaluate(() => document.querySelector('#previewPane .slate-diagram-canvas > svg').id);
    await page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, zoom);
    await page.waitForFunction(before => document.querySelector('#previewPane .slate-diagram.is-drawn .slate-diagram-canvas > svg')?.id !== before, before, { timeout: 20000 });
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(overflowing, '#previewPane .slate-diagram-canvas'), [], `labels fit their boxes at zoom ${zoom}`);
  }
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  assert.deepEqual(errors, []);
  console.log(`diagram labels: ok${fontFile ? '' : ' (no font file found: the late web font was not tested)'}`);
} finally {
  await browser?.close();
  server.close();
}
