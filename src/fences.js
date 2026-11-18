// Fenced code blocks and code spans, the CommonMark way (Slate 0.25.0).
//
// A fence is three or more backticks or tildes. It closes only on a line holding the same
// character, at least as many of them, and nothing else, so a block opened with four backticks
// can show a three-backtick block inside it. Before 0.25.0 any line starting with ``` closed it.

const OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const CLOSE = /^\s*(`{3,}|~{3,})\s*$/;

/**
 * The fence a line opens, or null: `indent` (its leading spaces), `char`, `length` and `info`
 * (the info string, trimmed, such as "markdown" or "card"). A backtick fence's info string may
 * not hold a backtick (that line is text with a code span).
 */
export function openFence(line) {
  const match = OPEN.exec(String(line));
  if (!match) return null;
  const char = match[2][0];
  const info = match[3].trim();
  if (char === '`' && info.includes('`')) return null;
  return { indent: match[1].length, char, length: match[2].length, info };
}

/** Whether a line closes the fence `open` (from openFence). */
export function closesFence(line, open) {
  const match = CLOSE.exec(String(line));
  return !!match && match[1][0] === open.char && match[1].length >= open.length;
}

/** The index of the line closing the fence opened at `start`, or -1 when it never closes. */
export function fenceEnd(lines, start, open = openFence(lines[start])) {
  if (!open) return -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (closesFence(lines[index], open)) return index;
  }
  return -1;
}

/** A content line with up to the opening fence's indent taken off, as CommonMark does. */
export function unindentFenced(line, open) {
  let cut = 0;
  while (cut < open.indent && line[cut] === ' ') cut += 1;
  return line.slice(cut);
}

/**
 * Code spans in a line of text: runs of N backticks closed by the next run of exactly N.
 * Calls `replace(code)` with the span's text (one leading and trailing space taken off when
 * both are there and it isn't all spaces) and returns the line with each span replaced. Text
 * between spans goes through `text(part)`. A run with no matching closer stays as it is.
 */
export function replaceCodeSpans(value, replace, text = part => part) {
  let out = '';
  let plain = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] !== '`') {
      plain += value[index];
      index += 1;
      continue;
    }
    let run = 1;
    while (value[index + run] === '`') run += 1;
    let search = index + run;
    let close = -1;
    while (search < value.length) {
      const at = value.indexOf('`', search);
      if (at < 0) break;
      let length = 1;
      while (value[at + length] === '`') length += 1;
      if (length === run) { close = at; break; }
      search = at + length;
    }
    if (close < 0) {
      plain += value.slice(index, index + run);
      index += run;
      continue;
    }
    let code = value.slice(index + run, close);
    if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
    out += text(plain) + replace(code);
    plain = '';
    index = close + run;
  }
  return out + text(plain);
}
