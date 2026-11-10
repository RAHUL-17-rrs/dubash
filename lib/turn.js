// One interpreted turn: model call + dose lock, with a single corrective retry if numbers drift.
import { json } from './llm.js';
import { interpretPrompt } from './prompts.js';
import { doseLock } from './medical.js';

export async function interpretTurn({ speaker, text, patientLang, history = [] }) {
  const t0 = Date.now();
  let interp = await json(interpretPrompt({ speaker, text, patientLang, history }));
  const source = () => (speaker === 'doctor' && interp.plain_source) || text;
  let lock = doseLock(source(), interp.translation);
  let caught = null;
  if (!lock.ok) {
    // ponytail: one retry, then the turn is held for the doctor to confirm; a loop could burn the whole latency budget
    caught = { missing: lock.missing, extra: lock.extra };
    const fix = [lock.missing.length && `missing ${lock.missing.join(', ')}`, lock.extra.length && `invented ${lock.extra.join(', ')}`]
      .filter(Boolean)
      .join('; ');
    interp = await json(interpretPrompt({ speaker, text, patientLang, history, fix }));
    lock = doseLock(source(), interp.translation);
  }
  // A clash with something the patient said earlier stops the line until the doctor decides.
  const hold = !lock.ok || interp.confidence === 'low' || (speaker === 'doctor' && interp.conflicts.length > 0);
  return { interp, lock: { ...lock, caught }, hold, ms: Date.now() - t0 };
}
