// Diagram zoom and pan (0.26.0). Serves this folder over HTTP under a strict Content-Security-Policy,
// draws a Mermaid diagram and checks: the plain wheel scrolls the page and leaves the diagram;
// Ctrl+wheel zooms it (and the host's own Ctrl+wheel never hears it); Ctrl+drag pans; the reset
// button brings back the whole diagram; the expand button opens a full-size copy where the plain
// wheel and drag zoom and pan; Esc closes it; in Edit, the buttons and Ctrl+drag don't open the
// source but a plain click still does; printing shows the whole diagram.
// Run: npm run build, then node test/diagram-zoom-check.mjs.
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

const nodes = Array.from({ length: 14 }, (_, i) => `  N${i}[Step number ${i}] --> N${i + 1}[Step number ${i + 1}]`).join('\n');
const markdown = ['# Diagrams', '', ...Array(30).fill('Filler line.\n'), '```mermaid', 'flowchart LR', nodes, '```', '', ...Array(40).fill('More filler.\n')].join('\n');

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/style-src|inline style/i.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/page.html`);
  await page.evaluate(() => window.ready);
  // The host's own Ctrl+wheel (like the Viewer's page zoom) counts what reaches it.
  await page.evaluate(() => { window.hostZooms = 0; window.addEventListener('wheel', e => { if (e.ctrlKey) window.hostZooms += 1; }); });
  await page.evaluate(async markdown => { await window.editor.setMarkdown(markdown); await window.editor.setWorkspaceMode('preview'); }, markdown);
  const diagram = page.locator('#previewPane .slate-diagram');
  await page.waitForSelector('#previewPane .slate-diagram.is-drawn .slate-diagram-canvas > svg', { timeout: 20000 });
  await diagram.scrollIntoViewIfNeeded();
  const svg = diagram.locator('.slate-diagram-canvas > svg');
  const viewBox = () => svg.getAttribute('viewBox');
  const original = await viewBox();
  const scrollTop = () => page.evaluate(() => window.scrollY + [...document.querySelectorAll('*')].reduce((sum, e) => sum + e.scrollTop, 0));
  const box = await svg.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Plain wheel: the page scrolls, the diagram doesn't zoom.
  await page.mouse.move(cx, cy);
  const before = await scrollTop();
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(200);
  assert.notEqual(await scrollTop(), before, 'plain wheel scrolls the page');
  assert.equal(await viewBox(), original, 'plain wheel leaves the diagram');
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(100);

  // Ctrl+wheel zooms in where the pointer is; the host never sees it.
  const b2 = await svg.boundingBox();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  const zoomed = (await viewBox()).split(' ').map(Number);
  const start = original.split(' ').map(Number);
  assert.ok(zoomed[2] < start[2] * 0.8, `Ctrl+wheel zooms in (${original} -> ${zoomed.join(' ')})`);
  assert.equal(await page.evaluate(() => window.hostZooms), 0, 'the host does not zoom the page');
  assert.ok(await diagram.evaluate(d => d.classList.contains('is-zoomed')));
  assert.ok(await diagram.locator('.slate-diagram-reset').isVisible(), 'reset shows once zoomed');

  // Ctrl+drag pans.
  await page.keyboard.down('Control');
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2 - 80, b2.y + b2.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  const panned = (await viewBox()).split(' ').map(Number);
  assert.ok(panned[0] > zoomed[0] + 1, `Ctrl+drag left moves the view right (${zoomed[0]} -> ${panned[0]})`);
  assert.ok(Math.abs(panned[2] - zoomed[2]) < 0.01, 'panning keeps the zoom');

  // A plain drag does nothing to it.
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2 - 80, b2.y + b2.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.equal((await viewBox()).split(' ').map(Number)[0], panned[0], 'plain drag leaves the diagram');

  // Reset.
  await diagram.hover();
  await diagram.locator('.slate-diagram-reset').click();
  assert.equal(await viewBox(), original, 'reset brings back the whole diagram');
  assert.ok(!(await diagram.locator('.slate-diagram-reset').isVisible()));

  // Full size.
  await diagram.hover();
  await diagram.locator('.slate-diagram-expand').click();
  const overlay = page.locator('body > .slate-diagram-overlay');
  await overlay.waitFor();
  const big = overlay.locator('.slate-diagram-stage > svg');
  const bigBox = await big.boundingBox();
  assert.ok(bigBox.width > 900, `the copy fills the window (${bigBox.width})`);
  const ids = await page.evaluate(() => [...document.querySelectorAll('svg[id]')].map(s => s.id));
  assert.equal(new Set(ids).size, ids.length, `each copy has its own id: ${ids}`);
  assert.equal(await overlay.evaluate(o => document.activeElement === o.querySelector('.slate-diagram-close')), true, 'focus on close');
  const bigOriginal = await big.getAttribute('viewBox');
  await page.mouse.move(bigBox.x + bigBox.width / 2, bigBox.y + bigBox.height / 2);
  await page.mouse.wheel(0, -300);
  const bigZoomed = (await big.getAttribute('viewBox')).split(' ').map(Number);
  assert.ok(bigZoomed[2] < Number(bigOriginal.split(' ')[2]) * 0.8, 'plain wheel zooms full size');
  await page.mouse.down();
  await page.mouse.move(bigBox.x + bigBox.width / 2 + 100, bigBox.y + bigBox.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const bigPanned = (await big.getAttribute('viewBox')).split(' ').map(Number);
  assert.ok(bigPanned[0] < bigZoomed[0] - 1, 'plain drag pans full size');
  await page.mouse.dblclick(bigBox.x + bigBox.width / 2, bigBox.y + bigBox.height / 2);
  assert.equal(await big.getAttribute('viewBox'), bigOriginal, 'double-click shows the whole diagram');
  await page.keyboard.press('+');
  assert.notEqual(await big.getAttribute('viewBox'), bigOriginal, '+ zooms in');
  assert.equal(await page.evaluate(() => window.hostZooms), 0);
  await page.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
  await page.keyboard.press('Escape');
  assert.equal(await overlay.count(), 0, 'Esc closes it');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('slate-diagram-expand')), true, 'focus goes back to the button');
  // A click on the faded page closes it too.
  await diagram.hover();
  await diagram.locator('.slate-diagram-expand').click();
  await overlay.waitFor();
  await page.mouse.click(8, 8);
  assert.equal(await overlay.count(), 0, 'a click outside closes it');

  // Edit: tools and Ctrl+drag don't show the source; a plain click still does.
  await page.evaluate(() => window.editor.setWorkspaceMode('edit'));
  const live = page.locator('.cm-slate-diagram .slate-diagram');
  await page.waitForSelector('.cm-slate-diagram .slate-diagram.is-drawn .slate-diagram-canvas > svg', { timeout: 20000 });
  await live.scrollIntoViewIfNeeded();
  const liveSvg = live.locator('.slate-diagram-canvas > svg');
  const lb = await liveSvg.boundingBox();
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.mouse.down();
  await page.mouse.move(lb.x + lb.width / 2 - 60, lb.y + lb.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  assert.ok(await live.evaluate(d => d.classList.contains('is-zoomed')), 'zooms in Edit');
  assert.equal(await page.locator('.cm-slate-diagram.cm-slate-block-active, .live-block.is-media-source-open').count(), 0, 'Ctrl+drag does not open the source');
  await live.hover();
  await live.locator('.slate-diagram-expand').click();
  await overlay.waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cm-slate-block-active').count(), 0, 'the expand button does not open the source');
  const sourceShown = async () => page.evaluate(() => {
    const view = document.querySelector('.cm-content');
    return /```mermaid/.test([...document.querySelectorAll('.cm-line')].map(l => l.textContent).join('\n'));
  });
  assert.equal(await sourceShown(), false, 'source still hidden');
  await page.mouse.click(lb.x + 20, lb.y + lb.height / 2);
  await page.waitForTimeout(200);
  assert.equal(await sourceShown(), true, 'a plain click shows the source');

  // Printing shows the whole diagram.
  await page.evaluate(() => window.editor.setWorkspaceMode('preview'));
  await page.waitForSelector('#previewPane .slate-diagram.is-drawn .slate-diagram-canvas > svg');
  const pv = page.locator('#previewPane .slate-diagram');
  await pv.scrollIntoViewIfNeeded();
  const pb = await pv.locator('.slate-diagram-canvas > svg').boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  assert.ok(await pv.evaluate(d => d.classList.contains('is-zoomed')));
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.ok(!(await pv.evaluate(d => d.classList.contains('is-zoomed'))), 'whole diagram for print');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  assert.deepEqual(errors, []);
  console.log('diagram zoom: ok');
} finally {
  await browser?.close();
  server.close();
}
