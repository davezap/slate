# Changelog

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
