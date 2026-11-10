// Generates the scripted demo's audio with Gnani Timbre, so the zero-key demo plays real voices.
// Usage: GNANI_API_KEY=... node scripts/bake-demo.mjs   (then redeploy)
import { writeFileSync } from 'node:fs';
import { speak } from '../lib/gnani.js';
import { DEMO } from '../lib/demo.js';

const lang = DEMO.patientLang;
const jobs = DEMO.turns.map((t, i) => [
  `t${i + 1}`,
  () => (t.speaker === 'doctor' ? speak(t.interp.translation, lang, { voice: 'Avinash' }) : speak(t.interp.translation, 'en-IN', { voice: 'Shivani' })),
]);
const gaps = DEMO.teachback.items.map((i) => i.re_explain).filter(Boolean).join(' ');
const h = DEMO.note.take_home;
const slip = [h.greeting, ...h.medicines.map((m) => `${m.name}. ${m.how}`), ...h.tests, ...h.come_back_if, h.next_visit].join(' ');
jobs.push(['teach', () => speak(gaps, lang, { voice: 'Avinash' })], ['slip', () => speak(slip, lang, { voice: 'Avinash' })]);

const files = [];
for (const [name, run] of jobs) {
  // ponytail: sequential on purpose; accounts may allow one active request at a time (429 otherwise)
  const mp3 = await run().catch((e) => (console.error(name, e.message), null));
  if (!mp3) continue;
  writeFileSync(`public/demo/${name}.mp3`, mp3);
  files.push(name);
  console.log(name, `${(mp3.length / 1024).toFixed(0)} KB`);
}
writeFileSync('public/demo/baked.json', JSON.stringify({ files }, null, 2) + '\n');
