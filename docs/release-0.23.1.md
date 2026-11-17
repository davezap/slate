# Slate v0.23.1: the green theme

Prepared 2026-11-17 by Claude (threads "Remove Bartco references from the
code" and "Fix first-visit problems from Adam's feedback"), for Company
0.96.55. No editor change: the source under `src/` is the same as 0.23.0.

## What changes

- `themes/bartco.css` is renamed `themes/green.css`, with the same rules.
- `index.html` loads `themes/green.css`; the README and an old CHANGELOG line
  name it.
- `package.json` / `package-lock.json` 0.23.1, so the built `slate.js` reports
  0.23.1.

Slate Viewer 0.43.0 vendors the same files in `public/slate/` (the release
helper copies `slate.js`, `slate.css` and `slate-editor.d.ts`; the theme and
CHANGELOG copies were made by hand).

Tier: Core (the public editor).

## Check after release

Open `index.html` locally: the editor shows the green-and-gold light theme
as before.
