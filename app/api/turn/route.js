import { transcribe, speak } from '@/lib/gnani';
import { interpretTurn } from '@/lib/turn';
import { route, parse } from '@/lib/http';
import { sttCode, detectCode } from '@/lib/medical';

export const maxDuration = 60;

// One consult turn, one round trip: Prisma STT -> interpret + dose lock -> Timbre voice.
export const POST = route(async (req) => {
  const f = await req.formData();
  const patientLang = f.get('patientLang') || 'te-IN';
  const side = f.get('side') || 'auto';
  const history = parse(f.get('history'), []);
  const embedding = parse(f.get('embedding'), null);
  const ms = { stt: 0, interpret: 0, voice: 0 };

  let text = (f.get('text') || '').trim();
  let lang = side === 'doctor' ? 'en-IN' : patientLang;
  let sttModel = null;
  const audio = f.get('audio');
  if (audio && typeof audio !== 'string') {
    const t0 = Date.now();
    const languages = side === 'doctor' ? ['en-IN'] : side === 'patient' ? [sttCode(patientLang)] : ['en-IN', detectCode(patientLang)];
    const r = await transcribe(audio, {
      languages,
      previousText: history.at(-1)?.text || '',
      topic: 'Outpatient consultation at an Indian clinic: symptoms, medicines, doses, tests and follow-up.',
    });
    ms.stt = Date.now() - t0;
    ({ text, lang } = r);
    sttModel = r.model;
  }
  if (!text) return Response.json({ empty: true, ms });

  // Speaker by language: whatever is not the patient's language is the doctor.
  const speaker = side !== 'auto' ? side : lang === detectCode(patientLang) ? 'patient' : 'doctor';
  // Hinglish is detected as hi-IN (Devanagari) but written in Roman script: once we know it was the patient,
  // hear the same clip again with the code that writes it the way they would.
  if (speaker === 'patient' && side === 'auto' && sttCode(patientLang) !== detectCode(patientLang) && audio && typeof audio !== 'string') {
    const t0 = Date.now();
    text = (await transcribe(audio, { languages: [sttCode(patientLang)], previousText: history.at(-1)?.text || '' })).text || text;
    ms.stt += Date.now() - t0;
  }
  if (speaker === 'patient') lang = patientLang;
  const { interp, lock, hold, ms: interpretMs } = await interpretTurn({ speaker, text, patientLang, history });
  ms.interpret = interpretMs;

  let audioOut = null;
  if (!hold && f.get('voice') !== 'off') {
    const t0 = Date.now();
    const mp3 =
      speaker === 'doctor'
        ? await speak(interp.translation, patientLang, { embedding, voice: f.get('doctorVoice') || 'Avinash' })
        : await speak(interp.translation, 'en-IN', { voice: 'Shivani' });
    ms.voice = Date.now() - t0;
    audioOut = `data:audio/mpeg;base64,${mp3.toString('base64')}`;
  }
  return Response.json({ speaker, lang, text, sttModel, interp, lock, hold, ms, audio: audioOut });
});
