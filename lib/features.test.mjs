// Run: node lib/features.test.mjs
import assert from 'node:assert/strict';
import { doseLock, numberTokens, dispense } from './medical.js';
import { groundAnswer, matchStrip } from './slip.js';
import { PHRASES, QUICK } from './phrases.js';
import { LANGUAGES } from './medical.js';
import { interpretPrompt, teachbackPrompt, INTERPRET_SCHEMA } from './prompts.js';
import { DEMO } from './demo.js';

// Native digits are the same numbers: a correct Hindi or Bengali translation must not be held.
assert.deepEqual(numberTokens('मेटफॉर्मिन ५०० mg, दिन में २ बार'), ['500', '2']);
assert.equal(doseLock('Metformin 500 mg, 2 times a day', 'মেটফর্মিন ৫০০ mg, দিনে ২ বার').ok, true);
assert.equal(doseLock('Metformin 500 mg, 2 times a day', 'মেটফর্মিন ৫০০ mg, দিনে ৩ বার').ok, false); // and a changed one still is

// Chemist line: tablets per day x days, in code.
assert.deepEqual(dispense({ morning: '1', noon: '0', night: '1', days: '5' }), { perDay: 2, days: 5, total: 10 });
assert.deepEqual(dispense({ morning: '1/2', noon: '0', night: '1/2', days: '3' }), { perDay: 1, days: 3, total: 3 });
assert.equal(dispense({ morning: '1', noon: '0', night: '0', days: '' }).total, null); // ongoing: no total

// Ask the slip: an answer survives only if it was found and invents no number.
const slip = DEMO.note.take_home;
const fb = 'ASK YOUR DOCTOR';
assert.equal(groundAnswer({ found: true, answer: 'Amlodipine 5 mg రాత్రి 1 మాత్ర.' }, slip, fb).found, true);
assert.equal(groundAnswer({ found: true, answer: 'Amlodipine 10 mg రాత్రి 1 మాత్ర.' }, slip, fb).answer, fb); // 10 is not on the slip
assert.equal(groundAnswer({ found: false, answer: 'anything' }, slip, fb).answer, fb);
assert.equal(groundAnswer({ found: true, answer: '' }, slip, fb).answer, fb);

// Show the strip: brand or generic name, then strength.
const meds = slip.medicines;
assert.equal(matchStrip({ readable: true, brand: 'Glycomet', generic: 'Metformin Hydrochloride', strength: '500 mg' }, meds).status, 'match');
assert.equal(matchStrip({ readable: true, brand: 'Glycomet', generic: 'Metformin', strength: '850 mg' }, meds).status, 'wrong_strength');
assert.equal(matchStrip({ readable: true, brand: 'Dolo', generic: 'Paracetamol', strength: '650 mg' }, meds).status, 'not_on_slip');
assert.equal(matchStrip({ readable: false, brand: '', generic: '', strength: '' }, meds).status, 'unreadable');

// Every patient language has every fixed phrase, and no quick phrase smuggles in a number.
for (const code of Object.keys(LANGUAGES).filter((c) => c !== 'en-IN')) {
  const p = PHRASES[code];
  assert.ok(p?.lost && p.family && p.askDoctor, `${code}: fixed phrases`);
  for (const q of QUICK) {
    assert.ok(p.quick[q.id], `${code}: quick phrase ${q.id}`);
    assert.ok(doseLock(q.en, p.quick[q.id]).ok, `${code}: ${q.id}`);
  }
}

// Pinned facts reach the interpreter, family turns are named as such, and round 2 of teach-back sends only the gaps.
const p = interpretPrompt({ speaker: 'family', text: 'x', patientLang: 'te-IN', history: [], facts: ['Allergy: penicillin'] });
assert.match(p.user, /Patient facts[\s\S]*Allergy: penicillin/);
assert.match(p.user, /New family turn/);
assert.ok(INTERPRET_SCHEMA.required.includes('facts') && INTERPRET_SCHEMA.required.includes('clarify'));
assert.match(teachbackPrompt({ instructions: ['a'], retelling: 'r', patientLang: 'te-IN', items: ['Come back after 2 weeks'] }).user, /Plan items to check:\n1\. Come back after 2 weeks/);

console.log('features: indic digits, chemist line, ask-the-slip grounding, strip match, phrases, prompts');
