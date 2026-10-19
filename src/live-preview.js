// Edit mode (Live Preview): the Source editor with Markdown drawn in place, Obsidian style.
// Syntax marks are hidden except where the cursor is, so the text stays the Markdown file
// and every edit is an ordinary CodeMirror edit (one undo history across Edit and Source).
// Tables, standalone images and videos are drawn as blocks and open as source when the
// cursor reaches them. Slate supplies the rendering of those through `options`.

import { Prec, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const setFocused = StateEffect.define();

// Whether the editor has focus. Without it nothing counts as under the cursor, so a document
// opens (and stays, while the host's find box has the keyboard) fully rendered.
const focusedField = StateField.define({
  create: () => false,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setFocused)) value = effect.value;
    return value;
  },
});

/** True when a selection range touches [from, to] (inclusive) and the editor has focus. */
function touches(state, from, to) {
  if (!state.field(focusedField)) return false;
  return state.selection.ranges.some(range => range.from <= to && range.to >= from);
}

function lineIsActive(state, line) {
  return touches(state, line.from, line.to);
}

const hidden = Decoration.replace({});

const webUrl = /^https?:\/\//i;
// Where a URL node is part of a link of its own; anywhere else it is a bare address (an autolink).
const linkParents = new Set(['Link', 'Image', 'Autolink', 'LinkReference']);

/** The ↗ after a web link. A plain click on it opens the link (the link text itself only on Ctrl+click). */
class ExternalLinkWidget extends WidgetType {
  constructor(url) {
    super();
    this.url = url;
  }
  eq(other) { return other.url === this.url; }
  // Let the editor's handlers see clicks on it, so they can stop the cursor moving there.
  ignoreEvent() { return false; }
  toDOM() {
    const icon = document.createElement('span');
    icon.className = 'slate-external-icon cm-slate-external';
    icon.dataset.mdUrl = this.url;
    icon.title = `Open ${this.url} in the browser`;
    icon.setAttribute('role', 'link');
    icon.setAttribute('aria-label', icon.title);
    return icon;
  }
}

class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-slate-bullet';
    bullet.textContent = '•';
    return bullet;
  }
}

class RuleWidget extends WidgetType {
  eq() { return true; }
  toDOM() {
    const rule = document.createElement('span');
    rule.className = 'cm-slate-hr';
    return rule;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(checked) {
    super();
    this.checked = checked;
  }
  eq(other) { return other.checked === this.checked; }
  toDOM(view) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox cm-slate-checkbox';
    checkbox.checked = this.checked;
    checkbox.setAttribute('aria-label', this.checked ? 'Completed task' : 'Task');
    checkbox.addEventListener('mousedown', event => {
      event.preventDefault();
      if (event.button !== 0 || view.state.readOnly) return;
      // The marker is "[ ]" or "[x]" right where the widget sits.
      const at = view.posAtDOM(checkbox);
      const marker = view.state.sliceDoc(at, at + 3);
      if (!/^\[[ xX]\]$/.test(marker)) return;
      view.dispatch({
        changes: { from: at + 1, to: at + 2, insert: /[xX]/.test(marker[1]) ? ' ' : 'x' },
        userEvent: 'input.toggle-task',
      });
    });
    checkbox.addEventListener('click', event => event.preventDefault());
    return checkbox;
  }
  ignoreEvent() { return true; }
}

class InlineImageWidget extends WidgetType {
  constructor(alt, url, title, render) {
    super();
    this.alt = alt;
    this.url = url;
    this.title = title;
    this.render = render;
  }
  eq(other) { return other.alt === this.alt && other.url === this.url && other.title === this.title; }
  toDOM() { return this.render(this.alt, this.url, this.title); }
}

