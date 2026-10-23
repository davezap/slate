# Changelog

## 0.19.0 — 2026-10-23

- Preview hides front matter (the `---` block at the top of a document), as it hides comments. Edit and Source still show it, and it stays out of the outline.
- `startFill({ inPreview: true })` makes the form the document's Preview: Slate switches to Preview, keeps the Edit / Preview / Source switch and has no Stop Filling In. Leaving Preview ends it with reason `'mode'`. The new `slate:mode-change` event (`{ mode, previous }`) tells the host when to start it again.
- `startFill({ readOnly: true })` shows the fields greyed out with no Send, for a page that can't send the form.
- Calling `startFill()` while filling in replaces the form without firing `slate:fill-end`.

## 0.18.0 — 2026-10-23

- Added **forms**: fill mode for form templates (Metatrash 0.49.0). A template's front matter has `form`, `title` and `submitTo`; its fields are `{{type name=… …}}` tokens: `text`, `textarea`, `number`, `date`, `time`, `email`, `phone`, `choice` (one, or several with `multi`), `select`, `yesno` and `sign`, with `required`, lengths, patterns, ranges, and a choice's options from the list below it. `src/forms.js` parses them as Metatrash does.
- `startFill({ answers })` draws the form as in Preview, in place of the document, with inputs for its fields and the template's `<!-- comments -->` shown as hints for the person filling it in. Send checks every answer, shows each problem under its field and fires `slate:form-submit`; the host sends the answers. Also `getForm()`, `isForm()`, `endFill()`, `isFilling()`, `getFillState()`, `getFormAnswers()`, `setFormAnswers()`, `checkForm()`, `setFormProblems()` (the server's, by field), `setFormStatus()`, and the `slate:form-input` and `slate:fill-end` events. The document is never changed.

## 0.17.1 — 2026-10-22

- Preview hides HTML comments (`<!-- … -->`), whole-line, over several lines or inside a line, as GitHub and Obsidian do. They are notes for whoever edits the file, such as a template's instructions; Edit and Source still show them. Headings inside a comment stay out of the outline, and Show Changes doesn't count a changed comment as a change.
- Preview shows a run of underscores, asterisks or tildes (a form's `______` blank) as text. Before, `____` was read as empty bold and disappeared. Emphasis also needs text inside it, not starting or ending with a space, so `a * b * c` stays as typed.

## 0.17.0 — 2026-10-22

- Added **Show Changes**, for reading what changed since another version: `showChanges(markdown, { label, to?, toLabel? })`, `hideChanges()`, `isShowingChanges()`, `getChangesState()` and the `slate:changes-end` event. It shows the changes read only, in place of the document, and works while the editor is read only.
- In Preview the document is drawn rendered, with removed words struck through in red and added words in green. Edited paragraphs, headings, list items, quotes, tables and code blocks are drawn once with the changed words marked; blocks added or removed outright are marked whole. In Edit and Source the Markdown is shown the same way in the merge view.
- The bar over it names the versions ("Changes since version 2", or "Changes from version 1 to version 2" with `to`), counts the changes, steps through them with ↑ and ↓, and has Hide Changes.
- `setChangesToggle(handler)` adds a **± Changes** toggle to the toolbar for hosts that keep versions: on calls the host, which picks the version and calls `showChanges()`; off hides the changes. The toolbar stays visible while read only when there is one, showing only the toggle.
- Compare and Show Changes find each change in long documents with many changes; before, past CodeMirror's default limit, they could show the whole middle of the document as one change.

## 0.16.0 — 2026-10-20

- Added a **paper** theme: a soft, warm page (not white) with near-black text and ink-blue links, for strong contrast without glare. Hosts set `data-theme="paper"` on the host, or mount with `theme: 'paper'`. It's only a set of colour variables in `slate.css`, like light and dark.
- Diagrams in the paper theme are drawn with Mermaid's `base` theme coloured to match the page.

## 0.15.0 — 2026-10-19

- Edit: a plain click on a link in a table (or in a block's caption) no longer opens the link; it places the cursor in that cell to edit it, like links in the text. Ctrl+click opens it. Before, the editor ignored clicks inside blocks, so the browser followed the link into a new window.
- Edit: Ctrl+click on a link in the text opens it reliably. Ctrl+click used to add a second cursor first, which showed the link's syntax and swallowed the click.
- Added `getSourceSelection()` (the cursor or selection as offsets into the Markdown, kept in every mode) and `restoreView({ selection, topLine, focus })`, which puts a saved place back: the selection without scrolling, then the given line at the top of the view, in any mode. Slate Viewer uses them to reopen a folder where you left off.

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
