import { transcribe, speak } from '@/lib/gnani';
import { json } from '@/lib/llm';
import { askPrompt } from '@/lib/prompts';
import { groundAnswer } from '@/lib/slip';
import { phrases } from '@/lib/phrases';
import { route, parse } from '@/lib/http';

export const maxDuration = 60;

// "Ask the slip": a question at home, by voice or text, answered only from the slip the family is holding.
// The slip arrives in the request (it lives in the QR link), so nothing about the patient is stored here.
export const POST = route(async (req) => {
  const f = await req.formData();
  const lang = f.get('lang') || 'te-IN';
  const slip = parse(f.get('slip'), null);
  if (!slip?.medicines) return Response.json({ error: 'No slip' }, { status: 400 });
  let question = (f.get('question') || '').trim();
  const audio = f.get('audio');
  if (audio && typeof audio !== 'string') question = (await transcribe(audio, { languages: [lang] })).text;
  if (!question) return Response.json({ empty: true });
  const out = await json({ ...askPrompt({ question: question.slice(0, 600), slip, patientLang: lang }), maxTokens: 600 });
  const { found, answer } = groundAnswer(out, slip, phrases(lang).askDoctor);
  // The answer is still useful on screen if the voice is busy.
  const mp3 = await speak(answer, lang, { voice: 'Shivani' }).catch(() => null);
  return Response.json({ question, found, answer, audio: mp3 && `data:audio/mpeg;base64,${mp3.toString('base64')}` });
});