// A table, standalone image or video, or a diagram. Inactive it replaces its lines; active (cursor
// inside) a media block or diagram is drawn under its source, and a table shows only its source.
class BlockWidget extends WidgetType {
  constructor(block, active, options) {
    super();
    this.block = block;
    this.active = active;
    this.options = options;
  }
  eq(other) {
    return other.block.type === this.block.type && other.block.source === this.block.source && other.active === this.active;
  }
  get estimatedHeight() {
    if (this.block.type === 'table') return 34 * (this.block.toLine - this.block.fromLine) + 30;
    return this.block.type === 'video' ? 420 : this.block.type === 'diagram' ? 320 : 260;
  }
  toDOM(view) {
    const dom = this.options.renderBlock(this.block);
    dom.classList.add('cm-slate-block');
    dom.classList.toggle('cm-slate-block-active', this.active);
    // Diagrams and images finish drawing later; let the editor re-measure their height then.
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => view.requestMeasure());
      observer.observe(dom);
      dom.slateResizeObserver = observer;
    }

    // Places the cursor on a line of this block, which shows its source.
    const reveal = (lineOffset, column) => {
      const start = view.state.doc.lineAt(view.posAtDOM(dom));
      const lineNumber = Math.min(view.state.doc.lines, start.number + lineOffset);
      const line = view.state.doc.line(lineNumber);
      const at = column === undefined ? line.to : Math.min(line.to, line.from + column);
      view.dispatch({ selection: { anchor: at }, scrollIntoView: true, userEvent: 'select' });
      view.focus();
    };

    dom.addEventListener('mousedown', event => {
      if (event.button !== 0) return;
      // Ctrl+click on a link in a table follows it (see the click handler below), so leave the cursor.
      if (event.target.closest('a') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        return;
      }
      const toggle = event.target.closest('.media-source-toggle');
      if (toggle) {
        event.preventDefault();
        if (this.active) view.contentDOM.blur();
        else reveal(0);
        return;
      }
      // Clicking a diagram shows its source, like its ✎ button.
      if (this.block.type === 'diagram' && !this.active) {
        event.preventDefault();
        reveal(1);
        return;
      }
      if (this.block.type !== 'table') {
        // A link in an image's caption or alt text: show the source to edit it.
        if (event.target.closest('a')) {
          event.preventDefault();
          reveal(0);
        }
        return;
      }
      // A plain click on a link in a cell edits that cell, like a click anywhere else in it.
      event.preventDefault();
      // The clicked cell: header row is the table's first line, body row n is line n + 2.
      const row = event.target.closest('tr');
      const rows = [...dom.querySelectorAll('tr')];
      const rowIndex = Math.max(0, rows.indexOf(row));
      const lineOffset = rowIndex === 0 ? 0 : rowIndex + 1;
      const cellIndex = row ? [...row.children].indexOf(event.target.closest('th, td')) : -1;
      const start = view.state.doc.lineAt(view.posAtDOM(dom));
      const lineNumber = Math.min(view.state.doc.lines, start.number + lineOffset);
      reveal(lineOffset, cellEnd(view.state.doc.line(lineNumber).text, cellIndex));
    });
    // The editor ignores events inside blocks, so links in them would otherwise load their
    // target (a new window) on a plain click. Here, as in the text, only Ctrl+click opens one.
    dom.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || link.closest('svg')) return;
      event.preventDefault();
      if ((event.ctrlKey || event.metaKey) && link.dataset.mdUrl) window.open(link.href, '_blank', 'noopener');
    });
    return dom;
  }
  destroy(dom) {
    dom.slateResizeObserver?.disconnect();
    this.options.destroyBlock?.(dom);
  }
  ignoreEvent() { return true; }
}

/** Offset just after the text of cell `index` in a table row, or undefined for the line end. */
function cellEnd(text, index) {
  if (index < 0) return undefined;
  const pipes = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '|') pipes.push(i);
  }
  const leading = /^\s*\|/.test(text);
  const starts = [leading ? pipes[0] + 1 : 0, ...pipes.slice(leading ? 1 : 0).map(pipe => pipe + 1)];
  const from = starts[index];
  if (from === undefined) return undefined;
  const next = text.indexOf('|', from);
  const end = next === -1 ? text.length : next;
  return from + text.slice(from, end).trimEnd().length;
}

const codeNodes = new Set(['InlineCode', 'CodeText', 'FencedCode', 'CodeBlock', 'CodeMark']);
const wikiPattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;

function linkTitle(node, state) {
  const title = node.getChild('LinkTitle');
  return title ? state.sliceDoc(title.from + 1, title.to - 1) : '';
}

