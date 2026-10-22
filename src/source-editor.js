// The Markdown editor behind Source and Edit modes (Edit adds live-preview.js): CodeMirror 6
// behind a small textarea-like interface, so the rest of Slate can keep using value,
// selectionStart/End, setSelectionRange and setRangeText. Like a textarea, only the user's
// own edits call onInput; changes made through this interface don't, and callers announce
// them themselves.

import { Annotation, Compartment, EditorSelection, EditorState, Prec, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, Language, defineLanguageFacet, languageDataProp, syntaxHighlighting } from '@codemirror/language';
import { GFM, parser as markdownParser } from '@lezer/markdown';
import { tags } from '@lezer/highlight';
import { getChunks, getOriginalDoc, goToNextChunk, goToPreviousChunk, unifiedMergeView } from '@codemirror/merge';
import { livePreview, livePreviewHighlight, syncLivePreviewFocus } from './live-preview.js';

const programmatic = Annotation.define();

// Markdown with GitHub extensions (tables, task lists, strikethrough), straight from the
// Lezer parser: @codemirror/lang-markdown would also bundle HTML, CSS and JavaScript
// support for code blocks, about 150 KB more.
const markdownFacet = defineLanguageFacet({ commentTokens: { block: { open: '<!--', close: '-->' } } });
const markdownLanguage = new Language(
  markdownFacet,
  markdownParser.configure([GFM, { props: [languageDataProp.add({ Document: markdownFacet })] }]),
  [],
  'markdown',
);

const setFindMatches = StateEffect.define();
const findMatchMark = Decoration.mark({ class: 'cm-slate-find-match' });
const findCurrentMark = Decoration.mark({ class: 'cm-slate-find-match cm-slate-find-current' });

// Find highlights from the host: [from, to] offsets and the current one. They follow
// edits until the host searches again.
const findMatches = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setFindMatches)) continue;
      const { ranges, current } = effect.value;
      const length = transaction.state.doc.length;
      const builder = new RangeSetBuilder();
      ranges
        .map(([from, to], index) => [Math.max(0, Math.min(from, length)), Math.max(0, Math.min(to, length)), index])
        .filter(([from, to]) => to > from)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .forEach(([from, to, index]) => builder.add(from, to, index === current ? findCurrentMark : findMatchMark));
      value = builder.finish();
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--accent-strong)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--accent-strong)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--text-muted)' },
]);

const slateTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--panel)', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-editor)',
    fontSize: '14px',
    lineHeight: '1.65',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '24px clamp(20px, 5vw, 72px) 80px',
    caretColor: 'var(--accent)',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  '.cm-placeholder': { color: 'var(--text-muted)' },
  '.cm-slate-find-match': { backgroundColor: 'color-mix(in srgb, #f5c400 40%, transparent)', borderRadius: '2px' },
  '.cm-slate-find-current': { backgroundColor: 'color-mix(in srgb, #ff8a00 65%, transparent)' },
});

// Compare: red is text only in the other version, green is text only in this document.
const compareTheme = EditorView.theme({
  '.cm-changedLine, .cm-insertedLine': { backgroundColor: 'color-mix(in srgb, #2ea043 14%, transparent) !important' },
  '.cm-changedText, .cm-insertedLine .cm-changedText': { background: 'color-mix(in srgb, #2ea043 32%, transparent) !important' },
  '.cm-deletedChunk': {
    backgroundColor: 'color-mix(in srgb, #e5534b 13%, transparent) !important',
    paddingLeft: '6px',
  },
  '.cm-deletedChunk .cm-deletedText, .cm-deletedChunk del': { background: 'color-mix(in srgb, #e5534b 30%, transparent) !important', textDecoration: 'none' },
  '.cm-changeGutter': { width: '4px', paddingLeft: '0' },
  '.cm-changedLineGutter': { background: '#2ea043 !important' },
  '.cm-deletedLineGutter': { background: '#e5534b !important' },
  '.cm-chunkButtons': { display: 'flex', gap: '6px', padding: '3px 0 5px' },
  '.cm-collapsedLines': {
    color: 'var(--text-muted)',
    background: 'var(--panel-muted)',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  },
});

