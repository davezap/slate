// Slate's code colouring (0.26.0), built into languages/ by npm run build: this list of languages
// (CodeMirror's @codemirror/language-data, about 140 of them) plus a chunk per language, so a
// Python file loads only Python. slate.js imports this file the first time it shows a code file
// or a fenced code block that names a language, so pages without code never load it.
//
// CodeMirror itself is not in here: scripts/build-languages.mjs points every import of
// @codemirror/state, view and language and @lezer/common and highlight at the copies already in
// slate.js (see src/code-languages.js), so a language plugs into Slate's editor.

import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

/** The language a file name means (by extension or whole name, such as Dockerfile), or null. */
export function forFile(name) {
  return LanguageDescription.matchFilename(languages, String(name || '').split(/[\\/]/).pop()) || null;
}

/**
 * The language a fence's info string names ("js", "python", "C++"), or null: by name or alias
 * first, then as a file extension, so ```ts and ```py work too.
 */
export function forName(name) {
  const word = String(name || '').trim().split(/\s+/)[0].replace(/^\{?\.?/, '').replace(/\}$/, '');
  if (!word) return null;
  return LanguageDescription.matchLanguageName(languages, word, false)
    || LanguageDescription.matchFilename(languages, `file.${word}`)
    || null;
}

/** Every language's name, for hosts that list them. */
export const names = languages.map(language => language.name);
