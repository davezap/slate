# Changelog

## 0.14.1 — 2026-10-19

- Diagrams work on pages whose Content-Security-Policy doesn't allow inline styles (Metatrash's website): Mermaid's CSS now goes into a constructed stylesheet (`document.adoptedStyleSheets`) instead of a `<style>` inside each SVG.
- A diagram can't set its own CSS with a `%%{init: {"themeCSS": …}}%%` directive any more; Slate adds `themeCSS` to Mermaid's `secure` keys, since sites show diagrams written by other people.

## 0.14.0 — 2026-10-19

- Diagrams: fenced code blocks tagged `mermaid` are drawn with Mermaid in Preview and Edit. In Edit they are blocks like tables: clicking one (or its ✎) shows the source with the diagram drawn under it as you type. Mistakes show Mermaid's message above the source. Diagrams follow the host's light or dark theme.
- Mermaid lives in the new `mermaid/` folder (`mermaid.js` plus a chunk per diagram type), loaded from next to `slate.js` only when a document has a diagram, so `slate.js` stays the same size. The new `diagramsUrl` mount option points elsewhere. `npm run build` now builds both (`build:slate`, `build:mermaid`).
- Edit re-measures block heights when a table, image or diagram finishes drawing.

## 0.13.0 — 2026-10-19

- Bare web addresses (`https://example.com`, `www.example.com`) and `<https://…>` autolinks are now links in Preview and Edit, as on GitHub. Trailing sentence punctuation stays out of the link.
- Web links show a small ↗ after them in Preview and Edit. In Edit a plain click on the ↗ opens the link without moving the cursor (Ctrl+click on the text still works too). The icon has the class `slate-external-icon` and carries `data-md-url`, so hosts can route it.

## 0.12.0 — 2026-10-17

- Added Compare: `compare(markdown, { label })` shows another version of the document inline with CodeMirror's merge view (red for text only in that version, green for text only in this document), with **Keep this** and **Use {label}** on each difference and **Use all of {label}** and **Done** in a bar above the editor. The document stays editable and saves as usual. Slate Viewer uses it for files that changed on disk while being edited and for sync conflict copies.
- Added `endCompare()`, `isComparing()`, `getCompareState()` and the `slate:compare-end` event.
- Bundles `@codemirror/merge`.

## 0.11.0 — 2026-10-17

- Edit (Live Preview) mode now runs on the same CodeMirror editor as Source, with the Markdown drawn in place: headings, bold, italic, strikethrough, inline code, links, wiki links, bullets, task checkboxes, quotes, rules and code blocks. The syntax shows only around the cursor (the line for headings and quotes, the element for inline formatting, the marker for lists and tasks).
- Tables, standalone images and videos are drawn as blocks in Edit. Putting the cursor on one (arrow keys, clicking a table cell, or a media block's ✎ button) shows its source in the editor font, with an image or video still drawn underneath.
- Undo and redo now work in Edit, and Edit and Source share one history, cursor and scroll position (the line at the top stays put when switching).
- Task checkboxes tick in Edit with a click; video tasks still tick themselves when watched through, in Edit and Preview.
- Enter continues lists, tasks and quotes in Edit, and ends the list on an empty item, as before.
- Ctrl+Click opens a link in Edit.
- `selectSourceRange()` and `setSourceHighlights()` now work in Edit as well as Source, so hosts can use the same find in both.
- Added `getTopLine()`: the zero-based Markdown line at the top of the view, in any mode, for hosts that track the current heading.
- Preview is drawn only while it shows, rather than after every edit.
- Removed Slate's old per-line Edit editor.

## 0.10.0 — 2026-10-16

- Source mode is now a CodeMirror 6 editor instead of a textarea: Markdown syntax colouring, real undo and redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z) including toolbar changes, Tab / Shift+Tab indent, and long documents stay fast. Spellcheck, the toolbar, Ctrl+B / Ctrl+I / Ctrl+K, paste and drop of files and the outline work as before.
- `setMarkdown()` applies only what changed, so in Source mode the cursor and scroll position survive a host reloading a file that changed on disk. It clears the undo history.
- Added `selectSourceRange(start, end, { focus })` and `setSourceHighlights(ranges, current)` so hosts can show find results in Source mode.
- `slate.js` is now built from `src/` with esbuild (`npm run build`), with CodeMirror bundled in. Hosts still load just `slate.js` and `slate.css` (about 385 KB minified, 120 KB gzipped).
- Edit (Live Preview) mode is unchanged in this release.

## 0.9.4 — 2026-10-16

- Added the `outlinePanel: false` mount option for hosts that draw their own document navigation: Slate's outline panel and gutter are hidden and the document takes the full width.
- Added `getOutline()` and the `slate:outline` event (the heading tree with checklist counts) and `revealLine(line)` (scrolls to a heading, or selects it in Source).
- Added the `slate:outline-toggle` event, fired when the outline is shown or hidden by Ctrl+Shift+O, `setOutlineOpen()` or the panel buttons.
- Ctrl+Shift+E no longer switches between Edit and Preview (only Ctrl+E does), leaving it free for hosts.

## 0.9.3 — 2026-10-16

- Added the `resolveUrl(url, { kind })` mount option so hosts can map relative image and link URLs to loadable URLs. The Markdown keeps the original URL, carried on rendered elements as `data-md-url`.
- With `persist: false`, Ctrl+S / Cmd+S now dispatches `slate:save-request` (with `markdown` and `saveAs`) instead of showing the "Saved locally" toast.
- Fixed read-only mode in a full-height host: with the toolbar hidden, the document area collapsed and the status bar took the spare height.
- Wiki links now show their target (`[[Note]]`) as a tooltip instead of a note saying they are document-local, since a host may make them navigable.

## 0.9.2-wire.1 — 2026-08-28

- Extracted the current Wire-bundled Slate 0.9.2 editor into a standalone reusable component project.
- Kept all editor markup, navigation, formatting controls and behaviour inside `slate.js`.
- Preserved direct host mounting, scoped CSS, host-controlled Markdown, attachment callbacks, outline navigation, document completion, read-only Preview and interactive checklist support.
- Split Wire's Bartco light-theme overrides into optional `themes/bartco.css` so the editor can be reused without Bartco branding while retaining the exact theme when desired.
- Added standalone and host-integration examples plus TypeScript declarations and attachment API documentation.
