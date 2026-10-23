// Show Changes, for reading: how one version of a document differs from another. Blocks (lines,
// tables and code blocks, as Preview splits them) are compared first; a changed block that is
// still much like the block it replaced is drawn once, with the words taken out struck through
// in red and the words put in marked green. Blocks with no counterpart are marked whole.

/**
 * The shortest edit from `a` to `b` (Myers' diff): [{ type: 'same' | 'removed' | 'added', a?, b? }],
 * where a and b are indexes. Past `maxEdits` differences the middle is shown as all removed, then
 * all added.
 */
export function diffSequence(a, b, maxEdits = 2000) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const ops = [];
  for (let i = 0; i < start; i += 1) ops.push({ type: 'same', a: i, b: i });
  const middle = shortestEdit(a, b, start, endA - start, endB - start, maxEdits);
  if (middle) ops.push(...middle);
  else {
    for (let i = start; i < endA; i += 1) ops.push({ type: 'removed', a: i });
    for (let j = start; j < endB; j += 1) ops.push({ type: 'added', b: j });
  }
  for (let k = 0; endA + k < a.length; k += 1) ops.push({ type: 'same', a: endA + k, b: endB + k });
  return ops;
}

function shortestEdit(a, b, start, n, m, maxEdits) {
  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // trace[d] holds v for diagonals -(d-1)..d-1 as it was before step d, to walk back through.
  const trace = [];
  for (let d = 0; d <= Math.min(max, maxEdits); d += 1) {
    trace.push(d === 0 ? null : v.slice(offset - d + 1, offset + d));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[start + x] === b[start + y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return walkBack(trace, d, n, m, start);
    }
  }
  return null;
}

function walkBack(trace, edits, n, m, start) {
  const ops = [];
  let x = n;
  let y = m;
  for (let d = edits; d > 0; d -= 1) {
    const previous = trace[d];
    const at = k => previous[k + d - 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const previousK = down ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;
    while (x > (down ? previousX : previousX + 1) && y > (down ? previousY + 1 : previousY)) {
      x -= 1;
      y -= 1;
      ops.push({ type: 'same', a: start + x, b: start + y });
    }
    if (down) ops.push({ type: 'added', b: start + previousY });
    else ops.push({ type: 'removed', a: start + previousX });
    x = previousX;
    y = previousY;
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'same', a: start + x, b: start + y });
  }
  return ops.reverse();
}

/** A blank line, or only an HTML comment: hidden in Preview, so changing it is not a change. */
export function isQuiet(source) {
  return !String(source).replace(/<!--[\s\S]*?(?:-->|$)/g, '').trim();
}

