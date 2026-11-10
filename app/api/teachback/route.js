import { transcribe } from '@/lib/gnani';
import { json } from '@/lib/llm';
import { teachbackPrompt } from '@/lib/prompts';
import { route, parse } from '@/lib/http';
import { sttCode } from '@/lib/medical';

export const maxDuration = 60;

// Patient retells the plan in their own language; each plan item comes back understood / partial / missed / wrong.
export const POST = route(async (req) => {
  const f = await req.formData();
  const patientLang = f.get('patientLang') || 'te-IN';
  const instructions = parse(f.get('instructions'), []);
  const items = parse(f.get('items'), []); // second round: only the items missed the first time
  if (!instructions.length) return Response.json({ error: 'The doctor has not given any instructions yet' }, { status: 400 });
  let retelling = (f.get('retelling') || '').trim();
  const audio = f.get('audio');
  if (audio && typeof audio !== 'string') retelling = (await transcribe(audio, { languages: [sttCode(patientLang)] })).text;
  if (!retelling) return Response.json({ empty: true });
  const out = await json(teachbackPrompt({ instructions, retelling, patientLang, items }));
  return Response.json({ retelling, ...out });
});
