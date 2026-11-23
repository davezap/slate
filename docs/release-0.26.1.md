# Slate 0.26.1: diagram labels fit, heading jumps land

Prepared 2026-11-23 by Claude (thread "Fix Mermaid diagrams cutting off text").
Tier: Core (every instance draws diagrams with Slate). Goes out with
Company 0.96.73 (Dave asked to roll it in); nothing in `mermaid/` or `charts/` changed.

Dave's report: Mermaid diagrams on the site often cut off text in nodes and
subgraph titles.

Two causes, both fixed in `src/slate.js` and `slate.css`:

1. **Strict CSP drops Mermaid's label styles.** Mermaid writes each label as
   HTML in a `foreignObject` with `style="display: table; white-space: ...;
   line-height: 1.5; max-width: ...; width: ..."`, and measures it with those
   styles. Slate puts the finished SVG in with `innerHTML`; under
   `style-src 'self'` the browser ignores those `style` attributes, so the
   label inherited Preview's `line-height: 1.7` and `overflow-wrap: anywhere`:
   each line ~3 px taller (the last line cut off) and long words broken. Fix:
   `applyDiagramStyles(root)` copies every `style` attribute into
   `element.style.cssText` (CSSOM, allowed by the policy) after the drawing
   goes in and in `copyDiagramSvg` (full-size view). `slate.css` also resets
   line-height, overflow-wrap, word-break, letter-spacing, white-space and
   friends on `.slate-diagram-canvas` and `.slate-diagram-stage`, matching the
   scratch element at the end of `<body>` where Mermaid measures.
2. **Late web font.** The site loads Inter with `font-display: swap`. If a
   diagram is drawn before Inter arrives, labels are measured in Segoe UI
   (narrower) and drawn in Inter, so text runs past the box (the SVG Dave
   sent shows "Cloudflare edge (~100 s origin timeout)" measured 266 px wide).
   `hydrateDiagrams` now waits for `diagramFontsReady()` (regular and bold of
   the diagram font via `document.fonts.load`, at most 3 s, once per page).

## Outline clicks and #anchor links

Dave's second report the same day: Document Nav on the site seldom lands on
the section (section 3's title half way down, back to section 2 and its title
is off the top; clicking again gets closer), and a link with an #anchor never
lands right.

Cause: `revealLine` in Preview works out the scroll from where the heading is
when it starts (a smooth scroll). Diagrams above it are drawn one at a time
after the page opens (and before 0.26.1, also when the font arrived), so the
heading moved after the scroll was set. Measured in the cloud with eight
sections each holding a diagram: a jump to section 6 made while they drew
ended with the heading 2,614 px down the page.

Fix (`holdPreviewLine` in `src/slate.js`): after `revealLine` in Preview, a
`ResizeObserver` on the Preview blocks puts the heading back at the top
(instant scroll) whenever one changes size, until the reader scrolls (wheel,
touch), clicks or types in the pane, `setMarkdown` opens another document,
`restoreView` restores a saved place, or 15 s pass. Its first callback (every
block's starting size) is skipped, so the smooth scroll still plays. Slate
Viewer's Document Nav (`revealHeading`) and #heading addresses on the site
(`revealPageAnchor` → `revealAnchor`) both call `revealLine`: no Viewer change.

Live check on collumii.com (built-in browser, docs page without diagrams):
jumps there already landed, which fits the cause being diagrams drawing late.

Checked in the cloud: built `slate.js` with esbuild, then
`node test/reveal-hold-check.mjs` (new: a jump while the diagrams draw ends on
the heading; five jumps back and forth scroll smoothly and land; a size change
after the reader scrolls doesn't pull the view back; it fails with 0.26.0),
`node test/diagram-labels-check.mjs` (new: strict CSP, a late web font with a
narrower fallback, checks every label's text fits its box in the page and
full size; it fails with 0.26.0's slate.js) and `test/diagram-zoom-check.mjs`,
all passed. The new check looks for Inter in
`../Slate_Viewer/src/brand/fonts/` or `../metatrash.com/viewer/src/brand/fonts/`
(or `SLATE_TEST_FONT`).

The test page in the docs-space test folder, `vtest/mermaid-clip.md` in
dave-zap/metatrash, shows a similar diagram for checking on testserver.
