import { json } from '@/lib/llm';
import { stripPrompt } from '@/lib/prompts';
import { matchStrip } from '@/lib/slip';
import { route, parse } from '@/lib/http';

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;

// "Show the strip": a photo of a medicine pack, checked against the slip. The model reads the print;
// lib/slip.js decides whether it is the prescribed drug and strength.
export const POST = route(async (req) => {
  const f = await req.formData();
  const photo = f.get('photo');
  const medicines = parse(f.get('medicines'), []);
  if (!photo || typeof photo === 'string' || !medicines.length) return Response.json({ error: 'Needs a photo and a slip' }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) return Response.json({ error: 'Send a JPEG, PNG or WebP photo' }, { status: 415 });
  if (photo.size > MAX_BYTES) return Response.json({ error: 'Photo is too large (4 MB at most)' }, { status: 413 });
  const base64 = Buffer.from(await photo.arrayBuffer()).toString('base64');
  const read = await json({ ...stripPrompt(), image: { mime: photo.type, base64 }, maxTokens: 300 });
  return Response.json(matchStrip(read, medicines));
});
