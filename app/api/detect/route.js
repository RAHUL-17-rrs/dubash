import { transcribe } from '@/lib/gnani';
import { LANGUAGES } from '@/lib/medical';
import { route } from '@/lib/http';

export const maxDuration = 60;

// "Speak to start": the patient says anything, Prisma says which language it was.
export const POST = route(async (req) => {
  const audio = (await req.formData()).get('audio');
  if (!audio || typeof audio === 'string') return Response.json({ error: 'No audio' }, { status: 400 });
  const { text, lang } = await transcribe(audio, { languages: ['indic-auto'] });
  const known = Boolean(LANGUAGES[lang]) && lang !== 'en-IN';
  return Response.json({ text, lang: known ? lang : null, name: LANGUAGES[lang]?.name || null });
});
