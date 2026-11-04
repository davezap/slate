# Slate 0.21.1 — grouped blockquotes

David builds, tests and publishes. No build, browser test, generated bundle or
tag was run/created by Codex. Source is in src/slate.js; do not hand-edit slate.js.
Slate v0.21.0 already exists locally, so this release uses **v0.21.1**, with
package.json, package-lock.json and APP_VERSION aligned. Do not move old tags.

Preview now groups consecutive lines starting with > into one source block and
renders its contents as Markdown. Bare > lines create paragraph breaks instead
of empty strips. Separate quotes divided by an unquoted blank line stay separate.
Nested quotes/code/list structures remain inside their container. Quoted task
checkboxes retain offsets to their actual original source lines. Source text and
subsequent block line counts remain intact when changing modes.

This addresses consecutive explicitly quoted lines. It does not claim complete
CommonMark support for every existing Slate Markdown construct or unmarked lazy
quote continuation. Edit/Source continue to use the existing CodeMirror parser.

## Build and check on the laptop

```powershell
Set-Location 'C:\Users\David\OneDrive\Documents\Web\Slate'
git status --short
git diff
npm run build
npx playwright install chromium
node test/blockquotes-check.mjs
node test/hostile-check.mjs
```

If dependencies are missing, run npm ci first. Playwright is already a declared
dev dependency; no Docker is needed. The browser tests load the rebuilt bundle.
Expected new-test results: one outer announcement quote, five nonempty
paragraphs, wrapped source lines joined into a paragraph, separate independent
quotes, nested quotes/lists, quoted code, CRLF, rejected script URLs, exact
checkbox source changes and unchanged Markdown across mode switches.

Visually inspect test/blockquotes.md in Preview. The component itself has neutral
quote styling; Metatrash's company build supplies the warm announcement colours.
Inspect its print output and light/dark/paper themes. These are David's checks,
not checks already performed by Codex.

## Commit, verify, tag and push

Review the rebuilt slate.js; dependencies and Mermaid inputs are unchanged.
If Mermaid generated files changed, review and stage those intended changes too.

```powershell
git add package.json package-lock.json src/slate.js slate.js README.md CHANGELOG.md
git add .github/workflows/release.yml test/blockquotes.md test/blockquotes-check.mjs docs/release-0.21.1.md
git diff --cached --stat
git diff --cached
git commit -m 'Slate 0.21.1: render consecutive quote lines as one block'
git log -1 --oneline
git show HEAD:package.json | Select-String '0.21.1'
git show HEAD:src/slate.js | Select-String 'quoteStart|Quote markers on empty lines'
git ls-tree -r HEAD -- slate.js test/blockquotes-check.mjs .github/workflows/release.yml
git status --short
git tag -a v0.21.1 -m 'Slate 0.21.1'
git push origin HEAD
git push origin v0.21.1
```

Wait for **Slate release validation**. The new workflow checks the tag version,
builds the component, runs browser quote and hostile-Markdown regressions, and
uploads component assets. No GitHub Release publication or server deployment is
performed by this workflow. A failed tag needs a new fix/version, not a moved tag.

## Host releases and rollback

Slate Viewer must copy the rebuilt slate.js, slate.css, slate-editor.d.ts and
mermaid folder into public/slate and release v0.27.2. The private company build
must pin the tagged Slate/Viewer commits and release v0.95.5. Full coordinated
instructions are in the private company's docs/release-0.95.5.md. No Core changes
or introduction.md edits are required.

Rollback consumers by restoring their previous compatible component pin/assets
and rebuilding their release. Markdown source and database schemas are unchanged.
