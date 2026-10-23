// Forms: Markdown templates with fields (Metatrash 0.49.0). A template's front matter has
// form, title and submitTo; its fields are {{type name=… attr…}} tokens, and a choice or
// select takes its options from the list right below it. Tokens in code and comments are
// text. Metatrash's internal/service/forms.go parses the same syntax and has the final say
// on every answer; keep the two in step (see Metatrash's docs/forms.md).

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'time', 'email', 'phone', 'choice', 'select', 'yesno', 'sign'];

const MAX_FIELDS = 200;
const MAX_OPTIONS = 100;
const MAX_OPTION_TEXT = 200;
const MAX_LABEL = 200;
const MAX_PATTERN = 500;
const MAX_TITLE = 200;

const FORM_NAME = /^[a-z0-9][a-z0-9-]{0,47}$/;
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const FIELD_TOKEN = /\{\{\s*([A-Za-z]+)((?:[^{}"]|"(?:[^"\\]|\\.)*")*)\}\}/g;
const ATTRIBUTE = /^\s*([A-Za-z][A-Za-z-]*)(?:=(?:"((?:[^"\\]|\\.)*)"|([^\s"]+)))?/;
const OPTION_LINE = /^(\s*)([-*+])\s+(?:\[[ xX]\]\s+|\(\s?[xX]?\s?\)\s+)?(.*\S)\s*$/;
const FENCE = /^ {0,3}(```+|~~~+)/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,24}$/;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const CONTROL_MULTILINE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;

const COMMON_ATTRIBUTES = new Set(['name', 'label', 'required', 'placeholder']);
const TYPE_ATTRIBUTES = {
  text: ['min', 'max', 'pattern'],
  textarea: ['min', 'max', 'rows'],
  number: ['min', 'max', 'step'],
  date: ['min', 'max'],
  time: ['min', 'max'],
  email: [],
  phone: [],
  choice: ['multi', 'min', 'max'],
  select: [],
  yesno: [],
  sign: [],
};

// Placeholders for fields and comment hints while fill mode renders the document; private
// use characters, which Markdown leaves alone.
export const FIELD_MARK = /\uE000(\d+)\uE001/g;
export const HINT_MARK = /\uE002(\d+)\uE003/g;

/** The front matter keys of text (the block between --- lines at the start), its body lines and the line the body starts on. */
export function splitFrontMatter(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  if (lines.length < 2 || lines[0].trimEnd() !== '---') return { keys: null, body: lines, bodyStart: 0 };
  const keys = {};
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    if (trimmed === '---' || trimmed === '...') return { keys, body: lines.slice(i + 1), bodyStart: i + 1 };
    if (!line || line[0] === ' ' || line[0] === '\t' || line[0] === '#') continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    let value = line.slice(colon + 1).trim();
    if (value.length >= 2 && value[0] === '"' && value.at(-1) === '"') {
      try { value = JSON.parse(value); } catch { /* keep it as written */ }
    } else if (value.length >= 2 && value[0] === "'" && value.at(-1) === "'") {
      value = value.slice(1, -1).replaceAll("''", "'");
    }
    keys[line.slice(0, colon).trim()] = String(value);
  }
  return { keys: null, body: lines, bodyStart: 0 };
}

function isFormKeys(keys) {
  return Boolean(keys) && Object.hasOwn(keys, 'form') && !Object.hasOwn(keys, 'submittedAt');
}

/** Whether markdown is a form template: front matter with form, and no submittedAt (a filed copy). */
export function isFormTemplate(markdown) {
  return isFormKeys(splitFrontMatter(markdown).keys);
}

/**
 * Masks comments and code spans in line so tokens in them are not found. comment carries an
 * open <!-- comment to the next line; the ranges of comment text on this line are returned.
 */
function maskLine(line, comment) {
  const chars = line.split('');
  const ranges = [];
  const blank = (from, to) => { for (let k = from; k < to; k += 1) chars[k] = ' '; };
  let i = 0;
  while (i < line.length) {
    if (comment.open) {
      const end = line.indexOf('-->', i);
      const stop = end < 0 ? line.length : end + 3;
      ranges.push({ start: i, end: stop, text: line.slice(i, end < 0 ? line.length : end), opens: false, closes: end >= 0 });
      blank(i, stop);
      i = stop;
      if (end >= 0) comment.open = false;
      continue;
    }
    if (line.startsWith('<!--', i)) {
      const end = line.indexOf('-->', i + 4);
      const stop = end < 0 ? line.length : end + 3;
      ranges.push({ start: i, end: stop, text: line.slice(i + 4, end < 0 ? line.length : end), opens: true, closes: end >= 0 });
      blank(i, stop);
      comment.open = end < 0;
      i = stop;
      continue;
    }
    if (line[i] === '`') {
      let run = 1;
      while (line[i + run] === '`') run += 1;
      const ticks = '`'.repeat(run);
      const closing = line.indexOf(ticks, i + run);
      if (closing < 0) {
        i += run;
        continue;
      }
      blank(i, closing + run);
      i = closing + run;
      continue;
    }
    i += 1;
  }
  return { masked: chars.join(''), ranges };
}

