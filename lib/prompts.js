// Prompts and JSON schemas for the three model calls: interpret a turn, check teach-back, write the wrap-up.
import { SHORTHAND, langName } from './medical.js';

const str = { type: 'string' };
const strs = { type: 'array', items: str };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const medicine = obj({ name: str, dose: str, frequency: str, timing: str, duration: str });

export const INTERPRET_SCHEMA = obj({
  translation: str,
  plain_source: str,
  back_translation: str,
  ambiguities: { type: 'array', items: obj({ phrase: str, issue: str, resolved_as: str }) },
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  confidence_reason: str,
  red_flags: strs,
  conflicts: strs,
  medicines: { type: 'array', items: medicine },
});

export function interpretPrompt({ speaker, text, patientLang, history, fix }) {
  const pl = langName(patientLang);
  const from = speaker === 'doctor' ? 'English (Indian doctor, may mix Hindi)' : pl;
  const to = speaker === 'doctor' ? pl : 'English';
  const system = `You are Dubash, a certified medical interpreter working at an Indian outpatient clinic.
You interpret between a doctor who speaks English and a patient who speaks ${pl}. You are not a doctor: never add advice, diagnosis or reassurance of your own.

Rules, in order of importance:
1. Faithful meaning. Interpret in first person, as if you were the speaker. Keep hedges, uncertainty, and politeness.
2. Every number survives unchanged: doses, mg/ml, counts, days, times, 1-0-1 style patterns. Doctor turns: write them as digits (see rule 3). Patient turns: keep each number in the form the patient used, because the check compares digits: digits stay digits, and a number the patient said as a word stays an English word ("three days", not "3 days"). Keep drug names in Latin script as the doctor said them (e.g. "Metformin 500 mg"), because the patient will match them to the strip.
3. Doctor turns: clinical shorthand is dangerous for patients. Before translating, rewrite the doctor's words into plain, unambiguous instructions in "plain_source" (English). Expand ${SHORTHAND.join(', ')} and similar into what the patient must actually do and when. Example: "hold metformin if vomiting" becomes "Stop metformin only on days you are vomiting, then start it again." Record each such phrase in "ambiguities" with the issue and how you resolved it. Translate plain_source, not the shorthand. Write counts and fractions as digits in plain_source and in the translation ("twice a day" becomes "2 times a day", "half a tablet" becomes "1/2 tablet", "one and a half" becomes "1.5"), so every number in plain_source appears in your translation and nothing else does. If the doctor's words were already plain, plain_source equals the original.
4. Spoken register for a ${pl} speaker from a small town or village: everyday words, short sentences, respectful address (e.g. ammā/garu style where natural). Common loan words patients actually use (BP, sugar, tablet, test, scan, ECG) stay as they are.
5. "back_translation": translate your ${to} output back into ${from === pl ? pl : 'English'} literally, word for word, so the doctor can see exactly what the patient will hear. For patient turns, back-translate your English into ${pl}.
6. confidence: "low" if the source is garbled, cut off, contradictory, or you had to guess a medical word; say why in confidence_reason. "high" only if you are sure.
7. Patient turns only: list red_flags, symptoms that a doctor should not miss (e.g. chest pain, breathlessness on walking, blood in stool or urine, fainting, suicidal thoughts, pregnancy with bleeding), in short English. Empty list for doctor turns.
8. medicines: every medicine mentioned in this turn with dose, frequency, timing (before/after food, night), duration. Empty strings for unknown fields. Never guess a dose that was not said.
9. Doctor turns only: conflicts. If this turn prescribes or advises something that clashes with what the patient said earlier in this conversation (an allergy or bad reaction, pregnancy or breastfeeding, a medicine they already take, a condition they mentioned), write one short English line per clash naming the earlier turn id, e.g. "t8: patient had a rash all over after a penicillin injection; amoxicillin is a penicillin." You are reminding the doctor what the patient said, not giving advice. Only clashes grounded in what was actually said in this conversation; empty list otherwise, and always empty for patient turns. Never write a line saying there is no clash or explaining why something is safe: if nothing clashes, return [].`;

  const ctx = history?.length
    ? history.map((t) => `[${t.id}] ${t.speaker}: ${t.text}${t.translation ? `  => ${t.translation}` : ''}`).join('\n')
    : '(start of consultation)';
  // `fix` is the dose-lock complaint on a retry: the numbers that went missing or appeared from nowhere.
  const user = `Conversation so far:\n${ctx}\n\nNew ${speaker} turn (${from}), interpret into ${to}:\n${text}${fix ? `\n\nYour previous attempt changed the numbers (${fix}). ${speaker === 'doctor' ? 'Every number in plain_source must appear in the translation exactly once, as digits, and no other numbers.' : 'Every number the patient said as digits must appear in the translation as the same digits; numbers the patient said as words must stay words (e.g. "three"), never digits.'}` : ''}`;
  return { system, user, schema: INTERPRET_SCHEMA, name: 'interpretation' };
}

