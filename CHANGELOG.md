# Changelog

## 0.24.1 — 2026-11-18

- **Plain text**: `setPlainText(true)` (and `isPlainText()`) is for a file that isn't Markdown, such as a .txt, a .csv or C source. Preview shows its text as it is, in the editor's font (`pre.slate-plain-text`), with no Markdown, cards or diagrams; Edit and Source edit it with no Markdown language, highlighting, live preview or spell check, and the formatting buttons are hidden. `src/slate.js`, `src/source-editor.js`, `slate.css`, `slate-editor.d.ts`. Slate Viewer 0.44.1 turns it on for every file that isn't Markdown, until there are renderers for CSV and other types.
- **No ligatures in code**: the editor and code in Preview turn off the font's ligatures, so `!=`, `->`, `>=` and `===` show as typed, not as `≠` or arrows (Cascadia Code draws them joined). `slate.css`.
- A form without `submitTo` now says to name a folder such as `done/` in this space or `/owner/hr-review/leave/` in another, matching Metatrash Core 0.99.1, where a path without a leading `/` is a folder of the form's own space and `/owner/space/folder/` another space. `test/cards-page.js`'s form uses `done/`. No other change.

## 0.24.0 — 2026-11-18

- Dashboard cards: a fenced block tagged `card` (`key: value` lines, and for a Markdown card its own text after `---`) is drawn as a card in Preview, Edit (a block like a diagram, ✎ for the source), Show Changes and print. `show` is count, list, table (headers sort), pie, bar, line, markdown or form; `size` normal, wide or full, side by side in a grid; `show-if` uses `@count`, `@time`, `@today`, `@weekday`, `@me` and `@done`. The data comes from the host (`cardHost` option, `setCardHost()`, `refreshCards()`), which answers with the viewer's own access; Slate Viewer 0.44.0 asks Metatrash Core 0.99.0. A card with a mistake shows the message above its source. New `src/cards.js`.
- Charts: pie, bar and line cards load `charts/charts.js` (Chart.js 4.5.1, built from `src/charts-entry.js` by `npm run build:charts`, part of `npm run build`) from next to `slate.js` or `chartsUrl`, only when a page has one. Colours are `--slate-chart-1` to `--slate-chart-8` per theme, in a fixed order checked for colour-blind separation against each theme's panel; a pie's slices take them in order (past eight, the smallest share one slice, Other), bars and lines are one colour, and a count is in the text colour. Charts draw on a canvas, so a page without `style-src 'unsafe-inline'` allows them.
- Form cards: a notice (a `.md` file with no fields) shows its text and an Acknowledge button; a form is filled in on the card and sent through the host, with the server's refusals shown by field. Fill mode's code now works on a fill object of its own, so the page's fill and any number of card fills don't share state; the page's fill behaves as before.
- `test/cards-check.mjs` (with `test/cards-page.js`, a pretend host) serves the folder over HTTP under a strict Content-Security-Policy and checks parsing, every card kind, sorting, links, a notice, a refused then accepted form, Edit, no host, the grid and that nothing but CodeMirror's own `<style>` is refused. Claude ran it, `embeds-check`, `hostile-check`, `forms-flow-check` and `blockquotes-check`, and a browser check of the page's fill mode; all passed. See docs/release-0.24.0.md.

## 0.23.1 — 2026-11-17

- The optional light theme is now `themes/green.css` (was `themes/bartco.css`, same rules); `index.html`, the README and an old CHANGELOG line follow it. No editor change. Released with Company 0.96.55; see docs/release-0.23.1.md.

## 0.23.0 — 2026-11-14

- Named embeds: an edition (`src/edition.js`) can offer `embeds`, `{ name: { label, mount(element) } }`, and a fenced block tagged `embed` whose only line is one of those names is drawn by it in Preview, Edit (as a block like a diagram, with a ✎ button for the source), Show Changes and fill mode. Any other name, a block of several lines or an embed that throws stays an ordinary code block, so documents still can't carry script or styles. The public edition has none. Collumii's site uses it for the support card on its home page (Company 0.96.46).
- `test/embeds-check.mjs` builds Slate with `test/embed-edition.js` and checks embeds in Preview and Edit (drawn, their own buttons work, other names stay code); `test/hostile.md` gains `embed` blocks naming markup and `__proto__`. Claude ran it, `hostile-check.mjs` and `blockquotes-check.mjs`; see docs/release-0.23.0.md.

## 0.22.0 — 2026-11-09

