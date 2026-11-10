import { cloneVoice } from '@/lib/gnani';
import { route } from '@/lib/http';

export const maxDuration = 60;

// The doctor's consented 5-30 s sample becomes a speaker embedding. It is returned to the browser and
// kept there; nothing is stored server-side.
export const POST = route(async (req) => {
  const f = await req.formData();
  if (f.get('consent') !== 'yes') return Response.json({ error: 'Voice cloning needs the doctor’s consent' }, { status: 400 });
  const audio = f.get('audio');
  if (!audio || typeof audio === 'string') return Response.json({ error: 'No audio' }, { status: 400 });
  return Response.json({ embedding: await cloneVoice(audio) });
});