/** What a block is, so only like blocks are compared word by word; null for blocks never compared so. */
export function blockKind(source) {
  const text = String(source);
  if (isQuiet(text)) return null;
  if (/^\s*```\s*mermaid\b/i.test(text)) return null;
  if (/^\s*```/.test(text)) return 'code';
  if (text.includes('\n')) return 'table';
  if (/^\s*(?:[-+*]\s+\[>\]\s*)?!(?:video)?\[/.test(text)) return null;
  if (/^#{1,6}\s/.test(text)) return 'heading';
  if (/^\s*(?:[-+*]|\d+\.)\s/.test(text)) return 'list';
  if (/^\s*>/.test(text)) return 'quote';
  if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(text)) return null;
  return 'paragraph';
}

function words(text) {
  return String(text).toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

/** How alike two blocks' words are, from 0 to 1. */
export function similarity(a, b) {
  const left = words(a);
  const right = words(b);
  if (!left.length || !right.length) return 0;
  const counts = new Map();
  left.forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
  let common = 0;
  right.forEach(word => {
    const count = counts.get(word);
    if (!count) return;
    common += 1;
    counts.set(word, count - 1);
  });
  return (2 * common) / (left.length + right.length);
}

const ALIKE = 0.5;

/**
 * Lines up the blocks a change took out with those it put in, pairing like blocks in order:
 * [{ type: 'removed', from } | { type: 'added', to } | { type: 'changed', from, to }].
 */
export function pairBlocks(removed, added) {
  const n = removed.length;
  const m = added.length;
  const pairs = [];
  if (n && m && n * m <= 40_000) {
    const width = m + 1;
    const score = new Float64Array((n + 1) * width);
    const alike = (x, y) => {
      const kind = blockKind(removed[x]);
      return kind !== null && kind === blockKind(added[y]) ? similarity(removed[x], added[y]) : 0;
    };
    const cache = new Float64Array(n * m);
    for (let x = n - 1; x >= 0; x -= 1) {
      for (let y = m - 1; y >= 0; y -= 1) {
        const value = alike(x, y);
        cache[x * m + y] = value;
        const paired = value >= ALIKE ? value + score[(x + 1) * width + y + 1] : 0;
        score[x * width + y] = Math.max(paired, score[(x + 1) * width + y], score[x * width + y + 1]);
      }
    }
    let x = 0;
    let y = 0;
    while (x < n && y < m) {
      const value = cache[x * m + y];
      if (value >= ALIKE && score[x * width + y] === value + score[(x + 1) * width + y + 1]) {
        pairs.push([x, y]);
        x += 1;
        y += 1;
      } else if (score[(x + 1) * width + y] >= score[x * width + y + 1]) {
        x += 1;
      } else {
        y += 1;
      }
    }
  }

  // Between pairs, what was taken out comes before what was put in.
  const items = [];
  let x = 0;
  let y = 0;
  for (const [px, py] of [...pairs, [n, m]]) {
    for (; x < px; x += 1) items.push({ type: 'removed', from: removed[x] });
    for (; y < py; y += 1) items.push({ type: 'added', to: added[y] });
    if (px < n) {
      items.push({ type: 'changed', from: removed[px], to: added[py] });
      x = px + 1;
      y = py + 1;
    }
  }
  return items;
}

/**
 * The blocks to draw for the change from `oldBlocks` to `newBlocks`:
 * { items: [{ type: 'same' | 'added', source } | { type: 'removed', source } | { type: 'changed', from, to }, with first: true
 * on the first item of each change], changes: the number of separate changes }.
 * Blank lines and HTML comments added or taken out are not changes.
 */
export function planChanges(oldBlocks, newBlocks) {
  const ops = diffSequence(oldBlocks, newBlocks);
  const items = [];
  let changes = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k].type === 'same') {
      items.push({ type: 'same', source: newBlocks[ops[k].b] });
      k += 1;
      continue;
    }
    const removed = [];
    const added = [];
    for (; k < ops.length && ops[k].type !== 'same'; k += 1) {
      if (ops[k].type === 'removed') removed.push(oldBlocks[ops[k].a]);
      else added.push(newBlocks[ops[k].b]);
    }
    let first = true;
    for (const item of pairBlocks(removed, added)) {
      if (item.type === 'removed') {
        if (isQuiet(item.from)) continue;
        items.push({ type: 'removed', source: item.from, first });
      } else if (item.type === 'added') {
        if (isQuiet(item.to)) {
          items.push({ type: 'same', source: item.to });
          continue;
        }
        items.push({ type: 'added', source: item.to, first });
      } else {
        items.push({ ...item, first });
      }
      first = false;
    }
    if (!first) changes += 1;
  }
  return { items, changes };
}

const TOKEN = /\s+|[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|\S/gu;

/** The comparable form of a piece of text: no-break spaces as spaces, zero-width spaces gone. */
function key(text) {
  return text.replace(/ /g, ' ').replace(/[​﻿]/g, '');
}

/** The words, spaces and marks of `root`'s visible text, each with the text node it is in. */
function tokensOf(root) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
    acceptNode: node => (node.parentElement?.closest('.md-marker, [data-source-ignore], script, style') ? 2 : 1),
  });
  const tokens = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of node.data.matchAll(TOKEN)) {
      const text = key(match[0]);
      if (!text) continue;
      tokens.push({ text, node, start: match.index, end: match.index + match[0].length, space: !text.trim() });
    }
  }
  return tokens;
}