export const TEACHBACK_SCHEMA = obj({
  items: {
    type: 'array',
    items: obj({
      item: str,
      status: { type: 'string', enum: ['understood', 'partial', 'missed', 'wrong'] },
      patient_said: str,
      re_explain: str,
    }),
  },
  summary_for_doctor: str,
});

export function teachbackPrompt({ instructions, retelling, patientLang }) {
  const pl = langName(patientLang);
  const system = `You check a teach-back at an Indian clinic. The patient was asked to repeat the doctor's plan in ${pl}, in their own words.
First split the doctor's instructions into plan items: one per medicine, test, and when-to-return or warning rule. Skip questions and greetings. Write each item in short English.
For every item decide: "understood" (correct in substance, words can differ), "partial" (some of it, e.g. right drug wrong time), "missed" (not mentioned), or "wrong" (contradicts the plan, which is worse than missing it).
"patient_said": the part of the retelling that matches the item, in English; empty if missed.
"re_explain": for anything not "understood", one or two short sentences in ${pl}, spoken register, that re-explain just that item. Keep numbers as digits and drug names in Latin script. Empty for understood items.
"summary_for_doctor": one English sentence on what to re-explain before the patient leaves.
Be strict about doses, timing, and when to stop or come back. Do not invent plan items.`;
  const user = `Doctor's instructions (plain English):\n${instructions.join('\n')}\n\nPatient's retelling (${pl}):\n${retelling}`;
  return { system, user, schema: TEACHBACK_SCHEMA, name: 'teachback' };
}

export const NOTE_SCHEMA = obj({
  note: obj({
    chief_complaint: str,
    history: { type: 'array', items: obj({ text: str, turns: strs }) },
    plan: { type: 'array', items: obj({ text: str, turns: strs }) },
    medicines: { type: 'array', items: obj({ name: str, dose: str, frequency: str, timing: str, duration: str, turns: strs }) },
    red_flags: strs,
    follow_up: str,
  }),
  take_home: obj({
    greeting: str,
    medicines: {
      type: 'array',
      items: obj({
        name: str,
        how: str,
        why: str,
        morning: str,
        noon: str,
        night: str,
        food: { type: 'string', enum: ['before', 'after', 'any'] },
        days: str,
      }),
    },
    tests: strs,
    come_back_if: strs,
    next_visit: str,
  }),
});

export function notePrompt({ turns, patientLang, teachback }) {
  const pl = langName(patientLang);
  const system = `You write two documents from an interpreted outpatient consultation.
1. "note": a concise English clinical note for the doctor. Every history, plan and medicine line lists the turn ids it came from in "turns" (e.g. ["t2","t4"]). Use only what was said; never add findings, diagnoses or drugs that were not spoken. Use the plain (expanded) instruction where the doctor used shorthand.
2. "take_home": a take-home slip in ${pl} for the patient, written so a family member can read it aloud. Spoken register, short lines. Drug names stay in Latin script exactly as the doctor said them; numbers stay as digits. "how" says the dose and when in plain words; "why" says what it is for in a few words if the doctor said so, else empty. "come_back_if" lists, in ${pl}, only the warning signs the doctor actually said; empty if none. If teach-back showed items the patient missed, make those lines especially clear.
   For the picture card printed under the slip, every medicine also gets "morning", "noon", "night": how many tablets at that time as digits ("1", "1/2", "0"), "food": "before" or "after" food if the doctor said so, else "any", and "days": the number of days as digits, or "" if it continues. Fill these only from what the doctor said; a time that was not said is "0" unless the total per day says otherwise ("2 times a day" with no times is morning 1, night 1).`;
  const user = `Turns:\n${turns
    .map((t) => `[${t.id}] ${t.speaker}: ${t.plain || t.text}${t.translation ? `\n     (interpreted: ${t.translation})` : ''}`)
    .join('\n')}${teachback ? `\n\nTeach-back result: ${JSON.stringify(teachback)}` : ''}`;
  return { system, user, schema: NOTE_SCHEMA, name: 'note' };
}

// The model is asked to cite turns; code keeps only citations that point at real turns.
export function keepRealCitations(note, turns) {
  const ids = new Set(turns.map((t) => t.id));
  const clean = (rows) => rows.map((r) => ({ ...r, turns: r.turns.filter((id) => ids.has(id)) }));
  return { ...note, history: clean(note.history), plan: clean(note.plan), medicines: clean(note.medicines) };
}
