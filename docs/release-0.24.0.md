# Slate v0.24.0: dashboard cards

Prepared 2026-11-18 by Claude. Claude ran `npm install` and `npm run build`
(slate.js, mermaid/ and the new charts/), then `node test/cards-check.mjs`,
`node test/embeds-check.mjs`, `node test/hostile-check.mjs`,
`node test/forms-flow-check.mjs`, `node test/blockquotes-check.mjs` and a
browser check of the page's fill mode, in a cloud copy of this repository;
all passed.
Pending David: the release helper's build, staged review, commit, tag and push.

## What changes

- `src/cards.js` (new): reads a ```` ```card ```` block (`parseCard`), its
  `show-if` conditions, number formats, a table's columns and sorting.
- `src/charts-entry.js` (new): Chart.js 4.5.1 pie (doughnut), bar and line,
  built to `charts/charts.js` by `npm run build:charts` (now part of
  `npm run build`). Loaded only when a page has a chart card.
- `src/slate.js`: card blocks in Preview, Edit, Show Changes and fill mode;
  `cardHost` and `chartsUrl` options; `setCardHost()` and `refreshCards()`;
  cards refresh every minute while visible and on focus. Fill mode's helpers
  take a fill object (`pane`, `statusEl`, `submitEl`), so a form card runs its
  own fill beside the page's.
- `slate.css`: the card grid, cards, tables, buttons, `--slate-chart-1..8`
  per theme, print.
- `package.json`: version 0.24.0, dependency `chart.js` 4.5.1, `build:charts`.
- `slate-editor.d.ts`: `SlateCardHost`, `SlateCardQuery`,
  `SlateCardQueryResult`, `SlateNoticeStatus`, the two options and methods.
- `test/cards-check.mjs`, `test/cards-page.js` (new); `.github/workflows/release.yml`
  runs the cards check and uploads `charts/`.
- README section "Dashboard cards", CHANGELOG.

## Release

Part of Company `docs/release-0.96.56.md`. The helper builds Slate, commits the
manifest's Slate files (add `charts/charts.js`, `src/cards.js`,
`src/charts-entry.js` and the two test files), tags **v0.24.0**, pushes, waits
for Slate's `release.yml`, then copies `slate.js`, `slate.css`,
`slate-editor.d.ts` and `charts/` into Slate Viewer's `public/slate/`
(Viewer 0.44.0).

## Rollback

Hosts go back to Slate 0.23.1 in a new release; never move v0.24.0. With
0.23.1 a `card` block shows as a code block holding its keys.
