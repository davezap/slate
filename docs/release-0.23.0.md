# Slate v0.23.0: named embeds

Prepared 2026-11-14 by Claude. Claude ran `npm run build:slate` (the 0.22.0
source rebuilt byte for byte first), `node test/embeds-check.mjs`,
`node test/hostile-check.mjs` and `node test/blockquotes-check.mjs` in a
cloud copy of this repository; all passed.
Pending David: the release helper's build, staged review, commit, tag and push.

## What changes

- `src/edition.js`: `embeds = {}` (the public edition has none).
- `src/slate.js`: a fenced block tagged `embed` whose only line names one of
  the edition's embeds becomes `<div class="slate-embed" data-embed="name">`,
  and `hydrateEmbeds()` calls that embed's `mount(element)` wherever diagrams
  are drawn (Preview, Edit's blocks, Show Changes, fill mode). Anything else
  stays code. Names must match `^[a-z0-9][a-z0-9-]{0,63}$` and be the edition's
  own (`Object.hasOwn`), so `__proto__` and friends stay code.
- `src/live-preview.js`: an embed block is estimated at 320 px like a diagram.
- `slate.css`: `.slate-embed` spacing, ✎ button on hover, hidden in print.
- `test/embeds-check.mjs`, `test/embed-edition.js`; two `embed` blocks added
  to `test/hostile.md`.
- README section "Named embeds", CHANGELOG, package version 0.23.0.

No API, option or type changes; `slate-editor.d.ts` is unchanged apart from
being copied again.

## Release

Part of Company `docs/release-0.96.46.md`. The helper builds Slate, commits the
manifest's Slate files, tags **v0.23.0**, pushes, waits for Slate's
`release.yml`, then copies `slate.js`, `slate.css` and `slate-editor.d.ts` into
Slate Viewer's `public/slate/` (Viewer 0.39.1).

## Rollback

Hosts go back to Slate 0.22.0 in a new release; never move v0.23.0. With
0.22.0 an `embed` block shows as a code block holding its name.
