// Run: node lib/medical.test.mjs
import assert from 'node:assert/strict';
import { doseLock, numberTokens } from './medical.js';

assert.deepEqual(numberTokens('Metformin 500 mg 1-0-1 for 30 days, 1/2 tab, 2.5 ml'), ['500', '1-0-1', '30', '1/2', '2.5']);

// Telugu translation that keeps every number passes.
assert.equal(doseLock('Amlodipine 5 mg, 1 tablet at night for 30 days', 'అమ్లోడిపిన్ 5 mg, రాత్రి 1 మాత్ర, 30 రోజులు').ok, true);

// A dropped dose is caught.
const dropped = doseLock('Metformin 500 mg twice a day', 'మెట్‌ఫార్మిన్ రోజుకు రెండు సార్లు');
assert.equal(dropped.ok, false);
assert.deepEqual(dropped.missing, ['500', '2']); // "twice" counts as 2

// An invented number is caught.
const invented = doseLock('Take it at night', 'రాత్రి 2 మాత్రలు');
assert.equal(invented.ok, false);
assert.deepEqual(invented.extra, ['2']);

// A changed pattern is caught: 1-0-1 is not 1-1-1.
assert.equal(doseLock('1-0-1 after food', '1-1-1 భోజనం తర్వాత').ok, false);

// Dose words are numbers: a "half" that becomes a whole tablet is caught.
assert.deepEqual(numberTokens('Half a tablet twice a day, one and a half for 3 days'), ['1/2', '2', '1.5', '3']);
assert.equal(doseLock('Take half a tablet at night', 'రాత్రి 1 మాత్ర').ok, false);
assert.equal(doseLock('Take half a tablet at night', 'రాత్రి 1/2 మాత్ర').ok, true);
assert.equal(doseLock('Twice a day', 'Do baar').ok, false); // number word in the translation -> held, not passed
assert.deepEqual(numberTokens('Once, after an injection, I got a rash'), []);

// Leading zeros do not matter.
assert.equal(doseLock('05 days', '5 రోజులు').ok, true);

console.log('dose lock: all checks pass');

// The scripted demo must pass its own dose lock, turn by turn.
const { DEMO } = await import('./demo.js');
for (const [i, t] of DEMO.turns.entries()) {
  const src = t.speaker === 'doctor' ? t.interp.plain_source : t.text;
  const r = doseLock(src, t.interp.translation);
  assert.ok(r.ok, `demo turn t${i + 1}: ${JSON.stringify(r)}`);
}
console.log('demo script: dose lock holds on every turn');