/**
 * Marks, in the rendered block `after`, how its text differs from the rendered block `before`:
 * words put in are wrapped in <ins class="slate-diff-ins">, words taken out are added back where
 * they were in <del class="slate-diff-del">. Changes to spacing alone are not marked.
 */
export function markWordChanges(after, before) {
  const oldTokens = tokensOf(before);
  const newTokens = tokensOf(after);
  const ops = diffSequence(oldTokens.map(token => token.text), newTokens.map(token => token.text), 600);

  // A space between two changes belongs to them, so "a b" → "c d" is one change, not two.
  const changed = ops.map(op => op.type !== 'same');
  ops.forEach((op, k) => {
    if (op.type === 'same' && newTokens[op.b].space && changed[k - 1] && changed[k + 1]) changed[k] = true;
  });

  const edits = [];
  let k = 0;
  while (k < ops.length) {
    if (!changed[k]) {
      k += 1;
      continue;
    }
    const startK = k;
    let removedText = '';
    const inserted = [];
    for (; k < ops.length && changed[k]; k += 1) {
      const op = ops[k];
      if (op.a !== undefined) removedText += oldTokens[op.a].text;
      if (op.b !== undefined) inserted.push(newTokens[op.b]);
    }
    const insertedText = inserted.map(token => token.text).join('');
    if (!removedText.trim() && !insertedText.trim()) continue;

    let at = null;
    if (inserted.length) at = { node: inserted[0].node, offset: inserted[0].start };
    else if (startK > 0) {
      const before = newTokens[ops[startK - 1].b];
      at = { node: before.node, offset: before.end };
    } else if (k < ops.length) {
      const next = newTokens[ops[k].b];
      at = { node: next.node, offset: next.start };
    }
    if (removedText.trim()) edits.push({ kind: 'del', node: at?.node ?? null, offset: at?.offset ?? 0, text: removedText });
    if (insertedText.trim()) {
      inserted.forEach(token => {
        const last = edits.at(-1);
        if (last?.kind === 'ins' && last.node === token.node && last.end === token.start) last.end = token.end;
        else edits.push({ kind: 'ins', node: token.node, offset: token.start, end: token.end });
      });
    }
  }

  const doc = after.ownerDocument;
  const deleted = text => {
    const del = doc.createElement('del');
    del.className = 'slate-diff-del';
    del.textContent = text;
    return del;
  };

  // Text taken out with nothing left to place it by goes at the end of the block's content.
  edits.filter(edit => !edit.node).forEach(edit => {
    const holder = after.querySelector('.live-line-content, p, h1, h2, h3, h4, h5, h6, td, li') || after;
    holder.appendChild(deleted(edit.text));
  });

  // Each text node's edits, last first: splitting a node keeps its first part in place, so the
  // offsets of the edits still to do stay right. At one offset the insertion is wrapped first,
  // so the deletion then goes in before it.
  const order = new Map(newTokens.map((token, index) => [token.node, index]));
  edits
    .filter(edit => edit.node)
    .sort((x, y) => order.get(y.node) - order.get(x.node)
      || y.offset - x.offset
      || (x.kind === 'ins' ? -1 : 1) - (y.kind === 'ins' ? -1 : 1))
    .forEach(edit => {
      const node = edit.node;
      if (edit.kind === 'ins') {
        if (edit.end < node.length) node.splitText(edit.end);
        const target = edit.offset > 0 ? node.splitText(edit.offset) : node;
        const ins = doc.createElement('ins');
        ins.className = 'slate-diff-ins';
        target.replaceWith(ins);
        ins.appendChild(target);
        return;
      }
      const wrapper = node.parentNode?.classList?.contains('slate-diff-ins') ? node.parentNode : node;
      if (edit.offset <= 0) wrapper.before(deleted(edit.text));
      else if (edit.offset >= node.length) wrapper.after(deleted(edit.text));
      else node.after(deleted(edit.text), node.splitText(edit.offset));
    });
}
