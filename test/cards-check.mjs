// Dashboard cards (0.24.0). Serves this folder over HTTP, mounts the built slate.js with a
// pretend card host, and checks Preview and Edit: counts, lists, tables (sorting), pie/bar/line
// charts from charts/, Markdown cards, show-if, a notice to acknowledge, a form to send, refused
// answers, cards that can't be read, and the grid. Run: npm run build, then node test/cards-check.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { conditionsHold, cardContext, parseCard, parseConditions } from '../src/cards.js';

// Parsing first.
assert.equal(parseCard(['show: pie', 'source: jobs/']).error, 'A pie chart needs group: the field to split by.');
assert.match(parseCard(['shape: round']).error, /not a card key/);
assert.match(parseCard(['show: count', 'source: a/', 'source: b/']).error, /twice/);
assert.equal(parseCard(['title: Hi', '---', 'Body *text*']).show, 'markdown');
assert.equal(parseCard(['show: line', 'source: s.csv', 'group: month']).query.sort, 'group');
assert.match(parseConditions('@time >= ').error, /compares with nothing/);
assert.match(parseConditions('@colour=red').error, /not something a card knows/);
const ctx = { ...cardContext(new Date(2026, 10, 18, 17, 5), 'pat'), '@count': 3, '@done': false };
assert.equal(ctx['@weekday'], 'Wed');
for (const [text, want] of [['@count>0', true], ['@count', true], ['!@done', true], ['@done', false], ['@time>=17:00; @time<18:00', true],
  ['@weekday=Mon|Wed', true], ['@me=PAT', true], ['@today>=2026-11-18', true], ['@today<today', false]]) {
  assert.equal(conditionsHold(parseConditions(text).conditions, ctx), want, text);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/favicon.ico') return void res.writeHead(204).end();
  if (path === '/page.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "script-src 'self'; style-src 'self'" });
    res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/slate.css"><div id="host"></div><script src="/slate.js"></script><script src="/test/cards-page.js"></script>');
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

const markdown = [
  '# Service desk', '', 'Good morning.', '',
  '```card', 'title: Open jobs', 'show: count', 'source: jobs/', 'where: state!=done', '```', '',
  '```card', 'title: Overdue', 'show: count', 'source: jobs/', 'where: due<today', 'show-if: @count>0', '```', '',
  '```card', 'title: By type', 'size: wide', 'show: pie', 'source: jobs/', 'group: type', '```', '',
  '```card', 'title: Bars', 'show: bar', 'source: jobs/', 'group: type', '```', '',
  '```card', 'title: Sales', 'show: line', 'source: sales.csv', 'group: month', 'measure: sum amount', '```', '',
  '```card', 'title: My jobs', 'size: full', 'show: table', 'source: jobs/', 'columns: title, hours', '```', '',
  '```card', 'title: List', 'show: list', 'source: jobs/', 'columns: title', '```', '',
  '```card', 'title: Note', 'show: markdown', '---', '**Bold** words', '```', '',
  '```card', 'title: Lunch', 'show: form', 'source: lunch.md', '```', '',
  '```card', 'title: Lock up', 'show: form', 'source: lock-up.md', 'show-if: !@done', '```', '',
  '```card', 'show: pie', 'source: jobs/', '```', '',
  'After the cards.', '',
].join('\n');

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // CodeMirror adds its own <style> elements, which this strict policy refuses on any page;
  // anything else refused (a chart's inline style, say) fails the check.
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => {
    if (e.target?.nodeName !== 'STYLE') console.error(`CSP ${e.violatedDirective}: ${e.sample} ${e.sourceFile}:${e.lineNumber}`);
  }));
  page.on('console', m => { if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/page.html`);
  await page.waitForFunction(() => window.ready === true);
  await page.evaluate(async markdown => { await window.editor.setMarkdown(markdown); }, markdown);
  await page.waitForFunction(() => document.querySelectorAll('#previewPane canvas').length === 3, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => {
    const pane = document.querySelector('#previewPane');
    const card = title => [...pane.querySelectorAll('.slate-card')].find(c => c.getAttribute('aria-label') === title);
    return {
      open: card('Open jobs').querySelector('.slate-card-number').textContent,
      overdueHidden: card('Overdue').hidden && card('Overdue').closest('.live-block').classList.contains('slate-card-hidden'),
      table: [...card('My jobs').querySelectorAll('tbody tr')].map(tr => tr.textContent),
      list: [...card('List').querySelectorAll('li')].map(li => li.textContent),
      note: card('Note').querySelector('strong')?.textContent,
      lunch: card('Lunch').querySelector('.slate-card-button').textContent,
      lockFields: card('Lock up').querySelectorAll('.form-field').length,
      bad: pane.querySelector('.slate-card.has-error .slate-card-error')?.textContent,
      widths: ['Open jobs', 'By type', 'My jobs'].map(t => Math.round(card(t).getBoundingClientRect().width)),
      tops: ['Open jobs', 'By type'].map(t => Math.round(card(t).getBoundingClientRect().top)),
      queries: window.queries.length,
    };
  });
  assert.equal(seen.open, '3');
  assert.ok(seen.overdueHidden, 'an empty overdue card hides');
  assert.deepEqual(seen.table, ['Fix pump3', 'Paint2', 'Service boiler1.5']);
  assert.deepEqual(seen.list, ['Fix pump', 'Paint', 'Service boiler']);
  assert.equal(seen.note, 'Bold');
  assert.equal(seen.lunch, 'Acknowledge');
  assert.equal(seen.lockFields, 1);
  assert.match(seen.bad, /needs group/);
  assert.equal(seen.tops[0], seen.tops[1], 'cards share a row');
  assert.ok(seen.widths[1] > seen.widths[0] * 1.5, `wide is wider ${seen.widths}`);
  assert.ok(seen.widths[2] > seen.widths[1], 'full is widest');

  // Sorting a table by a header.
  await page.locator('.slate-card[aria-label="My jobs"] .slate-card-sort', { hasText: 'hours' }).click();
  assert.deepEqual(await page.locator('.slate-card[aria-label="My jobs"] tbody tr td:nth-child(2)').allTextContents(), ['1.5', '2', '3']);
  // A row's link asks the host to open the file.
  await page.locator('.slate-card[aria-label="My jobs"] .slate-card-link').first().click();
  assert.equal(await page.evaluate(() => window.opened), 'jobs/service-boiler.md');

  // The notice.
  await page.locator('.slate-card[aria-label="Lunch"] .slate-card-button').click();
  await page.waitForFunction(() => document.querySelector('.slate-card[aria-label="Lunch"] .slate-card-status').textContent.includes('Acknowledged'));
  assert.deepEqual(await page.evaluate(() => window.acked), ['lunch.md', 'blob-lunch']);

  // The form: a missing answer is caught here, the server's refusal shows, then it sends and hides.
  const lock = page.locator('.slate-card[aria-label="Lock up"]');
  await lock.locator('.slate-card-button').click();
  assert.match(await lock.locator('.slate-card-status').textContent(), /needs fixing/);
  await lock.locator('input[value="No"]').check();
  await lock.locator('.slate-card-button').click();
  await page.waitForFunction(() => document.querySelector('.slate-card[aria-label="Lock up"] .form-error:not([hidden])'));
  assert.match(await lock.locator('.form-error').first().textContent(), /Lock it first/);
  await lock.locator('input[value="Yes"]').check();
  await lock.locator('.slate-card-button').click();
  await page.waitForFunction(() => document.querySelector('.slate-card[aria-label="Lock up"]').hidden);
  assert.deepEqual(await page.evaluate(() => window.sent), [['lock-up.md', { locked: 'No' }], ['lock-up.md', { locked: 'Yes' }]]);

  // Edit draws cards as blocks too.
  await page.evaluate(async () => { await window.editor.setWorkspaceMode('edit'); });
  await page.waitForTimeout(600);
  assert.ok(await page.locator('.cm-content .slate-card[aria-label="Open jobs"] .slate-card-number').count() === 1, 'edit: count card drawn');

  // Without a host a card says where its data shows.
  await page.evaluate(async () => { window.editor.setCardHost(null); await window.editor.setWorkspaceMode('preview'); });
  await page.waitForTimeout(400);
  assert.match(await page.locator('#previewPane .slate-card[aria-label="Open jobs"] .slate-card-message').textContent(), /Slate Viewer/);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.editor.setCardHost(window.host));
  await page.waitForTimeout(800);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  console.log('cards: all checks passed');
} finally {
  await browser?.close();
  server.close();
}
