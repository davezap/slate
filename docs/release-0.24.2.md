# Slate 0.24.2: mode buttons stay on the right

Prepared 2026-11-18 by Claude (thread "Build Collumii dashboards") for
Company 0.96.58 with Slate Viewer 0.44.2 (Metatrash Core unchanged, 0.99.1).

Dave: in a CSV file, Edit | Preview | Source jumped to the left in Edit and
Source. The formatting buttons are hidden for plain text and they were what
pushed the switcher right. `slate.css` now ends the toolbar at the right
(`justify-content: flex-end`, as Preview already did) whenever they are
hidden: plain text, Show Changes and form filling.

`APP_VERSION` in `src/slate.js` had stayed at 0.24.0 through 0.24.1; it is
0.24.2 now. Built with `npm run build`.
