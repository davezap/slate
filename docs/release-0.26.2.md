# Slate 0.26.2: diagrams fit at any page zoom

Prepared 2026-11-23 by Claude (thread "Fix Mermaid clipping and section jumps").
Tier: Core (every instance draws diagrams with Slate). Nothing in `mermaid/`,
`charts/` or `slate.css` changed.

After 0.96.73 (Slate 0.26.1) Dave saw diagrams fixed on testserver but still
cut off on collumii.com, after an empty-cache reload. The site serves 0.26.1
(checked), and its CSP even allows style attributes (`style-src-attr
'unsafe-inline'`). The difference was Dave's site zoom: Slate Viewer's
Ctrl+wheel zoom on the website is CSS `zoom` on `<html>`, kept per site in
localStorage, so collumii.com was at 90% and testserver at 100%. Mermaid
measures labels with getBoundingClientRect, which includes CSS zoom, so the
boxes were 90% of the text's size (the SVG Dave sent: 266 px boxes for
296 px of text, 21.6 px for 24 px lines). Reproduced in the built-in browser
on collumii.com by setting `zoom: 0.9` on `<html>`.

Fix in `src/slate.js`:

- `pageZoom()`: computed `zoom` of `<html>` times `<body>`.
- `measureUnzoomed(zoom)`: an adopted stylesheet with
  `body > [id^="dslate-mermaid-"]{ zoom: 1/zoom }` (Mermaid's scratch
  element), set before each draw.
- `hydrateDiagrams` keys drawings (`data-rendered-theme` and the cache) by
  theme and zoom, so a zoom change draws them again; `watchPageZoom()`
  (MutationObserver on the style and class of `<html>` and `<body>`) calls it.

Checked in the cloud: `test/diagram-labels-check.mjs` now also zooms to 90%
and 130% (0.26.1 fails it: no redraw), plus `reveal-hold-check` and
`diagram-zoom-check`, all passed. Live check of the stylesheet trick on
collumii.com at 90%: every label fitted.

Workaround until it ships: Ctrl+0 on the site.
