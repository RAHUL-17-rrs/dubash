// End-to-end check of every API route against local stand-ins for Gnani (Prisma, Timbre) and the interpreter model.
// It proves the wiring, the schemas and every code-side safety decision; it does NOT prove what real models say.
//
//   1. node scripts/e2e-mock.mjs serve            (stand-in providers on :4010)
//   2. GNANI_API_KEY=mock GNANI_BASE_URL=http://localhost:4010 OPENAI_API_KEY=mock OPENAI_BASE_URL=http://localhost:4010 npx next dev -p 3123
//   3. BASE=http://localhost:3123 node scripts/e2e-mock.mjs
import http from 'node:http';
import assert from 'node:assert/strict';
import { DEMO } from '../lib/demo.js';
import { phrases } from '../lib/phrases.js';

const PORT = 4010;
const EMPTY = { ambiguities: [], confidence: 'high', confidence_reason: 'clear', red_flags: [], conflicts: [], medicines: [], facts: [], clarify: { question: '', options: [] } };

// What the stand-in "model" answers, chosen by the schema name each route asks for and by marker words in the input.
function model(name, user, hasImage) {
  const turn = user.split('interpret into')[1] || user;
  if (name === 'interpretation') {
    const doctor = /New doctor turn/.test(user);
    if (!doctor) return { ...EMPTY, translation: 'I am allergic to penicillin.', plain_source: 'x', back_translation: 'x', red_flags: ['Penicillin allergy'], facts: [{ kind: 'allergy', text: 'Penicillin' }] };
    if (/amoxicillin/i.test(turn))
      return { ...EMPTY, translation: 'Amoxicillin 500 mg, రోజుకు 3 సార్లు, 5 రోజులు.', plain_source: 'Take Amoxicillin 500 mg, 3 times a day, for 5 days.', back_translation: 'x', medicines: [{ name: 'Amoxicillin', dose: '500 mg', frequency: '3 times a day', timing: '', duration: '5 days' }], conflicts: /Patient facts[\s\S]*Penicillin/.test(user) ? [{ earlier_turn: 'last visit', patient_said: 'Penicillin allergy.', why: 'amoxicillin is a penicillin', clashes: true }] : [] };
    if (/hold the/i.test(turn))
      return { ...EMPTY, translation: 'Metformin ఆపండి.', plain_source: 'Stop Metformin.', back_translation: 'x', confidence: 'low', confidence_reason: '"hold" can mean stop or keep', clarify: { question: 'Stop it, or keep taking it?', options: ['Stop Metformin on days you are vomiting, then restart it.', 'Keep taking Metformin even if you are vomiting.'] } };
    if (/DRIFT/.test(turn)) return { ...EMPTY, translation: 'Dolo రోజుకు మూడు సార్లు.', plain_source: 'Take Dolo 650, 3 times a day.', back_translation: 'x' }; // loses 650 and 3, on the retry too
    if (/Dolo/.test(turn))
      return { ...EMPTY, translation: 'Dolo 650, 1 మాత్ర, రోజుకు 3 సార్లు, 5 రోజులు.', plain_source: 'Take Dolo 650, 1 tablet, 3 times a day, for 5 days.', back_translation: 'x', medicines: [{ name: 'Dolo 650', dose: '1 tablet', frequency: '3 times a day', timing: '', duration: '5 days' }] };
    return { ...EMPTY, translation: 'నమస్కారం.', plain_source: 'Good morning.', back_translation: 'Greetings.' };
  }
  if (name === 'simpler') return /WRONG/.test(user) ? { translation: 'Dolo 650, రోజుకు 2 సార్లు.', back_translation: 'x' } : { translation: 'Dolo 650. 1 మాత్ర. రోజుకు 3 సార్లు. 5 రోజులు.', back_translation: 'Dolo 650. 1 tablet. 3 times a day. 5 days.' };
  if (name === 'slip_answer') {
    if (/INVENT/.test(user)) return { found: true, answer: 'Amlodipine 10 mg రాత్రి 1 మాత్ర.' }; // 10 is not on the slip
    if (/Amlodipine\?/.test(user)) return { found: true, answer: 'Amlodipine 5 mg రోజూ రాత్రి 1 మాత్ర.' };
    return { found: false, answer: '' };
  }
  if (name === 'strip') return hasImage ? { readable: true, brand: 'Glycomet', generic: 'Metformin Hydrochloride', strength: '850 mg' } : { readable: false, brand: '', generic: '', strength: '' };
  if (name === 'teachback') {
    const items = [...user.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
    return { items: (items.length ? items : ['Dolo 650, 3 times a day']).map((item) => ({ item, status: 'understood', patient_said: 'said it', re_explain: '', ask: '' })), summary_for_doctor: 'Nothing to re-explain.' };
  }
  throw new Error(`stand-in has no answer for schema ${name}`);
}

function serve() {
  http
    .createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const json = (o) => (res.writeHead(200, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(o)));
        if (req.url === '/stt/v3') {
          const auto = body.includes('indic-auto');
          return json({ success: true, transcript: 'నాకు పెన్సిలిన్ పడదు', detected_language_code: auto || body.includes('te-IN') ? 'te-IN' : 'en-IN' });
        }
        if (req.url === '/api/v1/tts/inference') return res.writeHead(200, { 'Content-Type': 'audio/mpeg' }), res.end(Buffer.from('ID3mock-audio'));
        if (req.url === '/v1/chat/completions') {
          const q = JSON.parse(body.toString());
          const content = q.messages[1].content;
          const user = typeof content === 'string' ? content : content.find((p) => p.type === 'text').text;
          const hasImage = Array.isArray(content) && content.some((p) => p.type === 'image_url' && p.image_url.url.startsWith('data:image/png;base64,'));
          assert.equal(q.response_format.json_schema.strict, true);
          return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(model(q.response_format.json_schema.name, user, hasImage)) } }] });
        }
        res.writeHead(404).end();
      });
    })
    .listen(PORT, () => console.log(`stand-in providers on :${PORT}`));
}

