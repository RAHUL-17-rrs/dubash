import { speak } from '@/lib/gnani';
import { route } from '@/lib/http';

export const maxDuration = 60;

// Used for "speak anyway" on a held turn, re-explanations after teach-back, and reading the take-home slip aloud.
export const POST = route(async (req) => {
  const { text, lang, embedding, voice } = await req.json();
  if (!text?.trim()) return Response.json({ error: 'Nothing to say' }, { status: 400 });
  const mp3 = await speak(text.slice(0, 2000), lang || 'en-IN', { embedding, voice });
  return new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg' } });
});
