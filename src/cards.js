// Dashboard cards (Slate 0.24.0, Metatrash 0.99.0). A fenced block with the info string `card`
// holds `key: value` lines, and for a Markdown card its own text after a line `---`:
//
//   ```card
//   title: Jobs by type
//   size: wide
//   show: pie
//   source: jobs/
//   where: state!=done
//   group: type
//   ```
//
// This file reads a card and its show-if conditions; slate.js draws it with data from the host
// (Slate Viewer asks Metatrash), which owns where sources are and who may read them.

export const CARD_SHOWS = ['count', 'list', 'table', 'pie', 'bar', 'line', 'markdown', 'form'];
export const CARD_SIZES = ['normal', 'wide', 'full'];
export const QUERY_SHOWS = new Set(['count', 'list', 'table', 'pie', 'bar', 'line']);
const KEYS = new Set(['title', 'size', 'show', 'source', 'where', 'group', 'measure', 'sort', 'limit', 'columns', 'show-if']);
const MAX_TITLE = 120;

/** The card in a fence's lines: { title, size, show, query, showIf, body } or { error }. */
export function parseCard(lines) {
  const card = { title: '', size: 'normal', show: '', source: '', query: {}, showIf: [], body: null, keys: {} };
  let index = 0;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '---') {
      card.body = lines.slice(index + 1).join('\n');
      break;
    }
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z][A-Za-z-]*)\s*:\s*(.*?)\s*$/);
    if (!match) return { error: `Line ${index + 1} should be key: value, such as show: pie.` };
    const key = match[1].toLowerCase();
    if (!KEYS.has(key)) return { error: `${match[1]} is not a card key; use title, size, show, source, where, group, measure, sort, limit, columns or show-if.` };
    if (Object.hasOwn(card.keys, key)) return { error: `${key} is given twice.` };
    card.keys[key] = match[2];
  }
  const keys = card.keys;
  card.title = (keys.title || '').slice(0, MAX_TITLE);
  card.size = (keys.size || 'normal').toLowerCase();
  if (!CARD_SIZES.includes(card.size)) return { error: 'size is normal, wide or full.' };
  card.show = (keys.show || (card.body !== null ? 'markdown' : '')).toLowerCase();
  if (!CARD_SHOWS.includes(card.show)) return { error: `show is ${CARD_SHOWS.slice(0, -1).join(', ')} or form.` };
  card.source = keys.source || '';
  if (QUERY_SHOWS.has(card.show)) {
    if (!card.source) return { error: 'source is missing: a folder such as jobs/, or a .csv file.' };
    const query = { source: card.source };
    for (const key of ['where', 'group', 'measure', 'sort', 'columns']) if (keys[key]) query[key] = keys[key];
    if (keys.limit) {
      const limit = Number(keys.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) return { error: 'limit is a whole number from 1 to 500.' };
      query.limit = limit;
    }
    if (['pie', 'bar', 'line'].includes(card.show) && !query.group) return { error: `A ${card.show} chart needs group: the field to split by.` };
    // A line runs along its groups in order (months, dates), not largest first.
    if (card.show === 'line' && !query.sort) query.sort = 'group';
    card.query = query;
  } else if (card.show === 'form') {
    if (!/\.md$/i.test(card.source)) return { error: 'A form card names a .md file as its source.' };
  } else if (card.show === 'markdown' && !card.source && card.body === null) {
    return { error: 'A markdown card has a source (.md file) or its own text after a line ---.' };
  }
  if (keys['show-if']) {
    const parsed = parseConditions(keys['show-if']);
    if (parsed.error) return { error: `show-if: ${parsed.error}` };
    card.showIf = parsed.conditions;
  }
  return card;
}

const CONDITION = /^\s*(!?)\s*(@?[A-Za-z][A-Za-z0-9_]{0,63})\s*(?:(!=|>=|<=|=|>|<)\s*([\s\S]*?))?\s*$/;
const CONTEXT = new Set(['@count', '@time', '@today', '@weekday', '@me', '@done']);

/** show-if: conditions separated by ;, all of which must hold. */
export function parseConditions(text) {
  const conditions = [];
  for (const part of String(text).split(';')) {
    if (!part.trim()) continue;
    const match = part.match(CONDITION);
    if (!match || (match[1] && match[3])) return { error: `cannot read "${part.trim()}".` };
    const name = match[2].toLowerCase();
    if (!CONTEXT.has(name)) return { error: `${match[2]} is not something a card knows; use @count, @time, @today, @weekday, @me or @done.` };
    if (match[3] && match[4] === '') return { error: `"${part.trim()}" compares with nothing.` };
    conditions.push({ not: Boolean(match[1]), name, op: match[3] || '', values: match[3] ? match[4].split('|').map(v => v.trim()) : [] });
  }
  return { conditions };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = n => String(n).padStart(2, '0');

/** What a card's conditions see now: the viewer's date, time and weekday, and who they are. */
export function cardContext(now = new Date(), me = '') {
  return {
    '@today': `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    '@time': `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    '@weekday': WEEKDAYS[now.getDay()],
    '@me': me,
    '@count': 0,
    '@done': false,
  };
}

function orderValue(text) {
  const s = String(text ?? '').trim();
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`) / 86400000;
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return null;
}

/** Whether every condition holds in context (see cardContext; @count and @done set by the card). */
export function conditionsHold(conditions, context) {
  return conditions.every(c => {
    const got = context[c.name];
    let holds;
    if (!c.op) {
      holds = c.name === '@done' ? Boolean(got) : c.name === '@count' ? Number(got) > 0 : String(got ?? '') !== '';
    } else if (c.op === '=' || c.op === '!=') {
      const value = c.name === '@done' ? (got ? 'true' : 'false') : String(got ?? '');
      const match = c.values.some(v => v.toLowerCase() === value.toLowerCase());
      holds = c.op === '=' ? match : !match;
    } else {
      const want = orderValue(c.values[0] === 'today' ? context['@today'] : c.values[0]);
      const have = orderValue(got);
      if (want === null || have === null) holds = false;
      else if (c.op === '>') holds = have > want;
      else if (c.op === '>=') holds = have >= want;
      else if (c.op === '<') holds = have < want;
      else holds = have <= want;
    }
    return c.not ? !holds : holds;
  });
}

/** A number as a card shows it: whole numbers with separators, others to two places. */
export function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** The columns a table or list shows: the card's, else the source's fields but file. */
export function cardColumns(card, result) {
  const given = String(card.keys.columns || '').split(',').map(c => c.trim()).filter(Boolean);
  if (given.length) return given;
  return (result.fields || []).filter(f => f !== 'file');
}

/** Sorts rows by a column for a table header click; numbers, dates and times by value. */
export function sortRows(rows, column, descending) {
  const sorted = [...rows].sort((a, b) => {
    const x = a.values[column] ?? '';
    const y = b.values[column] ?? '';
    if ((x === '') !== (y === '')) return x === '' ? 1 : -1;
    const ox = orderValue(x);
    const oy = orderValue(y);
    const c = ox !== null && oy !== null ? ox - oy : String(x).localeCompare(String(y), undefined, { sensitivity: 'base' });
    return descending ? -c : c;
  });
  return sorted;
}
