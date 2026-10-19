# Slate Markdown Editor Components — 0.14.1

This project is the reusable Slate Markdown editor extracted from the current Wire integration.

The functional editor remains deliberately simple to reuse: **all editor markup, navigation, formatting controls, modes, outline logic, Markdown rendering, checklist logic, media handling, persistence and public API live in `slate.js`**. A host application only needs `slate.js` and `slate.css`.

Edit and Source are one [CodeMirror 6](https://codemirror.net/) editor: Source shows the raw Markdown, Edit draws it in place (Live Preview). Preview is Slate's own read-only rendering. `slate.js` is built from `src/` with CodeMirror bundled in, so hosts still load one script and one stylesheet with no other dependency (see **Building** below).

## What is included

- `slate.js` — complete Slate 0.14.1 editor/component, built from `src/` (don't edit it by hand).
- `src/slate.js` — the editor source; `src/source-editor.js` — the CodeMirror editor behind Edit and Source; `src/live-preview.js` — Edit mode's Live Preview drawing.
- `slate.css` — generic scoped component styling.
- `mermaid/` — [Mermaid](https://mermaid.js.org/) for diagrams, built from `src/mermaid-entry.js`: `mermaid.js` plus a chunk per diagram type. Hosts copy the folder next to `slate.js`; it is loaded only when a document has a diagram (see **Diagrams**).
- `themes/bartco.css` — the current Wire/Bartco light-theme overrides, kept separately so the component can be reused elsewhere without forcing Bartco branding.
- `slate-editor.d.ts` — TypeScript declarations for the host API.
- `index.html` — standalone persistent editor using the Bartco theme.
- `examples/host-controlled.html` — embed Slate in another application while the host owns the Markdown.
- `examples/read-only-checklist.html` — read-only instructions with interactive task checkboxes, matching Wire's published-instructions use case.
- `examples/attachment-handler.html` — host attachment callback example.
- `docs/attachment-api.md` — attachment callback contract.

## Building

`slate.js` is generated. Edit the files in `src/`, then rebuild (Node.js 20 or newer):

```powershell
npm install
npm run build        # minified slate.js and mermaid/, as committed and shipped
npm run build:dev    # readable slate.js with an inline source map, for debugging
npm run watch        # rebuild on every change while developing
```

Commit the rebuilt `slate.js` (and `mermaid/` when Mermaid changes) with the source change, so hosts can keep copying the files.
`npm run build:slate` and `npm run build:mermaid` build one of them.

## Run the standalone editor

The simplest option is:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080/`.

On Windows you can also run:

```powershell
.\start_slate_editor.bat
```

The standalone page uses Slate's local IndexedDB document and attachment storage.

## Minimal host integration

```html
<link rel="stylesheet" href="slate.css">
<div id="assemblyInstructions" style="height:680px"></div>
<script src="slate.js"></script>
<script>
(async () => {
  const host = document.querySelector('#assemblyInstructions');

  const editor = await window.SlateMarkdownEditor.mount(host, {
    markdown: '# Assembly instructions\n\n- [ ] Fit bracket\n',
    persist: false,
    persistSettings: false,
    workspaceMode: 'edit',
    showReadyToast: false,
  });

  host.addEventListener('slate:change', event => {
    saveIntoApplication(event.detail.markdown);
  });
})();
</script>
```

Slate adds `.slate-editor-host` to the supplied host element. All component styles are scoped below that class, so Slate can live directly inside another application without an iframe.

## Optional Bartco/Wire theme

Load the theme after the base stylesheet:

```html
<link rel="stylesheet" href="slate.css">
<link rel="stylesheet" href="themes/bartco.css">
```

The optional theme contains the green/gold document styling currently used by Wire. Removing it leaves Slate's original neutral/purple component theme intact.

## Mount options

```javascript
const editor = await window.SlateMarkdownEditor.mount(host, {
  markdown: initialMarkdown,
  persist: false,
  persistSettings: false,
  workspaceMode: 'edit',        // edit | preview | source
  outlineOpen: true,
  readOnly: false,
  interactiveTasks: false,
  theme: 'auto',                // auto | light | dark
  showReadyToast: false,
  attachmentHandler: null,
  resolveUrl: null,
  outlinePanel: true,
  diagramsUrl: '',              // where mermaid/mermaid.js is; default: next to slate.js
});
```

### Diagrams and `diagramsUrl`

A fenced code block tagged `mermaid` is drawn as a diagram in Preview and Edit (flowcharts, sequence, state, class and Gantt diagrams, mind maps, pie charts and the rest of [Mermaid](https://mermaid.js.org/)):

````markdown
```mermaid
flowchart LR
  A[Start] --> B{Ok?}
  B -- yes --> C[Done]
```
````

Mermaid is large, so it isn't in `slate.js`. The first diagram in a page loads `mermaid/mermaid.js` (an ES module) from the folder `slate.js` was loaded from, and that loads only the chunks its diagram types need (a flowchart is about 2.3 MB, read once). Pass `diagramsUrl` with the full URL of `mermaid.js` if it lives elsewhere. Until it loads, or if it can't, the block shows its source. A diagram with a mistake shows Mermaid's message above its source.

In Edit a diagram is a block like a table: clicking it, or its ✎ button, shows the source with the diagram drawn underneath as you type. Diagrams follow the host's light or dark theme (`data-theme` on the host). Mermaid runs with `securityLevel: 'strict'`, so diagram text can't run script or load anything.

### `outlinePanel`

`true` (default) shows Slate's own document navigation panel and its gutter button. Set it to `false` when the host draws the outline itself: the panel and gutter are hidden, and the host builds its own from `getOutline()` and the `slate:outline` event, calling `revealLine(line)` when a heading is clicked. `outlineOpen`, `setOutlineOpen()` and Ctrl+Shift+O still track whether the outline should be shown, and `slate:outline-toggle` reports changes.

### `resolveUrl`

Optional `(url, { kind }) => string`, where `kind` is `image` or `link`. Slate calls it when rendering an image `src` or link `href`, so a host can map relative paths (for example `img/a.png`) to something its page can load, such as a desktop app's file URL for the document's folder. The Markdown keeps the original URL; the rendered element carries it in `data-md-url`. Return a falsy value to leave a URL unchanged. `attachment://` URLs are never passed to it.

Web links (`http://`, `https://`) get a small ↗ after them. Bare addresses (`https://example.com`, `www.example.com`) and `<https://…>` are links too, as on GitHub. In Edit a plain click on a link's text places the cursor and Ctrl+click opens it; a plain click on the ↗ (class `slate-external-icon`, carrying `data-md-url`) opens it. Hosts that route links themselves can catch clicks on that class too.

### `persist`

- `true` (default): the document is stored in Slate's IndexedDB.
- `false`: the host application owns the Markdown.

### `persistSettings`

Controls Slate UI settings such as mode and outline state. It defaults to the value of `persist`.

### `workspaceMode`

- `edit` — Obsidian-style Live Preview: the Markdown drawn in place (headings, emphasis, links, lists, task checkboxes, quotes, code, tables, images and videos), with the syntax shown only where the cursor is. Tables, images and videos open as source when the cursor reaches them (or by clicking a table cell or a media block's ✎ button). Enter continues lists, tasks and quotes.
- `preview` — rendered document.
- `source` — the complete Markdown in a CodeMirror editor (syntax colouring, undo/redo with Ctrl+Z / Ctrl+Y, Tab indents).

### `readOnly`

`readOnly: true` hides editing controls and forces Preview.

### `interactiveTasks`

When enabled, ordinary `[ ]` / `[x]` task checkboxes remain interactive even in Preview/read-only mode. This is useful for assembly instructions, QA sheets, work travellers and other operational checklists.

Locked `[>]` video tasks are not directly clickable and complete only through supported playback completion.

## Public API

`mount()` returns the editor instance:

```javascript
const editor = await window.SlateMarkdownEditor.mount(host, options);
```

Available properties and methods:

```text
version
host
documentComplete
getMarkdown()
setMarkdown(markdown)
getWorkspaceMode()
setWorkspaceMode('edit' | 'preview' | 'source')
setReadOnly(boolean)
setInteractiveTasks(boolean)
setAttachmentHandler(handler | null)
isOutlineOpen()
setOutlineOpen(boolean)
getOutline()            // { headings: [{ id, level, line, title, checked, total, children }], completion }
revealLine(line)        // scroll to (or, in Source, select) a zero-based Markdown line
getTopLine()            // zero-based Markdown line at the top of the view, in any mode
selectSourceRange(start, end?, { focus? })  // Edit and Source: select offsets into getMarkdown() and scroll them to the middle
setSourceHighlights(ranges, current?)       // Edit and Source: highlight [start, end) find matches; [] clears
compare(markdown, { label? })  // show another version inline (see Compare below); resolves to { comparing, label, differences }
endCompare()            // end it, keeping the document as it stands; returns what was left
isComparing()
getCompareState()       // { comparing, label, differences }
isDocumentComplete()
getCompletionState()
onDocumentComplete(callback, options?)
focus()
```

The initial global `window.SlateMarkdownEditor` facade also exposes `mount()`, `ready`, and `setAttachmentHandler()`.

`setMarkdown()` replaces the text through the smallest change, so in Edit and Source the cursor and scroll position stay where they were when a host reloads a file that changed on disk. It also clears the undo history, since the new text is a fresh starting point.

### Compare

`compare(markdown, { label })` shows another version of the document inline, using CodeMirror's merge view. It is meant for a host resolving a sync conflict or a file that changed on disk while it was being edited:

```javascript
await editor.compare(textOnServer, { label: 'Space version' });
```

Slate switches to Source and shows a bar with the two colours, how many differences are left, **Use all of {label}** and **Done**. Text only in the other version is red, text only in this document green, and each difference has **Keep this** and **Use {label}** buttons. The document itself is what gets edited, so `slate:change`, saving and undo work as usual; the other version is never changed. Done returns to the mode the user was in. The comparison also ends on `endCompare()`, `setMarkdown()`, a mode change or `setReadOnly(true)`, each firing `slate:compare-end`. `compare()` rejects while the editor is read only.

Current Slate 0.14.1 supports **one mounted editor per page**.

## Events

Events are dispatched from the mounted host and bubble normally:

### Markdown changed

```javascript
host.addEventListener('slate:change', event => {
  console.log(event.detail.markdown);
});
```

### Save requested (host-controlled only)

With `persist: false`, Ctrl+S / Cmd+S no longer shows Slate's "Saved locally" toast. Slate prevents the browser default and dispatches `slate:save-request` instead, so the host can save the document itself:

```javascript
host.addEventListener('slate:save-request', event => {
  saveFile(event.detail.markdown, { saveAs: event.detail.saveAs }); // saveAs is true for Ctrl+Shift+S
});
```

### Outline changed

Fired whenever the heading tree is rebuilt, with the same value `getOutline()` returns:

```javascript
host.addEventListener('slate:outline', event => {
  renderOutline(event.detail.headings);
});
```

### Outline shown or hidden

```javascript
host.addEventListener('slate:outline-toggle', event => {
  console.log(event.detail.open); // after Ctrl+Shift+O, setOutlineOpen() or the panel buttons
});
```

### Compare ended

```javascript
host.addEventListener('slate:compare-end', event => {
  // reason: 'done' | 'host' | 'replaced' | 'mode' | 'read-only'; differences: how many were left
  const { reason, label, differences, markdown } = event.detail;
});
```

### Ready

```javascript
host.addEventListener('slate:ready', event => {
  console.log(event.detail.api, event.detail.version);
});
```

### Checklist completion changed

```javascript
host.addEventListener('slate:completion-change', event => {
  console.log(event.detail);
});
```

### Whole document completed

```javascript
host.addEventListener('slate:document-complete', event => {
  console.log(event.detail);
});
```

The completion state contains:

```javascript
{
  hasCheckboxes,
  total,
  checked,
  unchecked,
  complete,
}
```

## Host-controlled published checklist

This is the pattern used by Wire for generated assembly instructions:

```javascript
const editor = await window.SlateMarkdownEditor.mount(host, {
  markdown: instructionsMarkdown,
  persist: false,
  persistSettings: false,
  workspaceMode: 'preview',
  readOnly: true,
  interactiveTasks: true,
  showReadyToast: false,
});
```

The document text remains non-editable while normal task checkboxes can still update the underlying Markdown and emit `slate:change`.

## Attachments

Without a host callback, Slate stores dropped/pasted/selected files in IndexedDB and uses local URLs such as:

```markdown
![image.png](attachment://generated-id)
!video[video.mp4](attachment://generated-id)
[file.pdf](attachment://generated-id)
```

For application integration, provide an `attachmentHandler` that uploads the original `File` objects and returns durable URLs:

```javascript
attachmentHandler: async (files, context) => {
  const uploaded = await uploadFiles(files, context.source);
  return uploaded.map(item => ({
    file: item.file,
    url: item.url,
    label: item.file.name,
  }));
}
```

See `docs/attachment-api.md` for the complete callback contract.

## Navigation and formatting controls

The UI is not duplicated in host HTML. `slate.js` contains the complete component template, including:

- formatting toolbar
- Edit / Preview / Source controls
- outline/navigation gutter and nested heading tree
- heading completion indicators
- attachment picker
- Markdown editor and rendered document surfaces
- save/document status
- toast region

This is intentional: host applications mount one component rather than recreating or synchronising Slate's internal controls.

## Current editor features preserved from Wire

- Obsidian-style Live Preview with marker reveal while editing (on CodeMirror since 0.11.0, sharing Source's undo history).
- Edit, Preview and Source modes.
- Formatting controls for bold, italic, strike, headings, blockquote, inline/code block, links, wiki links, tasks and video syntax.
- Headings through level six.
- Nested document outline generated from headings.
- Section and whole-document checklist completion state.
- Selectable/copyable rendered Preview.
- Interactive tasks in otherwise read-only Preview.
- Images, direct video, YouTube, Vimeo and supported embedded media.
- Locked watch-completion video tasks.
- Picker, paste and drag/drop attachments.
- Host-controlled attachment upload callback.
- Standalone IndexedDB persistence and attachment storage.
- Host-controlled nonpersistent Markdown.
- Light/dark theme support.
- Scoped CSS suitable for direct embedding in an existing page.

## Limitations

- One Slate editor instance per page in 0.14.1.
- Edit draws headings written with `#` only; a line of `---` under text shows as a rule, matching Preview.
- The built-in Markdown parser covers the Markdown used by Slate/Wire but is not a complete CommonMark implementation.
- Wiki links render but Slate does not provide a note collection/router itself.
- Remote video providers may load their official browser APIs when needed.

## How Metatrash, Slate and Slate Viewer fit together

These three projects are parts of one whole, kept in sibling folders:

- **Metatrash** (`metatrash.com - 2026`) is the service: shared spaces of text files backed by Git,
  reached over MCP and REST, plus `mtsync`, which syncs a space with a local folder.
- **Slate** (`Slate`) is the Markdown editor component. Slate Viewer and other hosts embed its
  built `slate.js` and `slate.css`; fix editor bugs here, not in a host's copy.
- **Slate Viewer** (`Slate_Viewer`) is the desktop app. It vendors Slate in `public/slate/`. For now it
  is a handy Markdown editor that can also open Metatrash spaces (through `mtsync`). Over time it
  becomes the desktop companion for managing Metatrash spaces, and those features come later.

Metatrash's website still bundles an older Slate (0.9.2) for read-only viewing. It isn't
upgraded yet.

## Relationship to Wire

The editor core in this package is copied from Wire's bundled Slate 0.9.2. The only packaging change is that the later Bartco light-theme CSS override has been separated into `themes/bartco.css`; loading that file after `slate.css` reproduces the Wire appearance while allowing other web apps to use the generic theme.