/**
 * Calls visit(lineIndex, line, fence, tokens, comments) for every body line: fence is true
 * inside fenced code (no tokens or comments there), tokens are {start, end, kind, attrs}.
 */
function scanLines(lines, visit) {
  let fence = '';
  const comment = { open: false };
  lines.forEach((line, index) => {
    if (!fence && !comment.open) {
      const match = line.match(FENCE);
      if (match) {
        fence = match[1];
        visit(index, line, true, [], []);
        return;
      }
    } else if (fence) {
      const trimmed = line.trim();
      if (trimmed.startsWith(fence.slice(0, 3)) && trimmed.split(fence[0]).join('') === '' && trimmed.length >= fence.length) fence = '';
      visit(index, line, true, [], []);
      return;
    }
    const { masked, ranges } = maskLine(line, comment);
    const tokens = [];
    for (const match of masked.matchAll(FIELD_TOKEN)) {
      const start = match.index;
      const end = start + match[0].length;
      const full = line.slice(start, end);
      const inner = full.match(/^\{\{\s*([A-Za-z]+)([\s\S]*)\}\}$/);
      tokens.push({ start, end, kind: inner[1], attrs: inner[2] });
    }
    visit(index, line, false, tokens, ranges);
  });
}

/** Reads a token's attributes: name=value, name="quoted value" (with \" and \\) or a bare flag. */
export function parseAttributes(text) {
  const attrs = {};
  let rest = String(text);
  while (rest.trim()) {
    const match = rest.match(ATTRIBUTE);
    if (!match) throw new Error(`cannot read "${rest.trim()}"`);
    const key = match[1];
    let value = 'true';
    if (match[2] !== undefined) value = match[2].replace(/\\(["\\])/g, '$1');
    else if (match[3] !== undefined) value = match[3];
    if (Object.hasOwn(attrs, key)) throw new Error(`${key} is given twice`);
    attrs[key] = value;
    rest = rest.slice(match[0].length);
    if (rest && rest[0] !== ' ' && rest[0] !== '\t') throw new Error('put a space between attributes');
  }
  return attrs;
}

function runeLength(value) {
  return [...value].length;
}

function wholeNumber(value) {
  return /^[+-]?\d+$/.test(value) ? Number(value) : NaN;
}

function validDate(value) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function checkFieldAttributes(field) {
  const a = field.attrs;
  const whole = (key, lo, hi) => {
    if (!Object.hasOwn(a, key)) return;
    const n = wholeNumber(a[key]);
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${key} must be a whole number from ${lo} to ${hi}`);
  };
  switch (field.type) {
    case 'text':
    case 'textarea': {
      const limit = field.type === 'textarea' ? 20000 : 2000;
      whole('min', 0, limit);
      whole('max', 1, limit);
      whole('rows', 1, 40);
      if (Object.hasOwn(a, 'pattern')) {
        if (a.pattern.length > MAX_PATTERN) throw new Error(`pattern is limited to ${MAX_PATTERN} characters`);
        try {
          field.pattern = new RegExp(`^(?:${a.pattern})$`, 'u');
        } catch {
          // JavaScript reads some patterns differently from the server, which checks them.
          field.pattern = null;
        }
      }
      break;
    }
    case 'number':
      for (const key of ['min', 'max', 'step']) {
        if (!Object.hasOwn(a, key)) continue;
        const n = Number(a[key]);
        if (!NUMBER.test(a[key]) || !Number.isFinite(n) || (key === 'step' && n <= 0)) throw new Error(`${key} must be a number`);
      }
      break;
    case 'date':
      for (const key of ['min', 'max']) {
        if (Object.hasOwn(a, key) && a[key] !== 'today' && !validDate(a[key])) throw new Error(`${key} must be a date such as 2026-01-31, or today`);
      }
      break;
    case 'time':
      for (const key of ['min', 'max']) {
        if (Object.hasOwn(a, key) && !TIME.test(a[key])) throw new Error(`${key} must be a time such as 09:30`);
      }
      break;
    case 'choice':
      field.multi = a.multi === 'true';
      if (Object.hasOwn(a, 'multi') && a.multi !== 'true') throw new Error('multi takes no value');
      if (!field.multi && (a.min || a.max)) throw new Error('min and max (how many to pick) need multi');
      whole('min', 0, MAX_OPTIONS);
      whole('max', 1, MAX_OPTIONS);
      break;
    default:
  }
}

/** The list right below line (one blank line may come first): its first and last line and each item's text. */
function fieldOptions(body, line) {
  let i = line + 1;
  if (i < body.length && body[i].trim() === '') i += 1;
  const first = i;
  const options = [];
  for (; i < body.length; i += 1) {
    const match = body[i].match(OPTION_LINE);
    if (!match) break;
    options.push(match[3].trim());
  }
  if (!options.length) return { first: -1, last: -1, options };
  return { first, last: i - 1, options };
}

/**
 * Parses a form template. Returns null when markdown is not a form; otherwise
 * { form, title, submitTo, fields, error }, where error describes the template's first
 * mistake (the fields are then incomplete). Fields: { type, name, label, required, multi,
 * options, placeholder, attrs, line, firstOption, lastOption } with lines in the body.
 */
export function parseForm(markdown) {
  const { keys, body, bodyStart } = splitFrontMatter(markdown);
  if (!isFormKeys(keys)) return null;
  const result = { form: keys.form, title: keys.title || keys.form, submitTo: keys.submitTo || '', fields: [], error: '', body, bodyStart };
  const fail = message => { result.error = `This form template has a mistake: ${message}`; return result; };
  if (!FORM_NAME.test(result.form)) return fail('form must be a short name of lowercase letters, digits and hyphens, such as leave-request.');
  if (runeLength(result.title) > MAX_TITLE || CONTROL.test(result.title)) return fail(`title is limited to ${MAX_TITLE} characters.`);
  if (!result.submitTo) return fail('submitTo is missing: name the space and folder that receive the answers, such as owner/hr-review/leave/.');
  const names = new Set();
  const optionLines = new Set();
  let problem = '';
  scanLines(body, (line, text, fence, tokens) => {
    for (const token of tokens) {
      if (problem) return;
      const at = message => { problem = `line ${line + 1}: ${message}`; };
      const type = token.kind.toLowerCase();
      if (!FIELD_TYPES.includes(type)) return at(`{{${type}}} is not a field type; use text, textarea, number, date, time, email, phone, choice, select, yesno or sign.`);
      let attrs;
      try {
        attrs = parseAttributes(token.attrs);
      } catch (error) {
        return at(`{{${type}}}: ${error.message}.`);
      }
      const field = { type, name: attrs.name || '', label: attrs.label || '', required: false, multi: false, options: [], placeholder: attrs.placeholder || '', attrs, line, firstOption: -1, lastOption: -1, pattern: null };
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'required') {
          if (value !== 'true') return at('required takes no value.');
          field.required = true;
        } else if (!COMMON_ATTRIBUTES.has(key) && !TYPE_ATTRIBUTES[type].includes(key)) {
          return at(`{{${type}}} does not take ${key}.`);
        }
      }
      if (!FIELD_NAME.test(field.name)) return at('every field needs a name of letters, digits and _ starting with a letter, such as name=full_name.');
      if (names.has(field.name)) return at(`two fields are named ${field.name}.`);
      names.add(field.name);
      if (runeLength(field.label) > MAX_LABEL || runeLength(field.placeholder) > MAX_LABEL) return at(`label and placeholder are limited to ${MAX_LABEL} characters.`);
      try {
        checkFieldAttributes(field);
      } catch (error) {
        return at(`${field.name} ${error.message}.`);
      }
      if (type === 'choice' || type === 'select') {
        if (optionLines.has(line)) return at('only one choice or select field can start on a line, because its options are the list below it.');
        optionLines.add(line);
        const { first, last, options } = fieldOptions(body, line);
        Object.assign(field, { firstOption: first, lastOption: last, options });
        if (!options.length) return at(`${field.name} needs its options as a list right below it, such as - ( ) Yes.`);
        if (options.length > MAX_OPTIONS) return at(`${field.name} has more than ${MAX_OPTIONS} options.`);
        if (new Set(options).size !== options.length || options.some(o => runeLength(o) > MAX_OPTION_TEXT)) {
          return at(`${field.name}: each option must be different and at most ${MAX_OPTION_TEXT} characters.`);
        }
        if (field.multi && (Number(attrs.min || 0) > options.length || Number(attrs.max || 0) > options.length)) {
          return at(`${field.name} asks for more picks than it has options.`);
        }
      }
      if (result.fields.length === MAX_FIELDS) return at(`a form can have at most ${MAX_FIELDS} fields.`);
      result.fields.push(field);
    }
  });
  if (problem) return fail(problem);
  if (!result.fields.length) return fail('it has no fields; add one such as {{text name=full_name required}}.');
  return result;
}

/** What is wrong with one answer (a string, or a list for choice multi), or ''. today is YYYY-MM-DD. */
export function checkAnswer(field, value, today) {
  const a = field.attrs;
  if (field.multi) {
    const picked = Array.isArray(value) ? value : [];
    const seen = new Set();
    for (const p of picked) {
      if (!field.options.includes(p) || seen.has(p)) return `"${p}" is not one of the options.`;
      seen.add(p);
    }
    const lo = Number(a.min || 0);
    const hi = Number(a.max || 0);
    if (field.required && !picked.length) return 'Pick at least one.';
    if (lo > 0 && picked.length < lo && (picked.length > 0 || field.required)) return `Pick at least ${lo}.`;
    if (hi > 0 && picked.length > hi) return `Pick at most ${hi}.`;
    return '';
  }
  const s = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if ((field.type === 'textarea' ? CONTROL_MULTILINE : CONTROL).test(s)) return 'Use plain text on one line.';
  if (!s) {
    if (!field.required) return '';
    return field.type === 'sign' ? 'Sign the form to send it.' : 'This answer is required.';
  }
  switch (field.type) {
    case 'text':
    case 'textarea': {
      const n = runeLength(s);
      const limit = a.max ? Number(a.max) : (field.type === 'textarea' ? 5000 : 200);
      if (n > limit) return `Use at most ${limit} characters.`;
      if (n < Number(a.min || 0)) return `Use at least ${Number(a.min)} characters.`;
      if (field.pattern && !field.pattern.test(s)) return 'This answer is not in the form asked for.';
      return '';
    }
    case 'number': {
      const n = Number(s);
      if (!NUMBER.test(s) || !Number.isFinite(n) || s.length > 40) return 'Enter a number.';
      if (Object.hasOwn(a, 'min') && n < Number(a.min)) return `Enter ${a.min} or more.`;
      if (Object.hasOwn(a, 'max') && n > Number(a.max)) return `Enter ${a.max} or less.`;
      if (Object.hasOwn(a, 'step')) {
        const q = (n - Number(a.min || 0)) / Number(a.step);
        if (Math.abs(q - Math.round(q)) > 1e-9) return `Enter a number in steps of ${a.step}.`;
      }
      return '';
    }
    case 'date': {
      if (!validDate(s)) return 'Enter a date such as 2026-01-31.';
      const bound = v => (v === 'today' ? today : v);
      if (Object.hasOwn(a, 'min') && s < bound(a.min)) return `Enter ${bound(a.min)} or later.`;
      if (Object.hasOwn(a, 'max') && s > bound(a.max)) return `Enter ${bound(a.max)} or earlier.`;
      return '';
    }
    case 'time':
      if (!TIME.test(s)) return 'Enter a time such as 09:30.';
      if (Object.hasOwn(a, 'min') && s < a.min) return `Enter ${a.min} or later.`;
      if (Object.hasOwn(a, 'max') && s > a.max) return `Enter ${a.max} or earlier.`;
      return '';
    case 'email':
      return s.length > 254 || !EMAIL.test(s) ? 'Enter an email address.' : '';
    case 'phone': {
      const digits = (s.match(/\d/g) || []).length;
      return !PHONE.test(s) || digits < 6 || digits > 15 ? 'Enter a phone number.' : '';
    }
    case 'choice':
    case 'select':
      return field.options.includes(s) ? '' : 'Pick one of the options.';
    case 'yesno':
      return s === 'Yes' || s === 'No' ? '' : 'Answer Yes or No.';
    case 'sign':
      return s === 'true' ? '' : 'Sign by sending true.';
    default:
      return '';
  }
}

/** Checks every answer; returns [{ name, message }] for the ones that need fixing. */
export function checkAnswers(form, answers, today) {
  const problems = [];
  for (const field of form.fields) {
    const message = checkAnswer(field, answers?.[field.name], today);
    if (message) problems.push({ name: field.name, message });
  }
  return problems;
}

/**
 * The body as fill mode renders it: each field token becomes a field mark, each comment a
 * hint mark (hints holds their text), and a choice's option lines go (the field draws them).
 * Lines that held only a comment become a line holding only its hint.
 */
export function fillMarkdown(form) {
  const optionLines = new Set();
  const fieldAt = new Map();
  form.fields.forEach((field, index) => {
    fieldAt.set(`${field.line}:${field.name}`, index);
    for (let i = field.firstOption; i >= 0 && i <= field.lastOption; i += 1) optionLines.add(i);
  });
  const hints = [];
  const out = [];
  let openHint = -1;
  scanLines(form.body, (index, line, fence, tokens, comments) => {
    if (fence) {
      out.push(line);
      return;
    }
    if (optionLines.has(index)) return;
    const pieces = [];
    for (const token of tokens) {
      let name = '';
      try { name = parseAttributes(token.attrs).name || ''; } catch { /* not a field */ }
      const fieldIndex = fieldAt.get(`${index}:${name}`);
      if (fieldIndex !== undefined) pieces.push({ start: token.start, end: token.end, text: `\uE000${fieldIndex}\uE001` });
    }
    for (const comment of comments) {
      let text = '';
      if (comment.opens) {
        openHint = hints.length;
        hints.push(comment.text);
        text = `\uE002${openHint}\uE003`;
      } else if (openHint >= 0) {
        hints[openHint] += `\n${comment.text}`;
      }
      if (comment.closes) openHint = -1;
      pieces.push({ start: comment.start, end: comment.end, text });
    }
    pieces.sort((x, y) => x.start - y.start);
    let result = '';
    let last = 0;
    for (const piece of pieces) {
      if (piece.start < last) continue;
      result += line.slice(last, piece.start) + piece.text;
      last = piece.end;
    }
    result += line.slice(last);
    if (pieces.length && !result.trim()) return;
    out.push(result);
  });
  return { markdown: out.join('\n'), hints: hints.map(h => h.trim()) };
}

/** The person's local date as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
