// Checks forms.js reads default= and show-if= as Metatrash's internal/service/forms_flow.go does
// (the same template as its tests). Run with: node test/forms-flow-check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseForm, askedFields, hiddenLines, checkAnswers, defaultAnswer, showIfHolds, parseShowIf, fillMarkdown, showIfText, flowHidden, checkAnswer } from '../src/forms.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const expect = (ok, message) => { if (!ok) problems.push(message); };

const form = parseForm(readFileSync(join(root, 'test', 'guided-form.md'), 'utf8'));
expect(form && !form.error, `parse: ${form?.error}`);
const conds = Object.fromEntries(form.fields.map(f => [f.name, f.showIf ? showIfText(f.showIf) : '']));
for (const [name, want] of Object.entries({ details: 'damaged=Yes', cost: 'damaged=Yes', parts: 'damaged=Yes', manager: 'cost>=500', serial: 'parts=Screen', note: '', phone: '!contact', reporter: '' })) {
  expect(conds[name] === want, `${name} show-if ${conds[name]}, want ${want}`);
}

const head = '---\nform: f\nsubmitTo: dave/r/\n---\n';
for (const [body, message] of [
  ['{{text name=a default=@who}}', 'not one of @name'],
  ['{{date name=a default=@name}}', "can't take default @name"],
  ['{{sign name=a default=true}}', 'only the person signs'],
  ['{{choice name=a default=Maybe}}\n- ( ) Yes\n- ( ) No', 'not one of its options'],
  ['{{number name=a default=lots}}', 'must be a number'],
  ['{{text name=a show-if=b}}', 'not a field of this form'],
  ['{{text name=a}}\n\n{{text name=b show-if="a>3"}}', 'only numbers, dates and times'],
  ['{{yesno name=a}}\n\n{{text name=b show-if=a=Maybe}}', 'Yes or No'],
  ['{{text name=b show-if=a}}\n\n{{text name=a}}', 'must be asked before'],
  ['{{yesno name=a}} {{text name=b show-if=a}}', 'must be asked before'],
  ['{{yesno name=a}}\n\n{{text name=b show-if=a}}\n{{text name=c show-if=!a}}', 'same paragraph with different show-if'],
  ['{{number name=a}}\n\n{{text name=b show-if="a>1|2"}}', 'only after = or !='],
  ['{{sign name=a}}\n\n{{text name=b show-if=a}}', 'signature'],
]) {
  const error = parseForm(`${head}${body}\n`)?.error || '';
  expect(error.includes(message), `${body}: got "${error}", want "${message}"`);
}

const now = new Date(2026, 10, 9, 14, 5);
const person = { name: 'pat', email: 'pat@example.com' };
const byName = Object.fromEntries(form.fields.map(f => [f.name, f]));
const defaults = Object.fromEntries(form.fields.filter(f => f.default).map(f => [f.name, defaultAnswer(f, person, now)]));
expect(JSON.stringify(defaults) === JSON.stringify({ reporter: 'pat', contact: 'pat@example.com', day: '2026-11-09', at: '14:05', workshop: 'Workshop A', damaged: 'No', parts: ['Board', 'Case'] }), `defaults ${JSON.stringify(defaults)}`);
expect(defaultAnswer(byName.reporter, {}, now) === null, 'unknown @name should be left to the server');

const asked = askedFields(form, { damaged: 'No', contact: 'x@y.z' }, '2026-11-09');
expect(['details', 'cost', 'parts', 'manager', 'serial', 'phone'].every(n => !asked.has(n)), `asked with No: ${[...asked]}`);
const yes = askedFields(form, { damaged: 'Yes', cost: '650', parts: ['Screen'] }, '2026-11-09');
expect(['details', 'cost', 'parts', 'manager', 'serial', 'phone'].every(n => yes.has(n)), `asked with Yes: ${[...yes]}`);

const required = checkAnswers(form, { damaged: 'Yes', cost: '650', reporter: '' }, '2026-11-09', { serverFills: new Set(['reporter']) }).map(p => p.name).sort();
expect(JSON.stringify(required) === '["details","manager"]', `problems ${required}`);
expect(checkAnswers(form, { damaged: 'No' }, '2026-11-09').length === 0, 'hidden required questions checked');

const { markdown } = fillMarkdown(form, hiddenLines(form, asked));
for (const gone of ['What is damaged', 'Cost:', 'Parts:', 'Manager:', 'Screen serial', 'Phone instead']) expect(!markdown.includes(gone), `${gone} drawn while hidden`);
expect(markdown.includes('Always asked'), 'Always asked is gone');

