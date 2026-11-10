import { json } from '@/lib/llm';
import { notePrompt, keepRealCitations } from '@/lib/prompts';
import { route } from '@/lib/http';
import { verifyWrap } from '@/lib/verify';

export const maxDuration = 60;

// Wrap-up: English note for the doctor (every line cites turns) + take-home slip in the patient's language.
export const POST = route(async (req) => {
  const { turns = [], patientLang = 'te-IN', teachback = null } = await req.json();
  if (!turns.length) return Response.json({ error: 'No turns yet' }, { status: 400 });
  const out = await json({ ...notePrompt({ turns, patientLang, teachback }), maxTokens: 6000 });
  // Citations must point at real turns, and every number must have been said in them.
  return Response.json(verifyWrap({ note: keepRealCitations(out.note, turns), take_home: out.take_home }, turns));
});
