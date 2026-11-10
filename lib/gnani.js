// Thin client for Gnani's Vachana API: Prisma (STT), Timbre (TTS), and voice cloning.
import { KEYTERMS, LANGUAGES } from './medical.js';

// GNANI_BASE_URL is only for tests (scripts/e2e-mock.mjs points it at a local stand-in); production uses the default.
const BASE = process.env.GNANI_BASE_URL || 'https://api.vachana.ai';

function key() {
  const k = process.env.GNANI_API_KEY;
  if (!k) throw Object.assign(new Error('GNANI_API_KEY is not set'), { status: 503 });
  return k;
}

async function fail(res, what) {
  const body = await res.text().catch(() => '');
  return Object.assign(new Error(`${what} ${res.status}: ${body.slice(0, 300)}`), { status: res.status });
}

// Speech to text. `languages` narrows detection, e.g. ['en-IN', 'te-IN'] for a doctor + Telugu patient
// (v3 takes up to 4; detected_language_code then tells us who spoke).
// Tries Prisma v3.0 first; v2.5 is the fallback when v3 is busy, but it takes one language only.
export async function transcribe(audio, { languages = ['indic-auto'], previousText = '', topic = '' } = {}) {
  const models = languages.length === 1 ? ['prisma-v3.0', 'prisma-v2.5'] : ['prisma-v3.0'];
  let lastErr;
  for (const model of models) {
    const form = new FormData();
    form.append('audio_file', audio, 'turn.wav');
    form.append('model', model);
    form.append('language_code', languages.join(','));
    form.append('format', 'transcribe'); // spoken numbers come back as digits, which the dose lock needs
    if (model === 'prisma-v3.0') {
      form.append('keyterms', JSON.stringify(KEYTERMS.slice(0, 200)));
      if (topic) form.append('topic', topic.slice(0, 1600));
      if (previousText) form.append('previous_text', previousText.slice(-600));
    }
    const res = await fetch(`${BASE}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': key() }, body: form });
    if (res.ok) {
      const j = await res.json();
      if (j.success === false) throw new Error(`STT failed: ${JSON.stringify(j).slice(0, 300)}`);
      return { text: (j.transcript || '').trim(), lang: j.detected_language_code || languages[0], model };
    }
    lastErr = await fail(res, `STT ${model}`);
    if (res.status < 429) throw lastErr;
  }
  throw lastErr;
}

const AUDIO = { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'mp3', bitrate: '96k' };

// Text to speech. With a speaker embedding it speaks in the cloned voice, else a Timbre v3.0 stock voice
// (every v3 voice speaks all 10 languages; v2.5 voices are per-language and only used as the busy fallback).
export async function speak(text, lang, { embedding, voice = 'Shivani' } = {}) {
  const body = embedding
    ? { text, model: 'vachana-vc-v1', speaker_embedding: embedding, audio_config: AUDIO }
    : { text, model: 'timbre-v3.0', voice, language: lang, audio_config: AUDIO };
  let res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: 'POST',
    headers: { 'X-API-Key-ID': key(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && !embedding && res.status >= 429) {
    // v3 busy: per-language v2.5 voice
    res = await fetch(`${BASE}/api/v1/tts/inference`, {
      method: 'POST',
      headers: { 'X-API-Key-ID': key(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: 'timbre-v2.5', voice: LANGUAGES[lang]?.voice || 'Kaveri' }),
    });
  }
  if (!res.ok) throw await fail(res, 'TTS');
  return Buffer.from(await res.arrayBuffer());
}

// 5-30 s of the doctor's consented speech -> reusable speaker embedding.
export async function cloneVoice(audio) {
  const form = new FormData();
  form.append('audio_file', audio, 'doctor.wav');
  const res = await fetch(`${BASE}/api/v1/tts/voice-clone/embeddings`, {
    method: 'POST',
    headers: { 'X-API-Key-ID': key() },
    body: form,
  });
  if (!res.ok) throw await fail(res, 'Voice clone');
  const j = await res.json();
  const e = j?.data?.voice_clone_embedding;
  if (!e?.embedding) throw new Error('Voice clone returned no embedding');
  return { embedding: e.embedding, shape: e.shape || [1, 768], dtype: e.dtype || 'torch.bfloat16' };
}