async function run() {
  const BASE = process.env.BASE || 'http://localhost:3123';
  const wav = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
  const form = (o) => Object.entries(o).reduce((f, [k, v]) => (v instanceof Blob ? f.append(k, v, k) : f.append(k, typeof v === 'string' ? v : JSON.stringify(v)), f), new FormData());
  const post = async (path, body) => {
    const r = await fetch(BASE + path, body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, j: await r.json() };
  };
  const turn = (o) => post('/api/turn', form({ patientLang: 'te-IN', history: [], ...o }));
  const slip = DEMO.note.take_home;
  let r;

  // --- /api/turn -----------------------------------------------------------------------------------------------
  r = await turn({ text: 'Good morning.', side: 'doctor' });
  assert.equal(r.status, 200);
  assert.ok(!r.j.hold && !r.j.readback && r.j.audio?.startsWith('data:audio/mpeg'), 'a plain turn is spoken at once');

  r = await turn({ text: 'Take Dolo 650, 1 tablet 3 times a day for 5 days', side: 'doctor' });
  assert.ok(r.j.readback === true && r.j.hold === false && r.j.audio === null && r.j.lock.ok, 'a prescription waits for read-back, unspoken');

  r = await turn({ text: 'DRIFT Take Dolo 650, 3 times a day', side: 'doctor' });
  assert.ok(r.j.hold === true && r.j.readback === false && r.j.audio === null, 'numbers lost twice -> held, never spoken');
  assert.deepEqual(r.j.lock.missing, ['650', '3']);

  r = await turn({ text: 'Hold the metformin if you are vomiting', side: 'doctor' });
  assert.ok(r.j.hold && r.j.interp.clarify.options.length === 2 && r.j.audio === null, 'unsure -> held with two readings to tap');

  r = await turn({ text: 'Take amoxicillin 500 mg, 3 times a day for 5 days', side: 'doctor', facts: ['Allergy: Penicillin (last visit)'] });
  assert.ok(r.j.hold && r.j.interp.conflicts.length === 1 && /last visit/.test(r.j.interp.conflicts[0]), 'a pinned fact from the last visit stops the line');
  r = await turn({ text: 'Take amoxicillin 500 mg, 3 times a day for 5 days', side: 'doctor' });
  assert.ok(!r.j.hold && r.j.readback, 'same prescription with no such fact goes to read-back instead');

  r = await turn({ audio: wav, side: 'family' });
  assert.equal(r.j.speaker, 'family');
  assert.equal(r.j.interp.facts[0].kind, 'allergy');
  r = await turn({ audio: wav, side: 'auto' });
  assert.equal(r.j.speaker, 'patient', 'hands-free: patient language heard -> patient');

  // --- /api/detect ---------------------------------------------------------------------------------------------
  r = await post('/api/detect', form({ audio: wav }));
  assert.deepEqual([r.j.lang, r.j.name], ['te-IN', 'Telugu']);

  // --- /api/simplify -------------------------------------------------------------------------------------------
  const source = 'Take Dolo 650, 1 tablet, 3 times a day, for 5 days.';
  r = await post('/api/simplify', { source, translation: 'Dolo 650, 1 మాత్ర, రోజుకు 3 సార్లు, 5 రోజులు.', patientLang: 'te-IN' });
  assert.ok(r.j.simpler === true && /Dolo 650/.test(r.j.translation));
  r = await post('/api/simplify', { source: `WRONG ${source}`, translation: 'ORIGINAL', patientLang: 'te-IN' });
  assert.ok(r.j.simpler === false && r.j.translation === 'ORIGINAL', 'a simpler version that moved a number is thrown away');

  // --- /api/teachback, later round -----------------------------------------------------------------------------
  r = await post('/api/teachback', form({ instructions: ['a'], retelling: 'x', patientLang: 'te-IN', items: ['Kidney test and ECG today', 'Come back after 2 weeks'] }));
  assert.deepEqual(r.j.items.map((i) => i.item), ['Kidney test and ECG today', 'Come back after 2 weeks'], 'round 2 checks exactly the missed items, in order');

  // --- /api/ask ------------------------------------------------------------------------------------------------
  const fallback = phrases('te-IN').askDoctor;
  r = await post('/api/ask', form({ slip, lang: 'te-IN', question: 'When do I take Amlodipine?' }));
  assert.ok(r.j.found === true && /Amlodipine 5 mg/.test(r.j.answer) && r.j.audio?.startsWith('data:audio/mpeg'));
  r = await post('/api/ask', form({ slip, lang: 'te-IN', question: 'INVENT a dose' }));
  assert.ok(r.j.found === false && r.j.answer === fallback, 'an answer with a number that is not on the slip is replaced');
  r = await post('/api/ask', form({ slip, lang: 'te-IN', question: 'Can I take it with milk?' }));
  assert.ok(r.j.found === false && r.j.answer === fallback);
  r = await post('/api/ask', form({ slip, lang: 'te-IN', audio: wav }));
  assert.equal(r.j.question, 'నాకు పెన్సిలిన్ పడదు', 'a spoken question is transcribed first');
  assert.equal((await post('/api/ask', form({ lang: 'te-IN', question: 'x' }))).status, 400);

  // --- /api/strip ----------------------------------------------------------------------------------------------
  r = await post('/api/strip', form({ photo: png, medicines: slip.medicines }));
  assert.equal(r.j.status, 'wrong_strength', 'Metformin 850 on the strip against 500 on the slip');
  assert.equal(r.j.med.name, 'Metformin 500 mg');
  r = await post('/api/strip', form({ photo: png, medicines: [{ name: 'Amlodipine 5 mg' }] }));
  assert.equal(r.j.status, 'not_on_slip');
  assert.equal((await post('/api/strip', form({ photo: new Blob(['x'], { type: 'text/plain' }), medicines: slip.medicines }))).status, 415);

  console.log('e2e (stand-in providers): turn, read-back, holds, clarify, pinned facts, family, detect, simplify, teach-back round 2, ask, strip: all pass');
}

process.argv[2] === 'serve' ? serve() : run().catch((e) => (console.error(e), process.exit(1)));
