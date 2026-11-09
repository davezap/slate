# Slate v0.22.0: guided forms (defaults, show-if, auto flow, photos)

Prepared 2026-11-09 by Claude. Claude ran `npm run build:slate`,
`node test/forms-flow-check.mjs` and a Playwright check of fill mode
(defaults filled in, questions shown and hidden as Damaged? changes, focus kept,
Send blocked on the newly required questions, only asked questions sent), of
auto flow (steps appear as the ones before are done) and of a photo field on a
desktop and a phone-sized page (a 3000×2000 picture added as a 1600×1067 JPEG,
the next step appearing once it's there, remove, at most max, Send handing over
data URLs, drafts without photos).
Pending David: the release helper's build, staged review, commit, tag and push.

## What changes

`src/forms.js` reads two new field attributes, as Metatrash Core 0.95.19 does:
`default=` (text, `@name`, `@email`, `@today`, `@now`) and `show-if=`
(`field`, `!field`, `field=A|B`, `field!=A`, `> >= < <=`). Fill mode:

- starts each field at its default; `startFill({ person: { name, email } })`
  supplies `@name` and `@email`. One the host doesn't give is left to the server.
- hides each block whose `show-if` isn't met and draws the form again when an
  answer changes what is asked, keeping focus and the caret.
- Send checks only the questions asked and hands over only their answers.
- `autoFlow: true`: the headings are steps, each shown once the steps before
  it are complete.
- `{{photo name=… max=N}}`: Take photo (phones) and Choose photo, scaled to
  at most 1600 pixels as JPEG (no Exif), thumbnails with remove. The answer
  Send hands over is a list of data URLs; drafts leave photos out.

`slate-editor.d.ts`: `SlateFillOptions.person`, `SlateFormField.default` and
`showIf`, `'photo'` field type. `slate.css`: photo picker styles.

## Release

Part of Company `docs/release-0.96.27.md`. The helper builds Slate, commits the
manifest's Slate files, tags **v0.22.0**, pushes, waits for Slate's
`release.yml`, then copies `slate.js`, `slate.css` and `slate-editor.d.ts` into
Slate Viewer's `public/slate/`.

## Rollback

Hosts go back to Slate 0.21.2 in a new release; never move v0.22.0. With 0.21.2
a template using `default=` or `show-if=` shows as a template mistake.