/** Shortest change turning `from` into `to`, so marks, the cursor and scrolling map through it. */
function minimalChange(from, to) {
  if (from === to) return null;
  let start = 0;
  const limit = Math.min(from.length, to.length);
  while (start < limit && from.charCodeAt(start) === to.charCodeAt(start)) start += 1;
  let endFrom = from.length;
  let endTo = to.length;
  while (endFrom > start && endTo > start && from.charCodeAt(endFrom - 1) === to.charCodeAt(endTo - 1)) {
    endFrom -= 1;
    endTo -= 1;
  }
  return { from: start, to: endFrom, insert: to.slice(start, endTo) };
}

export function createSourceEditor(parent, options = {}) {
  const editable = new Compartment();
  const historyField = new Compartment();
  const highlighting = new Compartment();
  const live = new Compartment();
  const comparison = new Compartment();
  const sourceHighlight = syntaxHighlighting(markdownHighlight);
  let liveExtension = null;
  let readOnly = false;
  let livePreviewOn = false;
  let comparing = false;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.doc || '',
      extensions: [
        historyField.of(history()),
        drawSelection(),
        EditorView.lineWrapping,
        markdownLanguage,
        highlighting.of(sourceHighlight),
        live.of([]),
        comparison.of([]),
        placeholder(options.placeholder || ''),
        EditorState.tabSize.of(2),
        findMatches,
        Prec.high(keymap.of(options.keymap || [])),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        editable.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
        EditorView.contentAttributes.of({
          spellcheck: 'true',
          autocorrect: 'off',
          autocapitalize: 'off',
          'aria-label': options.ariaLabel || 'Markdown source editor',
        }),
        EditorView.domEventHandlers(options.domEventHandlers || {}),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          if (update.transactions.every(transaction => transaction.annotation(programmatic))) return;
          // After this update finishes, so the handler may change the text itself.
          queueMicrotask(() => options.onInput?.());
        }),
        slateTheme,
      ],
    }),
  });

  function dispatch(spec) {
    view.dispatch({ ...spec, annotations: programmatic.of(true) });
  }

  function clamp(offset) {
    return Math.max(0, Math.min(view.state.doc.length, Number(offset) || 0));
  }

  const editor = {
    view,
    dom: view.dom,

    get value() {
      return view.state.doc.toString();
    },
    // Replaces the text through the shortest change, keeping the cursor, scroll
    // position and find marks where they were. Undoable, like an edit.
    set value(text) {
      const change = minimalChange(view.state.doc.toString(), String(text ?? ''));
      if (change) dispatch({ changes: change });
    },

    /** As `value =`, but a new starting point: undo history is cleared. */
    replaceDocument(text) {
      editor.value = text;
      view.dispatch({ effects: historyField.reconfigure([]) });
      view.dispatch({ effects: historyField.reconfigure(history()) });
    },

    get selectionStart() {
      return view.state.selection.main.from;
    },
    get selectionEnd() {
      return view.state.selection.main.to;
    },
    setSelectionRange(start, end = start, options = {}) {
      const anchor = clamp(start);
      const head = clamp(end);
      dispatch({
        selection: EditorSelection.single(anchor, Math.max(anchor, head)),
        effects: options.scroll === false
          ? []
          : EditorView.scrollIntoView(EditorSelection.range(anchor, Math.max(anchor, head)), { y: options.y || 'nearest', yMargin: 40 }),
      });
    },
    // As HTMLTextAreaElement.setRangeText, with selectMode 'select', 'start', 'end' or 'preserve'.
    setRangeText(text, start = editor.selectionStart, end = editor.selectionEnd, selectMode = 'preserve') {
      const from = clamp(start);
      const to = Math.max(from, clamp(end));
      const insert = String(text ?? '');
      const spec = { changes: { from, to, insert }, scrollIntoView: true };
      if (selectMode === 'select') spec.selection = EditorSelection.single(from, from + insert.length);
      else if (selectMode === 'start') spec.selection = EditorSelection.cursor(from);
      else if (selectMode === 'end') spec.selection = EditorSelection.cursor(from + insert.length);
      dispatch(spec);
    },

    get livePreview() {
      return livePreviewOn;
    },
    // Edit mode is this editor with Markdown drawn in place (see live-preview.js); the text,
    // cursor and undo history carry over between Edit and Source.
    set livePreview(value) {
      const on = Boolean(value);
      if (on === livePreviewOn) return;
      livePreviewOn = on;
      if (on && !liveExtension) liveExtension = livePreview(options.livePreview || {});
      view.dispatch({
        effects: [
          live.reconfigure(on ? liveExtension : []),
          highlighting.reconfigure(on ? livePreviewHighlight : sourceHighlight),
        ],
      });
      if (on) syncLivePreviewFocus(view);
    },

    get comparing() {
      return comparing;
    },
    /**
     * Shows how the text differs from `other`, inline: other's lines in red above the lines that
     * replace them in green. `control(type, action)` draws each difference's buttons ('accept'
     * keeps this text, 'reject' takes other's), and `control: false` leaves them out (Show
     * Changes); `onChange` runs after every update.
     */
    startCompare(other, compareOptions = {}) {
      comparing = true;
      view.dispatch({
        effects: comparison.reconfigure([
          unifiedMergeView({
            original: String(other ?? ''),
            mergeControls: compareOptions.control === false ? false : compareOptions.control || true,
            allowInlineDiffs: true,
            collapseUnchanged: { margin: 3, minSize: 6 },
            // Long documents with many changes still get each change, not one big one.
            diffConfig: { scanLimit: 20000, timeout: 1500 },
          }),
          EditorView.updateListener.of(() => compareOptions.onChange?.()),
          compareTheme,
        ]),
      });
    },
    endCompare() {
      comparing = false;
      view.dispatch({ effects: comparison.reconfigure([]) });
    },
    /** The number of differences left while comparing. */
    get differences() {
      if (!comparing) return 0;
      return getChunks(view.state)?.chunks.length ?? 0;
    },
    /** Moves to the next (1) or previous (-1) difference while comparing. */
    goToChange(direction) {
      if (comparing) (direction < 0 ? goToPreviousChunk : goToNextChunk)(view);
    },
    /** The text being compared with. */
    get compareText() {
      return comparing ? getOriginalDoc(view.state).toString() : '';
    },

    /** Scrolls a zero-based line to the top of the view without moving the cursor. */
    scrollToLine(line) {
      const doc = view.state.doc;
      const target = doc.line(Math.max(1, Math.min(doc.lines, line + 1)));
      view.dispatch({ effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 24 }) });
    },

    /** The zero-based line at the top of the view (24px down, past a partly hidden line). */
    topLine() {
      const top = view.scrollDOM.getBoundingClientRect().top + 24 - view.documentTop;
      const block = view.lineBlockAtHeight(Math.max(0, top));
      return view.state.doc.lineAt(block.from).number - 1;
    },

    /** Scrolls a zero-based line to the top of the view and selects it. */
    revealLine(line) {
      const doc = view.state.doc;
      const target = doc.line(Math.max(1, Math.min(doc.lines, line + 1)));
      view.focus();
      dispatch({
        selection: EditorSelection.single(target.from, target.to),
        effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 24 }),
      });
    },

    setFindMatches(ranges, current = -1) {
      view.dispatch({ effects: setFindMatches.of({ ranges: ranges || [], current }) });
    },

    get readOnly() {
      return readOnly;
    },
    set readOnly(value) {
      readOnly = Boolean(value);
      view.dispatch({
        effects: editable.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      });
      view.dom.classList.toggle('is-readonly', readOnly);
    },

    focus() {
      view.focus();
    },
    get scrollTop() {
      return view.scrollDOM.scrollTop;
    },
    set scrollTop(value) {
      view.scrollDOM.scrollTop = value;
    },
  };

  return editor;
}
