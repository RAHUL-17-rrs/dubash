// Wrap-up grounding check, in code rather than a second model call: every number the model wrote into the clinical note
// or the take-home slip must have been said in the turns it came from. The slip is what the patient keeps, so a dose
// the doctor never said ("2 times" for "3 times") is the worst possible error here; this catches it before printing.
import { numberTokens } from './medical.js';

// "1" is the one number a careful model writes without it being spoken: "a tablet", "once daily", "every morning".
const IMPLIED_ONE = /\b(a|an|one|once|single|each|every|daily|nightly)\b|\bat night\b|\ba day\b/i;

const drugKey = (name) => String(name).toLowerCase().match(/[a-z]+/)?.[0] || '';

export function verifyWrap({ note, take_home }, turns) {
  const byId = new Map(turns.map((t) => [t.id, t]));
  const said = (ids) => {
    const src = ids.map((id) => byId.get(id)).filter(Boolean).map((t) => `${t.text || ''} ${t.plain || ''}`).join(' ');
    return { nums: new Set(numberTokens(src)), one: IMPLIED_ONE.test(src) };
  };
  // Numbers in `fields` that never appear in the cited turns.
  const unsaid = (fields, ids) => {
    const s = said(ids);
    const wrote = [...new Set(fields.flatMap((f) => numberTokens(f || '')))];
    return wrote.filter((n) => !s.nums.has(n) && !(n === '1' && s.one));
  };

  const medicines = note.medicines.map((m) => ({ ...m, unsaid: unsaid([m.name, m.dose, m.frequency, m.duration], m.turns) }));
  const plan = note.plan.map((r) => ({ ...r, unsaid: unsaid([r.text], r.turns) }));

  // A slip line is checked against the turns behind the note's line for the same drug; no such line = no source at all.
  const slipMeds = take_home.medicines.map((m) => {
    const src = medicines.find((n) => drugKey(n.name) && drugKey(n.name) === drugKey(m.name));
    return { ...m, unsaid: src ? unsaid([m.name, m.how, m.days], src.turns) : [], unsourced: !src };
  });

  const issues = [
    ...medicines.filter((m) => m.unsaid.length).map((m) => `Note: ${m.name} has ${m.unsaid.join(', ')}, not said in ${m.turns.join(' ') || 'any turn'}.`),
    ...plan.filter((r) => r.unsaid.length).map((r) => `Note plan: "${r.text}" has ${r.unsaid.join(', ')}, not said in ${r.turns.join(' ') || 'any turn'}.`),
    ...slipMeds.filter((m) => m.unsourced).map((m) => `Slip: ${m.name} is not in the doctor's medicines.`),
    ...slipMeds.filter((m) => m.unsaid.length).map((m) => `Slip: ${m.name} has ${m.unsaid.join(', ')}, which the doctor did not say.`),
  ];
  return { note: { ...note, medicines, plan }, take_home: { ...take_home, medicines: slipMeds }, issues };
}
