// Opens test/hostile.md in Slate (the built slate.js) in each mode and fails if anything in it
// ran script or left a script-capable attribute or URL in the page. Run after `npm run build`:
//   npm install --no-save playwright && npx playwright install chromium && node test/hostile-check.mjs
// The file holds raw control characters on purpose (a "\u0001javascript:" link).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markdown = readFileSync(join(root, 'test', 'hostile.md'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'slate-hostile-'));
writeFileSync(join(dir, 'page.html'), `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${join(root, 'slate.css')}"></head><body>
<div id="host" data-slate-editor-autostart style="height:900px"><script type="text/markdown">${markdown.replaceAll('</script>', '<\\/script>')}</script></div>
<script src="${join(root, 'slate.js')}"></script></body></html>`);

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('dialog', dialog => { problems.push(`dialog: ${dialog.message()}`); void dialog.dismiss(); });
await page.goto('file://' + join(dir, 'page.html'));
await page.waitForTimeout(2000);

const scan = mode => page.evaluate(mode => {
  const found = [];
  if (window.__pwned) found.push(`${mode}: script ran (${window.__pwned})`);
  for (const el of document.querySelectorAll('#host *')) {
    if (['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED'].includes(el.tagName) && el.type !== 'text/markdown') found.push(`${mode}: <${el.tagName.toLowerCase()}>`);
    for (const a of el.attributes) {
      if (/^on/i.test(a.name)) found.push(`${mode}: ${el.tagName} ${a.name}`);
      if (!['href', 'src', 'xlink:href', 'action', 'formaction'].includes(a.name)) continue;
      let url;
      try { url = new URL(a.value, location.href); } catch { continue; }
      const imageData = url.protocol === 'data:' && el.tagName === 'IMG' && /^data:image\//i.test(a.value);
      if (!['http:', 'https:', 'file:', 'blob:', 'mailto:'].includes(url.protocol) && !imageData) found.push(`${mode}: ${el.tagName} ${a.name}=${JSON.stringify(a.value.slice(0, 60))}`);
    }
  }
  return found;
}, mode);

for (const mode of ['edit', 'preview', 'source']) {
  await page.evaluate(mode => document.querySelector(`[data-workspace-mode="${mode}"]`)?.click(), mode);
  await page.waitForTimeout(800);
  problems.push(...await scan(mode));
}
await page.evaluate(() => document.querySelector('[data-workspace-mode="preview"]')?.click());
for (const link of await page.$$('#host a[href]')) await link.click({ timeout: 500, modifiers: [] }).catch(() => {});
await page.waitForTimeout(500);
problems.push(...await scan('after clicking every link'));
await browser.close();

if (problems.length) {
  console.error(`hostile.md: ${problems.length} problem(s)\n` + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('hostile.md: nothing ran, no script-capable attribute or URL in edit, preview or source.');
