# Slate v0.21.2: readable table columns

Prepared 2026-11-08. Source and version metadata updated. Build, checks,
commit, tag, push and release are pending; David runs them.

The document and live blocks use `overflow-wrap: anywhere`. In a table that
also lowers each cell's minimum content width to a single character, so long
descriptions take space away from short keys. Tables now use `break-word`:
normal word widths participate in column sizing, with emergency wrapping for
oversized content. Prose, code blocks and Markdown source are unchanged.

No dependencies, configuration or schema changes. No Docker required.

Use the coordinated Company `docs/release-0.96.22.md` sequence with
`scripts/releases/0.96.22.json`. David runs the Company laptop helper, which
builds Slate, stages all manifest files (including regenerated `slate.js`),
shows the staged diff for review, commits, checks committed HEAD contents,
creates **v0.21.2**, pushes main and that tag, and waits for Slate's
`release.yml` before proceeding to Viewer and Company. It never replaces tags.
The exact commands it performs after review include:

```powershell
git -C C:\Claude\zt\Slate tag -a v0.21.2 -m 'Metatrash v0.21.2'
git -C C:\Claude\zt\Slate push origin main
git -C C:\Claude\zt\Slate push origin refs/tags/v0.21.2
```

These are explanatory; do not repeat them after the helper has created the tag.
The helper copies the tagged CSS into Viewer's `public/slate/slate.css`.
Company records the accepted Slate commit and builds from that pinned source.

David's acceptance: use a two-column Key / What it does table with backticked
`name`, `on`, `when`, `every`, `do` and several sentences in each description.
At roughly 740px width, the keys should remain whole and descriptions should
wrap between words. Repeat in rendered editing, Preview, light/dark/paper,
print and a narrow window. Check a long URL and a three-column table, too.
Build and existing browser coverage run in Actions; Codex ran none locally.

Rollback consumers to their previous tagged component/assets and rebuild in a
new release; never move v0.21.2. Company server installation, executable
bootstrap, health verification and rollback commands are fully specified in
its new release guide. No data migration or recovery is needed for this CSS.
