// Run: node --test lib/verify.test.mjs
import assert from 'node:assert/strict';
import { verifyWrap } from './verify.js';
import { DEMO } from './demo.js';

const turns = [
  { id: 't1', speaker: 'doctor', text: 'Take Dolo 650 one tablet three times a day after food for 3 days.', plain: 'Take Dolo 650, 1 tablet, 3 times a day, after food, for 3 days.' },
  { id: 't2', speaker: 'doctor', text: 'Metformin 500 twice a day.', plain: 'Metformin 500 mg, 2 times a day.' },
];
const med = (name, dose, frequency, duration, ids) => ({ name, dose, frequency, timing: '', duration, turns: ids });
const slip = (name, how, days) => ({ name, how, why: '', morning: '1', noon: '0', night: '1', food: 'after', days });
const wrap = (meds, slips, plan = []) => ({
  note: { chief_complaint: '', history: [], plan, medicines: meds, red_flags: [], follow_up: '' },
  take_home: { greeting: '', medicines: slips, tests: [], come_back_if: [], next_visit: '' },
});

// Faithful note and slip: nothing flagged.
const ok = verifyWrap(wrap([med('Dolo 650', '1 tablet', '3 times a day', '3 days', ['t1'])], [slip('Dolo 650', '1 మాత్ర రోజుకు 3 సార్లు, 3 రోజులు', '3')]), turns);
assert.deepEqual(ok.issues, []);

// Slip changes the frequency: caught, even though the note is right.
const drift = verifyWrap(wrap([med('Dolo 650', '1 tablet', '3 times a day', '3 days', ['t1'])], [slip('Dolo 650', '1 మాత్ర రోజుకు 2 సార్లు', '3')]), turns);
assert.deepEqual(drift.take_home.medicines[0].unsaid, ['2']);
assert.equal(drift.issues.length, 1);

// Note invents a duration; checked only against the cited turn, so t1's "3" does not excuse t2's line.
const invented = verifyWrap(wrap([med('Metformin', '500 mg', '2 times a day', '30 days', ['t2'])], []), turns);
assert.deepEqual(invented.note.medicines[0].unsaid, ['30']);

// A slip medicine with no note line behind it is flagged.
assert.equal(verifyWrap(wrap([], [slip('Pantoprazole 40', '1 మాత్ర', '')]), turns).take_home.medicines[0].unsourced, true);

// A plan line with a number nobody said.
assert.deepEqual(verifyWrap(wrap([], [], [{ text: 'Review in 2 weeks.', turns: ['t1'] }]), turns).issues.length, 1);

// The scripted demo is faithful, so it raises nothing.
const demoTurns = DEMO.turns.map((t, i) => ({ id: `t${i + 1}`, speaker: t.speaker, text: t.text, plain: t.interp?.plain_source }));
const demo = verifyWrap(DEMO.note, demoTurns);
assert.deepEqual(demo.issues, [], demo.issues.join('\n'));
