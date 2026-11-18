# Slate 0.24.1: plain text, submitTo wording

Prepared 2026-11-18 by Claude (thread "Build Collumii dashboards") for
Company 0.96.57 with Metatrash Core 0.99.1 and Slate Viewer 0.44.1.

**Plain text** (Dave: until there are renderers for CSV and other types,
files that aren't Markdown should look as they do in the source editor):
`setPlainText(on)` / `isPlainText()`. Preview draws `pre.slate-plain-text`
(the editor's font, 14px, line height 1.65, wrapped, no border) instead of
Markdown blocks, so no cards, diagrams or embeds; the source editor
(`plainText` setter in `src/source-editor.js`) drops the Markdown language,
highlighting and live preview (new `language` and `spelling` compartments)
and spell check, in Edit and Source alike; `[data-plain-text="true"]` hides
the formatting buttons. Turning it off puts all of them back.

**No ligatures in code** (Dave: typing `!=` in Source showed `≠`): the text was
always `!=`; Cascadia Code, the editor's first font, joins it into one
glyph. `slate.css` turns off `liga` and `calt` for the editor, `code`,
`pre`, `kbd` and `samp`.

Core 0.99.1 reads a form's `submitTo` like a path: `/owner/space/folder/`
is a space, anything else a folder of the form's own space. Slate only
checks that `submitTo` is there, so the one change is its message
(`src/forms.js`, built into `slate.js`): "name the folder that receives the
answers, such as done/ in this space or /owner/hr-review/leave/ in another".
`test/cards-page.js`'s form uses `submitTo: done/`.

Checked in the cloud: `npm run build`, `test/cards-check.mjs`,
`test/forms-flow-check.mjs`, `embeds-check`, `hostile-check`,
`blockquotes-check`, and a browser check of plain text (a C file: Preview
shows it as typed with no headings, Edit has no Markdown marks and spell
check off, and turning it off brings them back).
