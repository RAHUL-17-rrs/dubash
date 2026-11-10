import { json } from '@/lib/llm';
import { simplifyPrompt } from '@/lib/prompts';
import { doseLock } from '@/lib/medical';
import { route } from '@/lib/http';

export const maxDuration = 60;

// The patient tapped "did not understand": the same instruction again in simpler words.
// The simpler version goes through the same dose lock; if a number moved, the original wording is kept.
export const POST = route(async (req) => {
  const { source, translation, patientLang = 'te-IN' } = await req.json();
  if (!source?.trim() || !translation?.trim()) return Response.json({ error: 'Nothing to simplify' }, { status: 400 });
  const out = await json(simplifyPrompt({ source, translation, patientLang }));
  const lock = doseLock(source, out.translation);
  return Response.json(lock.ok ? { ...out, simpler: true } : { translation, back_translation: '', simpler: false });
});
