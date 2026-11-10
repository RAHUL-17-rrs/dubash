// One interpreted turn: model call + dose lock, with a single corrective retry if numbers drift.
import { json } from './llm.js';
import { interpretPrompt } from './prompts.js';
import { doseLock } from './medical.js';

export async function interpretTurn({ speaker, text, patientLang, history = [], facts = [] }) {
  const t0 = Date.now();
  let interp = await json(interpretPrompt({ speaker, text, patientLang, history, facts }));
  const source = () => (speaker === 'doctor' && interp.plain_source) || text;
  let lock = doseLock(source(), interp.translation);
  let caught = null;
  if (!lock.ok) {
    // ponytail: one retry, then the turn is held for the doctor to confirm; a loop could burn the whole latency budget
    caught = { missing: lock.missing, extra: lock.extra };
    const fix = [lock.missing.length && `missing ${lock.missing.join(', ')}`, lock.extra.length && `invented ${lock.extra.join(', ')}`]
      .filter(Boolean)
      .join('; ');
    interp = await json(interpretPrompt({ speaker, text, patientLang, history, facts, fix }));
    lock = doseLock(source(), interp.translation);
  }
  // Each conflict carries an explicit `clashes` flag, because models also list the non-clashes they checked
  // ("Dolo 650 is not a penicillin"); only real clashes stop the line. The UI gets one readable line per clash.
  interp.conflicts = (interp.conflicts || []).filter((c) => c.clashes === true).map((c) => `${c.earlier_turn}: ${String(c.patient_said).replace(/[.\s]+$/, '')}; ${c.why}`);
  // A clash with something the patient said earlier stops the line until the doctor decides.
  const hold = !lock.ok || interp.confidence === 'low' || (speaker === 'doctor' && interp.conflicts.length > 0);
  // Read-back: a turn that prescribes something is not spoken until the doctor has seen the drug, dose and timing
  // as Dubash heard them. The dose lock compares translation to transcript, so it cannot see a misheard "15" for "50";
  // the doctor can.
  const readback = !hold && speaker === 'doctor' && (interp.medicines || []).some((m) => m.dose || m.frequency);
  return { interp, lock: { ...lock, caught }, hold, readback, ms: Date.now() - t0 };
}