export function livePreview(options) {
  // Lines that render as blocks: [{ type, fromLine, toLine, source, from, to }], from the host.
  const blocksField = StateField.define({
    create: state => findBlocks(state),
    update: (value, transaction) => (transaction.docChanged ? findBlocks(transaction.state) : value),
  });

  function findBlocks(state) {
    const doc = state.doc;
    return options.detectBlocks(doc.toString()).map(block => ({
      ...block,
      from: doc.line(block.fromLine + 1).from,
      to: doc.line(block.toLine + 1).to,
    }));
  }

  function blockDecorations(state) {
    const decorations = [];
    for (const block of state.field(blocksField)) {
      const active = touches(state, block.from, block.to);
      if (active) {
        // Its source, in the editor font so table columns line up.
        for (let number = block.fromLine + 1; number <= block.toLine + 1; number += 1) {
          decorations.push(Decoration.line({ class: 'cm-slate-block-source' }).range(state.doc.line(number).from));
        }
      }
      if (!active) {
        decorations.push(Decoration.replace({ widget: new BlockWidget(block, false, options), block: true }).range(block.from, block.to));
      } else if (block.type !== 'table') {
        decorations.push(Decoration.widget({ widget: new BlockWidget(block, true, options), block: true, side: 1 }).range(block.to));
      }
    }
    return Decoration.set(decorations, true);
  }

  // Block decorations have to come from a field, not a view plugin.
  const blockDecorationsField = StateField.define({
    create: blockDecorations,
    update(value, transaction) {
      const focusChanged = transaction.effects.some(effect => effect.is(setFocused));
      if (!transaction.docChanged && !transaction.selection && !focusChanged) return value;
      return blockDecorations(transaction.state);
    },
    provide: field => EditorView.decorations.from(field),
  });

  function inlineDecorations(view) {
    const { state } = view;
    const doc = state.doc;
    const blocks = state.field(blocksField);
    const tree = syntaxTree(state);
    const decorations = [];
    const seen = new Set();
    const add = (key, range) => {
      if (seen.has(key)) return;
      seen.add(key);
      decorations.push(range);
    };
    const hide = (from, to) => { if (to > from) add(`h${from}:${to}`, hidden.range(from, to)); };
    const lineClass = (line, className) => add(`l${line.from}:${className}`, Decoration.line({ class: className }).range(line.from));
    const insideBlock = pos => blocks.some(block => pos >= block.from && pos <= block.to);
    const spacesAfter = pos => {
      let end = pos;
      while (end < doc.length && (doc.sliceString(end, end + 1) === ' ' || doc.sliceString(end, end + 1) === '\t')) end += 1;
      return end;
    };

    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from,
        to,
        enter: node => {
          if (node.name === 'Document') return true;
          if (insideBlock(node.from)) return false;
          const name = node.name;

          if (/^ATXHeading[1-6]$/.test(name)) {
            const line = doc.lineAt(node.from);
            lineClass(line, `cm-slate-heading cm-slate-h${name.slice(-1)}`);
            if (!lineIsActive(state, line)) {
              node.node.getChildren('HeaderMark').forEach((mark, index) => {
                if (index === 0 && mark.from === line.from) hide(mark.from, spacesAfter(mark.to));
                else {
                  let start = mark.from;
                  while (start > line.from && /\s/.test(doc.sliceString(start - 1, start))) start -= 1;
                  hide(start, mark.to);
                }
              });
            }
            return true;
          }

          if (name === 'SetextHeading2' || name === 'SetextHeading1') {
            // Slate's Preview has no setext headings: "text" then "---" is a paragraph and a rule.
            const mark = node.node.getChild('HeaderMark');
            if (mark && name === 'SetextHeading2') {
              const line = doc.lineAt(mark.from);
              if (!lineIsActive(state, line)) add(`r${mark.from}`, Decoration.replace({ widget: new RuleWidget() }).range(mark.from, mark.to));
            }
            return true;
          }

          if (name === 'HorizontalRule') {
            const line = doc.lineAt(node.from);
            if (!lineIsActive(state, line)) add(`r${node.from}`, Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
            return false;
          }

          if (name === 'Emphasis' || name === 'StrongEmphasis' || name === 'Strikethrough') {
            if (!touches(state, node.from, node.to)) {
              node.node.getChildren(name === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark').forEach(mark => hide(mark.from, mark.to));
            }
            return true;
          }

          if (name === 'InlineCode') {
            const marks = node.node.getChildren('CodeMark');
            if (marks.length >= 2 && !touches(state, node.from, node.to)) {
              hide(marks[0].from, marks[0].to);
              hide(marks.at(-1).from, marks.at(-1).to);
              if (marks.at(-1).from > marks[0].to) {
                add(`c${node.from}`, Decoration.mark({ class: 'cm-slate-inline-code' }).range(marks[0].to, marks.at(-1).from));
              }
            }
            return false;
          }

          if (name === 'Link' || name === 'Autolink') {
            const url = node.node.getChild('URL');
            const marks = node.node.getChildren('LinkMark');
            if (!url || marks.length < 2 || touches(state, node.from, node.to)) return true;
            const target = state.sliceDoc(url.from, url.to);
            const attributes = options.linkAttributes(target, linkTitle(node.node, state));
            const textFrom = name === 'Autolink' ? url.from : marks[0].to;
            const textTo = name === 'Autolink' ? url.to : marks[1].from;
            if (textTo <= textFrom) return true;
            hide(node.from, textFrom);
            hide(textTo, node.to);
            add(`a${node.from}`, Decoration.mark({ tagName: 'a', class: 'cm-slate-link', attributes }).range(textFrom, textTo));
            if (webUrl.test(attributes['data-md-url'] ?? '')) {
              add(`x${node.from}`, Decoration.widget({ widget: new ExternalLinkWidget(attributes['data-md-url']), side: 1 }).range(node.to));
            }
            return true;
          }

          if (name === 'URL' && !linkParents.has(node.node.parent?.name)) {
            // A bare web address: a link where it stands, with nothing to hide.
            const text = state.sliceDoc(node.from, node.to);
            const attributes = options.linkAttributes(/^www\./i.test(text) ? `http://${text}` : text, '');
            add(`a${node.from}`, Decoration.mark({ tagName: 'a', class: 'cm-slate-link', attributes }).range(node.from, node.to));
            if (webUrl.test(attributes['data-md-url'] ?? '')) {
              add(`x${node.from}`, Decoration.widget({ widget: new ExternalLinkWidget(attributes['data-md-url']), side: 1 }).range(node.to));
            }
            return false;
          }

          if (name === 'Image') {
            const url = node.node.getChild('URL');
            const marks = node.node.getChildren('LinkMark');
            if (!url || marks.length < 2 || touches(state, node.from, node.to)) return false;
            const widget = new InlineImageWidget(
              state.sliceDoc(marks[0].to, marks[1].from),
              state.sliceDoc(url.from, url.to),
              linkTitle(node.node, state),
              options.renderInlineImage,
            );
            add(`i${node.from}`, Decoration.replace({ widget }).range(node.from, node.to));
            return false;
          }

          if (name === 'Blockquote') {
            for (let pos = node.from; pos <= node.to;) {
              const line = doc.lineAt(pos);
              if (line.to >= from && line.from <= to) lineClass(line, 'cm-slate-quote');
              pos = line.to + 1;
            }
            return true;
          }

          if (name === 'QuoteMark') {
            const line = doc.lineAt(node.from);
            if (!lineIsActive(state, line)) hide(node.from, Math.min(line.to, node.to + (doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0)));
            return false;
          }

          if (name === 'ListItem') {
            const mark = node.node.getChild('ListMark');
            if (!mark) return true;
            const line = doc.lineAt(mark.from);
            const task = node.node.getChild('Task');
            const marker = task?.getChild('TaskMarker');
            if (marker && marker.from >= mark.to && doc.lineAt(marker.from).number === line.number) {
              lineClass(line, 'cm-slate-task-line');
              if (!touches(state, mark.from, marker.to)) {
                hide(mark.from, marker.from);
                const checked = /[xX]/.test(doc.sliceString(marker.from + 1, marker.from + 2));
                add(`t${marker.from}`, Decoration.replace({ widget: new CheckboxWidget(checked) }).range(marker.from, marker.to));
              }
              return true;
            }
            lineClass(line, 'cm-slate-list-line');
            if (!/^[-+*]$/.test(doc.sliceString(mark.from, mark.to))) {
              add(`n${mark.from}`, Decoration.mark({ class: 'cm-slate-list-number' }).range(mark.from, mark.to));
            } else if (!touches(state, mark.from, mark.to)) {
              add(`b${mark.from}`, Decoration.replace({ widget: new BulletWidget() }).range(mark.from, mark.to));
            }
            return true;
          }

          if (name === 'FencedCode' || name === 'CodeBlock') {
            const first = doc.lineAt(node.from);
            const last = doc.lineAt(node.to);
            const fenced = name === 'FencedCode';
            const open = fenced && !touches(state, node.from, node.to);
            for (let number = Math.max(first.number, doc.lineAt(from).number); number <= Math.min(last.number, doc.lineAt(to).number); number += 1) {
              const line = doc.line(number);
              let className = 'cm-slate-codeblock';
              if (number === first.number) className += ' cm-slate-codeblock-begin';
              if (number === last.number) className += ' cm-slate-codeblock-end';
              lineClass(line, className);
            }
            if (open) {
              const marks = node.node.getChildren('CodeMark');
              if (marks[0]?.from === node.from) hide(first.from, first.to);
              if (marks.length > 1 && last.number !== first.number) hide(last.from, last.to);
            }
            return false;
          }

          if (name === 'Table' || name === 'HTMLBlock' || name === 'CommentBlock') return false;
          return true;
        },
      });

      // Wiki links are Slate's own syntax, not part of the Markdown grammar.
      for (let pos = from; pos <= to;) {
        const line = doc.lineAt(pos);
        pos = line.to + 1;
        if (!line.text.includes('[[') || insideBlock(line.from)) continue;
        for (const match of line.text.matchAll(wikiPattern)) {
          const start = line.from + match.index;
          const end = start + match[0].length;
          if (codeNodes.has(tree.resolveInner(start + 2, 1).name)) continue;
          if (touches(state, start, end)) continue;
          const displayFrom = match[2] === undefined ? start + 2 : start + 3 + match[1].length;
          const noteName = match[1].trim();
          hide(start, displayFrom);
          hide(end - 2, end);
          add(`w${start}`, Decoration.mark({
            tagName: 'a',
            class: 'wiki-link cm-slate-wiki',
            attributes: { href: '#', 'data-note-name': noteName, title: `[[${noteName}]]` },
          }).range(displayFrom, end - 2));
        }
      }
    }

    return Decoration.set(decorations, true);
  }

  const inlinePlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = inlineDecorations(view);
    }
    update(update) {
      if (
        update.docChanged || update.viewportChanged || update.selectionSet
        || update.startState.field(focusedField) !== update.state.field(focusedField)
        || syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = inlineDecorations(update.view);
      }
    }
  }, { decorations: plugin => plugin.decorations });

  return [
    focusedField,
    EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing)),
    blocksField,
    blockDecorationsField,
    inlinePlugin,
    EditorView.editorAttributes.of({ class: 'cm-slate-live' }),
    EditorView.domEventHandlers({
      // The ↗ after a web link, and Ctrl+click on a link, open it without moving the cursor (which
      // would show the link's syntax, and Ctrl+click would add a second cursor, so the click
      // never reached the link).
      mousedown(event) {
        const opens = event.target.closest?.('.cm-slate-external')
          || ((event.ctrlKey || event.metaKey) && event.target.closest?.('a.cm-slate-link, .cm-slate-wiki'));
        if (!opens) return false;
        event.preventDefault();
        return true;
      },
      // A plain click on a link places the cursor in it, to edit it; Ctrl+click opens the link.
      click(event, view) {
        const external = event.target.closest?.('.cm-slate-external');
        if (external && view.contentDOM.contains(external)) {
          event.preventDefault();
          window.open(external.dataset.mdUrl, '_blank', 'noopener');
          return true;
        }
        const link = event.target.closest?.('a');
        if (!link || !view.contentDOM.contains(link)) return false;
        event.preventDefault();
        if ((event.ctrlKey || event.metaKey) && link.dataset.mdUrl) window.open(link.href, '_blank', 'noopener');
        return false;
      },
    }),
    Prec.high(livePreviewTheme),
  ];
}

