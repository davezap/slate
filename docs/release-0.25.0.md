# Slate 0.25.0: code blocks

Prepared 2026-11-19 by Claude (thread "Build the batch of small site fixes")
with Slate Viewer 0.45.0, Metatrash Core 0.99.3 and Company 0.96.60.

From Dave's notes while using the site:

1. guides/dashboards.md's example, a ````markdown block holding a ```card
   block, fell apart: the first ``` line inside ended the outer block. Fences
   now close only on the same character, at least as long (`src/fences.js`).
2. Inline ```` ```card ```` showed as empty boxes. Code spans now pair runs of
   equal length, in both Preview renderers.
3. Code blocks get a faint copy button at the top right.

Build with `npm run build`, then copy into Slate Viewer and Metatrash as usual
(`scripts/build-frontends.ps1` in Metatrash). Checks: `node
test/code-blocks-check.mjs` and the other `test/*-check.mjs`.