for (const [cond, on, answer, want] of [
  ['n', { type: 'number' }, '', false], ['n', { type: 'number' }, '0', true], ['!n', { type: 'number' }, '', true],
  ['n=5', { type: 'number' }, '5.0', true], ['n!=5', { type: 'number' }, '4', true], ['n>5', { type: 'number' }, '5', false],
  ['n>=5', { type: 'number' }, '5', true], ['n<5', { type: 'number' }, '', false],
  ['d<today', { type: 'date' }, '2026-11-08', true], ['d>=2026-12-01', { type: 'date' }, '2026-11-08', false],
  ['m=B', { type: 'choice' }, ['A', 'B'], true], ['m!=B', { type: 'choice' }, ['A'], true], ['m=A|B', { type: 'choice' }, [], false], ['m', { type: 'choice' }, [], false],
]) {
  expect(showIfHolds(parseShowIf(cond), on, answer, '2026-11-09') === want, `${cond} with ${JSON.stringify(answer)} should be ${want}`);
}

// Auto flow: steps are headings; a step shows once the ones before it are complete.
const flow = parseForm(readFileSync(join(root, 'test', 'guided-flow.md'), 'utf8'));
expect(flow && !flow.error && flow.autoFlow && flow.steps.length === 4, `flow: ${flow?.error} ${flow?.steps?.length}`);
const shownFields = answers => {
  const asked = askedFields(flow, answers, '2026-11-09');
  const { hidden, waiting } = flowHidden(flow, answers, '2026-11-09', asked);
  return [flow.fields.filter(f => asked.has(f.name) && !hidden.has(f.line)).map(f => f.name).join(','), waiting];
};
for (const [answers, want, waiting] of [
  [{}, 'serial,rev', true],
  [{ serial: 'S', rev: 'A' }, 'serial,rev,power', true],
  [{ serial: 'S', rev: 'A', power: 'No' }, 'serial,rev,power,fault', true],
  [{ serial: 'S', rev: 'A', power: 'Yes' }, 'serial,rev,power,notes', false],
  [{ serial: 'S', rev: 'A', power: 'No', fault: 'x' }, 'serial,rev,power,fault,notes', false],
]) {
  const [got, wait] = shownFields(answers);
  expect(got === want && wait === waiting, `flow ${JSON.stringify(answers)}: ${got} ${wait}`);
}
expect(parseForm(`${head}{{text name=a}}\n`.replace('---\n{{', 'autoFlow: yes\n---\n{{'))?.error.includes('autoFlow is true or false'), 'autoFlow: yes accepted');

// Photo fields: max, required, not a default or a show-if, not in a quiz, 20 in all.
const photoForm = parseForm(`${head}Damaged? {{yesno name=damaged}}\n\nPhotos: {{photo name=damage max=3 required show-if="damaged=Yes"}}\n`);
expect(photoForm && !photoForm.error, `photo form: ${photoForm?.error}`);
const photoField = photoForm.fields[1];
expect(checkAnswer(photoField, [], '2026-11-09') === 'Add a photo.', 'photo required');
expect(checkAnswer(photoField, ['a', 'b', 'c', 'd'], '2026-11-09') === 'Add at most 3 photos.', 'photo max');
expect(checkAnswer(photoField, ['data:image/jpeg;base64,AA=='], '2026-11-09') === '', 'one photo');
expect(checkAnswers(photoForm, { damaged: 'No' }, '2026-11-09').length === 0, 'photo not asked');
for (const [body, want] of [
  ['{{photo name=p max=11}}', 'max must be a whole number from 1 to 10'],
  ['{{photo name=p default=x}}', "can't have a default"],
  ['{{photo name=p}}\n\n{{text name=q show-if=p}}', "show-if can't depend on a photo"],
  ['{{photo name=a max=10}} {{photo name=b max=10}} {{photo name=c}}', 'at most 20 photos'],
]) {
  expect(parseForm(`${head}${body}\n`)?.error.includes(want), `${body}: ${parseForm(`${head}${body}\n`)?.error}`);
}
expect(parseForm(`${head}{{photo name=p}}\n`.replace('---\n{{', 'quiz: true\n---\n{{'))?.error.includes("a quiz can't ask for photos"), 'photo in a quiz');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('forms flow: all checks passed');
