# Slate 0.26.0: zoom and pan diagrams

Prepared 2026-11-19 by Claude (thread "Add zoom and pan to Mermaid diagrams")
with Slate Viewer 0.46.0, released with Company 0.96.61. Tier: Core (every
instance draws diagrams with Slate).

Dave's ask: dense Mermaid diagrams (in the docs and the dashboard examples)
render too small to read.

1. **In the page** (`bindDiagramZoom` in `src/slate.js`, on the mount root):
   Ctrl+wheel (⌘+wheel) zooms a drawn diagram around the pointer, Ctrl+drag
   pans it. The listeners run in the capture phase and stop the event, so
   CodeMirror (which would show the source or add a cursor) and the host's
   Ctrl+wheel page zoom (Slate Viewer) don't see it. The plain wheel scrolls
   the page as before. Zoom changes the SVG's `viewBox` (1x to 20x), keeping
   at least a tenth of the diagram in sight.
2. **Buttons** (`.slate-diagram-tools`, in `diagramHtml`): ⟲ (only once
   zoomed) and expand, at the top right, faint until hover or focus like ✎
   (in Edit they sit to its left). Hidden until the diagram is drawn
   (`.is-drawn`) and in print. They are not `.media-source-toggle`, so they
   also work in Preview and Show Changes.
3. **Full size** (`openDiagramOverlay`): a `.slate-editor-host
   .slate-diagram-overlay` on `<body>` with the host's theme: a sheet over the
   faded page, with a hint line and −, +, ⟲, ✕. Plain wheel zooms (0.5x to
   20x), drag pans, two pointers pinch, double-click or 0 resets, + and −
   zoom, Tab stays inside, Esc / ✕ / a click on the faded page closes and
   focus returns to the expand button. A theme change or printing closes it.
   The copy's ids are renamed like any other copy, so Mermaid's adopted
   styles and arrowheads still apply. No inline styles: works under the site's
   `style-src 'self'`.
4. **Print**: `groupForPrint` first resets every zoomed diagram and closes
   the overlay.

Checked in the cloud: `npm run build`, then `node test/diagram-zoom-check.mjs`
(new) plus code-blocks, cards, embeds, hostile, forms-flow and blockquotes
checks, all passed. Nothing in `mermaid/` or `charts/` changed.

## Code colouring and code files in CodeMirror

Added the same day (thread "Colour and edit code files with CodeMirror"), in
the same 0.26.0. Tier: Core (Slate is public; every instance shows files).

Dave's ask: CodeMirror for editing and previewing code files, coloured by
language, and the same colours in Markdown's fenced code blocks. Agreed design:
.md files keep Slate's own Preview; every other text file opens in CodeMirror,
read only with Edit off and editable with Edit on; the language comes from the
file name; no Preview button.

1. **Which language** (`src/languages-entry.js`): CodeMirror's own list,
   `@codemirror/language-data` (about 140 languages, each with its extensions,
   file names and aliases). `LanguageDescription.matchFilename` picks a file's
   language from its extension or whole name (`Dockerfile`, `CMakeLists.txt`);
   a fence's info string is matched by name or alias
   (`matchLanguageName`), then as an extension. CodeMirror does not guess
   from the text: a name it doesn't know stays plain.
2. **Loading** (`scripts/build-languages.mjs`): `languages/languages.js` (the
   list, about 19 KB) and `languages/chunks/` (a chunk per language and shared
   parts, 1.5 MB in all, of which a page loads only what it shows: Python adds
   about 83 KB, minified, before gzip). The build points the chunks' imports of `@codemirror/state`,
   `view`, `language`, `@lezer/common` and `@lezer/highlight` at the copies in
   `slate.js` (left on `globalThis[Symbol.for('slate.codemirror')]` by
   `src/code-languages.js`), because an editor refuses extensions from another
   copy of CodeMirror and colours match tags only within one copy.
3. **Code files** (`setPlainText(true, { fileName })`, `src/slate.js`
   `applyCodeLanguage`; `src/source-editor.js` `setCodeLanguage`): the
   language's support (parser, indenting, HTML's tag closing and so on) goes
   into the editor's language compartment and the shared colours into its
   highlighting. In Preview the editor shows read only (`editor-grid
   source-view code-view`) instead of the old `pre.slate-plain-text`; the
   rendered pane is empty. Printing makes a coloured `pre.slate-print-code`
   of the whole file at `beforeprint`.
4. **Fenced blocks** (`hydrateCode`, `colourCodeBlocks`): after Preview,
   cards, Show Changes or fill mode draw, each `<code data-language>` is parsed
   with its language's parser and coloured with `highlightTree`; no editor.
5. **Colours** (`codeHighlighter`, `slate.css` `--code-*`, `tok-*`): one set
   for both, per theme.
6. **No Preview button** in the view switcher (Edit | Source). Ctrl+E and the
   API still switch to Preview; hosts show it with read only.

Checked in the cloud: `npm run build`, then `node test/code-colour-check.mjs`
(new: a .py file in Preview and Edit, a .txt file, ```js / ```py / unknown
fences, theme colours, print, the switcher, and only a few language files
loaded) plus every other check in `test/`, all passed. On the cloud machine a
20,000-line (1.2 MB) JavaScript file showed coloured in Preview about half a
second after `setMarkdown`.

**Slate's workflow file** (`.github/workflows/release.yml`) needs
`languages/` in its artifact and the new check; Claude's folder access can't
change it, so the Company release guide has the step.