- Forms: fields take `default=` and `show-if=`, read as Metatrash Core 0.95.19 reads them (`src/forms.js`). Fill mode starts each field at its default; `startFill()` takes `person: { name, email }` for `@name` and `@email`, and a field whose person value isn't given stays blank with "Your name, added when sent", left out of the answers so the server fills it in. Questions whose `show-if` isn't met are hidden with their block and drawn again as answers change, keeping the person's place; Send checks and hands over only the questions asked. `getForm()` fields carry `default` and `showIf`.
- Forms: `autoFlow: true` in the front matter makes the headings steps. What comes before the first heading always shows; each later step appears once every question asked in the steps before it is answered, with "The next step appears when this one is done." below the last one shown.
- Forms: `{{photo name=… max=N required}}` (1 to 10 photos, default 1; 20 in a form; not in quizzes, not a default or show-if). Fill mode offers Take photo (phones: the camera) and Choose photo, scales each picture to at most 1600 pixels on its long side as a JPEG at 85% (which drops its Exif, including location), and shows thumbnails with a remove button. Send hands the answer over as a list of data URLs; `fillSnapshot()`, `slate:form-input` and `endFill()` leave photos out so hosts don't keep them in drafts. New styles in `slate.css`.
- `test/forms-flow-check.mjs` (run with Node) checks the parser, defaults, auto flow, photo fields and show-if against `test/guided-form.md`, the same template as Core's Go tests. Claude ran it and a browser check of fill mode; David runs the release. See docs/release-0.22.0.md.

## 0.21.2 — 2026-11-08

- Tables preserve whole words when allocating column widths, so short keys such as `name`, `when` and `every` are no longer squeezed into letter fragments beside long descriptions. Oversized words and URLs can still wrap. Applies to rendered editing, Preview and print. See docs/release-0.21.2.md. David runs builds and acceptance checks; none run by Codex.

## 0.21.1 — 2026-11-04

- Preview groups consecutive quoted lines into one blockquote. A bare `>` separates paragraphs inside that quote instead of creating an empty strip; ordinary wrapped lines form one paragraph. Nested quotes, headings, lists and code are rendered inside their quote container.
- Quote blocks keep their original source and line counts when switching modes. Quoted task checkboxes update their own source line without losing quote markers or modifying neighbouring tasks.
- Added `test/blockquotes-check.mjs` for browser regression coverage, including the Metatrash plans announcement and blocked script URLs. David runs builds and tests; none were run while preparing this release. Follow `docs/release-0.21.1.md`.

## 0.20.1 — 2026-10-31

- A link or image whose address holds a control character or tab, such as `[x](\u0001javascript:…)` with a real U+0001 before `javascript:`, is no longer made a link. Browsers drop those characters before reading the address's scheme, so such a link was a `javascript:` link that the check for `javascript:` missed. It shows as text, like other refused links. (Pages that forbid inline script, such as metatrash.com, never ran it.)
- `test/hostile.md` is a document full of attempts to run script (script and event-handler tags, `javascript:` links in many spellings, `data:` pages, table cells, tasks, wiki links, Mermaid), and `test/hostile-check.mjs` opens it in the built `slate.js` in Edit, Preview and Source, clicks every link, and fails if anything ran or any script-capable attribute or address is left in the page. It needs Playwright (see the file's first lines).

## 0.20.0 — 2026-10-30

- Preview and print show a few plain HTML tags written in the text: `<br>` (also `<br/>` and `<br />`) breaks the line, which is the only way to put several lines in one table cell, and `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<s>`, `<del>`, `<ins>`, `<mark>`, `<sub>`, `<sup>`, `<small>`, `<kbd>` and `<code>` work as their names say. Only the bare tags: a tag with attributes, any other tag, and HTML inside backticks stay as typed, so a document still can't run scripts or change the page.

## 0.19.5 — 2026-10-26

- Print: no blank last page. Blank lines at the end of the document and Preview's own top and bottom space are left out, so the page margins are the document's margins.
- Print: a paragraph that is only links is left out whatever separates the links, including invisible characters.

## 0.19.4 — 2026-10-26

- Print: a heading is never the last thing on a page. Before, the blank line after a heading let the page break there, leaving the heading at the bottom with its table or text on the next page.

## 0.19.3 — 2026-10-26

- Print flows better. Each `##` section that won't fit on what is left of a page starts on the next page (a `###` section within it does the same), so a heading is no longer left at the bottom of a page with its text or diagram on the next. Headings stay with what follows them, and table rows, code blocks and quotes are not split.
- Print leaves out paragraphs that are only links, such as a "Home" link at the top of a page: they're for finding your way on screen.

## 0.19.2 — 2026-10-26

- Print: a diagram taller than the page is scaled down to fit on one page. Before, the printer split its box over several pages and drew the diagram tiny at the end of it.

## 0.19.1 — 2026-10-23

- Preview: a document that starts with front matter or a comment no longer has extra space above its first heading.

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
- Split Wire's light-theme overrides into an optional theme file (now `themes/green.css`) so the editor can be reused without that branding while retaining the exact theme when desired.
- Added standalone and host-integration examples plus TypeScript declarations and attachment API documentation.
