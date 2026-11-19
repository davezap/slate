// Code colouring (Slate 0.26.0): a code file in the editor and fenced code blocks in Preview are
// coloured by CodeMirror's language packs, chosen by file extension or by the fence's language.
// The packs live in languages/ (scripts/build-languages.mjs) and load the first time they are
// needed; a file or fence whose language isn't known stays plain.

import * as cmState from '@codemirror/state';
import * as cmView from '@codemirror/view';
import * as cmLanguage from '@codemirror/language';
import * as lezerCommon from '@lezer/common';
import * as lezerHighlight from '@lezer/highlight';

const { syntaxHighlighting } = cmLanguage;
const { highlightTree, tagHighlighter, tags } = lezerHighlight;

// The language chunks import CodeMirror from here (see scripts/build-languages.mjs).
globalThis[Symbol.for('slate.codemirror')] ??= {
  '@codemirror/state': cmState,
  '@codemirror/view': cmView,
  '@codemirror/language': cmLanguage,
  '@lezer/common': lezerCommon,
  '@lezer/highlight': lezerHighlight,
};

/**
 * One set of colours for code everywhere: classes (tok-keyword, tok-string…) coloured by
 * slate.css for each theme, the same in the editor and in Preview's code blocks.
 */
export const codeHighlighter = tagHighlighter([
  { tag: tags.link, class: 'tok-link' },
  { tag: tags.heading, class: 'tok-heading' },
  { tag: tags.emphasis, class: 'tok-emphasis' },
  { tag: tags.strong, class: 'tok-strong' },
  { tag: tags.keyword, class: 'tok-keyword' },
  { tag: [tags.atom, tags.bool, tags.null], class: 'tok-atom' },
  { tag: tags.url, class: 'tok-link' },
  { tag: tags.labelName, class: 'tok-label' },
  { tag: tags.inserted, class: 'tok-inserted' },
  { tag: tags.deleted, class: 'tok-deleted' },
  { tag: [tags.string, tags.literal, tags.character, tags.attributeValue], class: 'tok-string' },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: 'tok-string2' },
  { tag: [tags.number, tags.unit], class: 'tok-number' },
  { tag: tags.variableName, class: 'tok-variable' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: 'tok-function' },
  { tag: tags.definition(tags.variableName), class: 'tok-definition' },
  { tag: [tags.special(tags.variableName), tags.self], class: 'tok-variable2' },
  { tag: [tags.typeName, tags.className, tags.namespace], class: 'tok-type' },
  { tag: tags.tagName, class: 'tok-tag' },
  { tag: tags.attributeName, class: 'tok-attribute' },
  { tag: tags.propertyName, class: 'tok-property' },
  { tag: tags.macroName, class: 'tok-macro' },
  { tag: [tags.operator, tags.operatorKeyword], class: 'tok-operator' },
  { tag: [tags.comment, tags.docComment], class: 'tok-comment' },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], class: 'tok-meta' },
  { tag: tags.invalid, class: 'tok-invalid' },
  { tag: [tags.punctuation, tags.bracket], class: 'tok-punctuation' },
]);

export const codeHighlighting = syntaxHighlighting(codeHighlighter);

// Fenced blocks bigger than this stay plain: colouring them would hold Preview up.
const FENCE_LIMIT = 200000;

let catalogue = null;
const supports = new Map();

/** The language list (languages/languages.js), loaded once. */
function loadCatalogue(url) {
  catalogue ??= import(/* webpackIgnore: true */ url).catch(error => {
    catalogue = null;
    throw new Error(`Code colouring could not be loaded (${url}): ${error.message || error}`);
  });
  return catalogue;
}

async function support(description) {
  if (!description) return null;
  if (!supports.has(description)) {
    supports.set(description, description.load().catch(error => {
      supports.delete(description);
      throw error;
    }));
  }
  const loaded = await supports.get(description);
  return { name: description.name, support: loaded };
}

/** The language for a file name: { name, support } (support is a CodeMirror LanguageSupport), or null. */
export async function languageForFile(url, fileName) {
  if (!fileName) return null;
  const list = await loadCatalogue(url);
  return support(list.forFile(fileName));
}

/** The language a fence's info string names, as languageForFile, or null. */
export async function languageForName(url, name) {
  if (!name) return null;
  const list = await loadCatalogue(url);
  return support(list.forName(name));
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** `code` as HTML with coloured spans, from a parsed syntax tree. */
export function highlightedHtml(code, tree) {
  let html = '';
  let at = 0;
  highlightTree(tree, codeHighlighter, (from, to, classes) => {
    if (from > at) html += escapeHtml(code.slice(at, from));
    html += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`;
    at = to;
  });
  return html + escapeHtml(code.slice(at));
}

/**
 * Colours the fenced code blocks under `root` (<code data-language>) that aren't coloured yet.
 * No editor is made: each block is parsed by its language's parser and coloured from the tree.
 */
export async function colourCodeBlocks(root, url) {
  const blocks = [...(root?.querySelectorAll('.slate-code code[data-language]:not([data-coloured])') ?? [])];
  blocks.forEach(code => { code.dataset.coloured = 'pending'; });
  for (const code of blocks) {
    const text = code.textContent || '';
    code.dataset.coloured = 'plain';
    if (text.length > FENCE_LIMIT) continue;
    let language;
    try {
      language = await languageForName(url, code.dataset.language);
    } catch (error) {
      // Tried again next time Preview draws.
      console.warn(error.message || error);
      blocks.forEach(block => { if (block.dataset.coloured !== 'plain' || block === code) delete block.dataset.coloured; });
      return;
    }
    if (!language || !code.isConnected || code.textContent !== text) continue;
    code.innerHTML = highlightedHtml(text, language.support.language.parser.parse(text));
    code.dataset.coloured = language.name;
    code.classList.add('slate-coloured');
  }
}