/** Tells a freshly enabled live preview whether the editor already has focus. */
export function syncLivePreviewFocus(view) {
  view.dispatch({ effects: setFocused.of(view.hasFocus) });
}

export const livePreviewHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.strong, fontWeight: '720' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent-strong)' },
  { tag: tags.url, color: 'var(--text-muted)' },
  { tag: tags.monospace, fontFamily: 'var(--font-editor)', fontSize: '.88em' },
  { tag: tags.quote, color: 'var(--text-muted)' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--text-muted)' },
]));

const livePreviewTheme = EditorView.theme({
  '.cm-scroller': {
    fontFamily: 'var(--font-ui)',
    fontSize: '16px',
    lineHeight: '1.7',
  },
  '.cm-line': { overflowWrap: 'anywhere' },
  '.cm-slate-heading': { lineHeight: '1.25', letterSpacing: '-0.025em', paddingTop: '.75em', paddingBottom: '.3em' },
  // Line elements take padding, never margins: CodeMirror measures their boxes.
  '.cm-slate-h1': { fontSize: '2em', borderBottom: '1px solid var(--border)' },
  '.cm-slate-h2': { fontSize: '1.55em', borderBottom: '1px solid var(--border)' },
  '.cm-slate-h3': { fontSize: '1.27em' },
  '.cm-slate-h4': { fontSize: '1.1em' },
  '.cm-slate-h5': { fontSize: '1em' },
  '.cm-slate-h6': { fontSize: '.92em', color: 'var(--text-muted)' },
  '.cm-slate-quote': {
    borderLeft: '4px solid var(--accent)',
    background: 'var(--panel-muted)',
    color: 'var(--text-muted)',
    paddingLeft: '1em !important',
  },
  '.cm-slate-codeblock': {
    fontFamily: 'var(--font-editor)',
    fontSize: '13px',
    lineHeight: '1.6',
    background: 'var(--panel-muted)',
    borderLeft: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    paddingLeft: '17px !important',
    paddingRight: '17px !important',
  },
  '.cm-slate-codeblock-begin': { borderTop: '1px solid var(--border)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', paddingTop: '6px' },
  '.cm-slate-codeblock-end': { borderBottom: '1px solid var(--border)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', paddingBottom: '6px' },
  '.cm-slate-inline-code': {
    fontFamily: 'var(--font-editor)',
    fontSize: '.88em',
    padding: '.16em .38em',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    background: 'var(--panel-muted)',
  },
  '.cm-slate-link, .cm-slate-link *': { color: 'var(--accent-strong)', textDecoration: 'none', cursor: 'text' },
  '.cm-slate-external': { cursor: 'pointer' },
  '.cm-slate-wiki': { color: 'var(--accent-strong)', textDecoration: 'none', borderBottom: '1px dashed var(--accent)', cursor: 'text' },
  '.cm-slate-list-number, .cm-slate-list-number *': { color: 'var(--text)' },
  '.cm-slate-bullet': { display: 'inline-block', width: '.9em', color: 'var(--text)' },
  '.cm-slate-checkbox': { margin: '0 .5em 0 0', verticalAlign: '-.12em', accentColor: 'var(--accent)', cursor: 'pointer' },
  '.cm-slate-hr': {
    display: 'inline-block',
    width: '100%',
    verticalAlign: 'middle',
    borderTop: '1px solid var(--border)',
  },
  '.cm-slate-block-source': { fontFamily: 'var(--font-editor)', fontSize: '14px', lineHeight: '1.65' },
  '.cm-slate-block': { padding: '.4em 0', cursor: 'default', whiteSpace: 'normal' },
  '.cm-slate-block.cm-slate-table': { cursor: 'text', fontSize: '16px', lineHeight: '1.7' },
  '.cm-slate-block.cm-slate-table table': { margin: '.4em 0' },
  '.cm-slate-block .live-media-figure': { margin: '0' },
  '.cm-slate-block-active .media-source-toggle': { opacity: '1' },
  '.cm-slate-block-active .media-source-toggle::before': { content: '"✓"' },
});
