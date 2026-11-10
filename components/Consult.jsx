'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMic } from './useMic';
import { LANGUAGES } from '@/lib/medical';
import { DEMO } from '@/lib/demo';
import { verifyWrap } from '@/lib/verify';
import baked from '@/public/demo/baked.json';
import QRCode from 'qrcode';
import Slip from './Slip';
import { slipText, encodeSlip, decodeSlip } from '@/lib/slip';
import { QUICK, phrases } from '@/lib/phrases';

const CLONE_SCRIPT =
  'I am a doctor at this clinic. Dubash will carry my words to my patients in their own language, in my voice. I agree to my voice being used only for my own consultations.';

const STEPS = { listen: 'Hearing', interpret: 'Interpreting', voice: 'Voicing' };

// A turn counts once it reached the other person: done, not discarded, and not still held for the doctor.
// Held turns stay out of the note, the slip and teach-back until the doctor speaks them anyway.
const released = (t) => t.status === 'done' && !t.discarded && !t.hold;

const WHO = { doctor: 'Doctor', patient: 'Patient', family: 'Family' };
const FACT = { allergy: 'Allergy', current_medicine: 'Takes', condition: 'Has', pregnancy: 'Pregnancy' };
const NO_INTERP = { ambiguities: [], confidence: 'high', confidence_reason: '', red_flags: [], conflicts: [], medicines: [], facts: [], clarify: { question: '', options: [] } };

// What the doctor must not lose: allergies, current medicines, conditions, pregnancy. Pinned from what the patient
// (or family) said in this consult, plus anything carried over on the slip from the last visit.
function patientFacts(turns, prior) {
  const out = new Map();
  for (const text of prior?.facts || []) out.set(text.toLowerCase(), { text, kind: /^allergy/i.test(text) ? 'allergy' : 'prior', from: 'last visit' });
  for (const t of turns) {
    if (t.status !== 'done' || t.discarded || t.speaker === 'doctor') continue;
    for (const f of t.interp?.facts || []) {
      const text = `${FACT[f.kind] || 'Note'}: ${f.text}`;
      out.set(text.toLowerCase(), { text, kind: f.kind, from: t.id });
    }
  }
  return [...out.values()];
}

// A later teach-back round only re-checks the items that were missed; everything else keeps its result.
function mergeTeach(prev, j) {
  if (!prev?.pending) return { status: 'done', round: 1, ...j };
  const fresh = new Map(prev.pending.map((item, n) => [item, j.items[n]]));
  return {
    ...prev,
    status: 'done',
    pending: null,
    round: prev.round + 1,
    retelling: j.retelling,
    summary_for_doctor: j.summary_for_doctor,
    items: prev.items.map((i) => (fresh.get(i.item) ? { ...fresh.get(i.item), item: i.item } : i)),
  };
}

export default function Consult({ demo }) {
  const [phase, setPhase] = useState(demo ? 'live' : 'setup');
  const [lang, setLang] = useState(demo ? DEMO.patientLang : 'te-IN');
  const [voice, setVoice] = useState({ kind: 'stock', name: 'Avinash', embedding: null });
  const [turns, setTurns] = useState([]);
  const [teach, setTeach] = useState(null); // {status:'listening'|'checking'|'done', ...result}
  const [wrap, setWrap] = useState(null);
  const [focus, setFocus] = useState(null); // text shown big on the patient half after a re-explanation
  const [status, setStatus] = useState(null);
  const [table, setTable] = useState(true);
  const [error, setError] = useState('');
  const [demoStep, setDemoStep] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [typed, setTyped] = useState('');
  const [prior, setPrior] = useState(null); // carried over from the last visit's slip: { facts: [] }
  const [family, setFamily] = useState(false); // a family member is speaking for the patient
  const [busy, setBusy] = useState(false);
  const teachRef = useRef(teach);
  teachRef.current = teach;
  const seq = useRef(0);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const target = useRef('turn');
  const listRef = useRef(null);
  const player = useRef(null);
  const queue = useRef([]);

  const mic = useMic((wav, side) => {
    if (target.current === 'clone') return clone(wav);
    if (target.current === 'teach') return teachback(wav);
    if (target.current === 'detect') return detect(wav);
    return sendTurn({ wav, side });
  });

  useEffect(() => {
    if (!demo) fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => setStatus({ gnani: false, llm: null }));
    setTable(window.matchMedia('(pointer: coarse)').matches);
  }, [demo]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, teach]);

  // ---------- audio out (mic is paused while Dubash speaks) ----------
  function play(src, rate = 1) {
    if (!src) return;
    queue.current.push({ src, rate });
    if (!player.current) next();
  }
  function next() {
    const { src, rate } = queue.current.shift() || {};
    if (!src) {
      player.current = null;
      mic.pause(false);
      return;
    }
    mic.pause(true);
    const a = new Audio(src);
    a.playbackRate = rate; // slower for "did not understand"; pitch is preserved by the browser
    player.current = a;
    a.onended = a.onerror = next;
    a.play().catch(next);
  }
  // Tapping a mic while Dubash is still talking cuts it off, so the next speaker never waits or gets dropped.
  function stopAudio() {
    queue.current = [];
    player.current?.pause();
    player.current = null;
    mic.pause(false);
  }
  function listen(side) {
    stopAudio();
    setError('');
    return mic.start(side);
  }

  async function say(text, toPatient, rate = 1) {
    const r = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toPatient ? { text, lang, embedding: voice.embedding, voice: voice.name } : { text, lang: 'en-IN', voice: 'Shivani' }
      ),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not speak');
    const url = URL.createObjectURL(await r.blob());
    play(url, rate);
    return url;
  }

  // ---------- live turns ----------
  const patch = (id, p) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof p === 'function' ? p(t) : p) } : t)));

  async function sendTurn({ wav, text, side }) {
    const id = `t${++seq.current}`;
    setTurns((ts) => [...ts, { id, speaker: side === 'auto' ? null : side, text: text || '', status: 'pending', step: wav ? 'listen' : 'interpret' }]);
    setFocus(null);
    const history = turnsRef.current
      .filter((t) => t.status === 'done' && !t.discarded)
      .slice(-8)
      .map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, translation: t.hold ? '(held: not said to the other person)' : t.interp.translation }));
    const fd = new FormData();
    if (wav) fd.append('audio', wav, 'turn.wav');
    if (text) fd.append('text', text);
    fd.append('side', side);
    fd.append('patientLang', lang);
    fd.append('history', JSON.stringify(history));
    fd.append('facts', JSON.stringify(patientFacts(turnsRef.current, prior).map((f) => (f.from === 'last visit' ? `${f.text} (last visit)` : f.text))));
    if (voice.embedding) fd.append('embedding', JSON.stringify(voice.embedding));
    fd.append('doctorVoice', voice.name);
    try {
      const r = await fetch('/api/turn', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Turn failed (${r.status})`);
      if (j.empty) {
        setTurns((ts) => ts.filter((t) => t.id !== id));
        return setError(side === 'patient' ? 'Nothing was heard from the patient. Hold the phone closer and tap their mic again.' : 'Nothing was heard. Tap the mic, speak, then pause: it sends by itself.');
      }
      // A prescription waits for the doctor's read-back, exactly like a held turn: unspoken until confirmed.
      patch(id, { ...j, hold: j.hold || j.readback, status: 'done' });
      play(j.audio);
    } catch (e) {
      patch(id, { status: 'error', error: e.message, retry: { wav, text, side } });
    }
  }

  // A failed turn (network, provider busy) keeps its audio, so the doctor does not have to say it again.
  function retryTurn(t) {
    setTurns((ts) => ts.filter((x) => x.id !== t.id));
    sendTurn(t.retry);
  }

  // Patients ask "say that again" all the time: replay the same audio, no new translation, same words.
  async function repeatLast() {
    const t = [...turnsRef.current].reverse().find((x) => x.status === 'done' && x.speaker === 'doctor' && !x.hold && !x.discarded);
    if (!t) return;
    if (t.audio) return play(t.audio);
    if (demo) return play(await demoAudio(t.id));
    try {
      const r = await say(t.interp.translation, true);
      patch(t.id, { audio: r });
    } catch (e) {
      setError(e.message);
    }
  }

  async function speakAnyway(t) {
    patch(t.id, { hold: false, ...(t.readback ? { confirmed: true } : { overridden: true }) });
    if (demo) return play(await demoAudio(t.id));
    try {
      const url = await say(t.interp.translation, t.speaker === 'doctor');
      patch(t.id, { audio: url });
    } catch (e) {
      setError(e.message);
    }
  }

  // A held turn that came with a question: the doctor taps the meaning they intended and that goes out instead.
  function clarify(t, option) {
    patch(t.id, { discarded: true, hold: false });
    sendTurn({ text: option, side: 'doctor' });
  }

  // Quick phrases: fixed text on both sides, so there is no model call and nothing to hold.
  async function quick(q) {
    const id = `t${++seq.current}`;
    const translation = phrases(lang).quick[q.id];
    setFocus(null);
    setTurns((ts) => [
      ...ts,
      { id, speaker: 'doctor', text: q.en, status: 'done', fixed: true, hold: false, ms: {}, lock: { ok: true, missing: [], extra: [], checked: [], caught: null }, interp: { ...NO_INTERP, translation, plain_source: q.en, back_translation: q.en } },
    ]);
    try {
      const url = await say(translation, true);
      patch(id, { audio: url });
    } catch (e) {
      setError(e.message);
    }
  }

  // The patient tapped "did not understand": the last thing they heard again, in simpler words and slower.
  async function simpler() {
    const t = [...turnsRef.current].reverse().find((x) => released(x) && x.speaker === 'doctor');
    if (!t) return;
    stopAudio();
    if (demo) {
      setFocus(t.interp.translation);
      return play(await demoAudio(t.id), 0.8);
    }
    try {
      const r = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: t.interp.plain_source || t.text, translation: t.interp.translation, patientLang: lang }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setFocus(j.translation);
      patch(t.id, { again: { text: j.translation, back: j.back_translation, simpler: j.simpler } });
      await say(j.translation, true, 0.85);
    } catch (e) {
      // No simpler wording available: the same words again, slower, is still better than silence.
      setFocus(t.interp.translation);
      if (t.audio) play(t.audio, 0.8);
      else setError(e.message);
    }
  }

  // ---------- speak to start: the patient says anything, Prisma picks the language ----------
  const [detectState, setDetectState] = useState('');
  async function detect(wav) {
    target.current = 'turn';
    setDetectState('Listening for the language…');
    const fd = new FormData();
    fd.append('audio', wav, 'hello.wav');
    try {
      const r = await fetch('/api/detect', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (!j.lang) return setDetectState(j.name ? `Heard ${j.name}, which Dubash does not interpret yet. Pick a language below.` : 'Could not tell the language. Pick one below.');
      setLang(j.lang);
      setDetectState(`Heard ${j.name}: “${j.text}”`);
    } catch (e) {
      setDetectState(`Could not detect: ${e.message}`);
    }
  }

  // ---------- returning patient: last visit's slip (QR link) preloads medicines and allergies ----------
  async function loadSlip(link) {
    const code = String(link).split('#')[1] || String(link).trim();
    try {
      const p = await decodeSlip(code);
      setPrior({ facts: [...(p.f || []), ...p.h.medicines.map((m) => `Prescribed: ${m.name}`)], count: p.h.medicines.length });
      if (LANGUAGES[p.l] && p.l !== 'en-IN') setLang(p.l);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- voice clone ----------
  const [cloneState, setCloneState] = useState({ consent: false, status: '' });
  async function clone(wav) {
    target.current = 'turn';
    setCloneState((c) => ({ ...c, status: 'Making your voice…' }));
    const fd = new FormData();
    fd.append('audio', wav, 'doctor.wav');
    fd.append('consent', 'yes');
    try {
      const r = await fetch('/api/clone', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setVoice({ kind: 'clone', name: 'Your voice', embedding: j.embedding });
      setCloneState((c) => ({ ...c, status: 'Your voice is ready.' }));
    } catch (e) {
      setCloneState((c) => ({ ...c, status: `Could not clone: ${e.message}` }));
    }
  }

  // ---------- teach-back ----------
  const instructions = () =>
    turnsRef.current.filter((t) => released(t) && t.speaker === 'doctor').map((t) => t.interp.plain_source || t.text);

  // `again` is the list of items to re-check in a later round; without it this is the first, full retelling.
  function startTeach(again) {
    if (!again) setFocus(null);
    const pending = again?.map((i) => i.item);
    if (demo) return runDemoTeach(pending);
    target.current = 'teach';
    setTeach((p) => (pending ? { ...p, status: 'listening', pending } : { status: 'listening' }));
  }

  // One missed item at a time: Dubash asks the patient a short question about it, then listens for the answer.
  async function askItem(i) {
    setFocus(i.ask);
    startTeach([i]);
    if (demo) return;
    try {
      await say(i.ask, true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function teachback(wav) {
    target.current = 'turn';
    const prev = teachRef.current;
    setTeach((p) => ({ ...p, status: 'checking' }));
    const fd = new FormData();
    fd.append('audio', wav, 'retelling.wav');
    fd.append('patientLang', lang);
    fd.append('instructions', JSON.stringify(instructions()));
    if (prev?.pending) fd.append('items', JSON.stringify(prev.pending));
    try {
      const r = await fetch('/api/teachback', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.empty) return setTeach((p) => ({ ...p, status: 'listening' })), (target.current = 'teach');
      setFocus(null);
      setTeach(mergeTeach(prev, j));
    } catch (e) {
      // A failed later round keeps the first round's results on screen.
      if (prev?.items) setTeach({ ...prev, status: 'done', pending: null }), setError(e.message);
      else setTeach({ status: 'error', error: e.message });
    }
  }

  async function reExplain(items) {
    const text = items.map((i) => i.re_explain).filter(Boolean).join(' ');
    if (!text) return;
    setFocus(text);
    if (demo) return play(await demoAudio('teach'));
    try {
      await say(text, true);
    } catch (e) {
      setError(e.message);
    }
  }

  // ---------- wrap-up ----------
  async function wrapUp() {
    mic.stop();
    await mic.setHandsFree(false);
    if (demo) return setWrap({ status: 'done', ...verifyWrap(DEMO.note, DEMO.turns.map((t, i) => ({ id: `t${i + 1}`, text: t.text, plain: t.interp?.plain_source }))) });
    setWrap({ status: 'writing' });
    const done = turnsRef.current.filter(released);
    const leftOut = turnsRef.current.filter((t) => t.status === 'done' && !t.discarded && t.hold).map((t) => t.id);
    if (!done.length) return setWrap({ status: 'error', error: 'Nothing has been said to the patient yet.' });
    try {
      const r = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientLang: lang,
          teachback: teach?.items
            ? { items: teach.items, summary: teach.summary_for_doctor, rounds: teach.round, understood: `${teach.items.filter((i) => i.status === 'understood').length} of ${teach.items.length}` }
            : null,
          turns: done.map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, plain: t.interp.plain_source, translation: t.interp.translation })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setWrap({ status: 'done', ...j, leftOut });
    } catch (e) {
      setWrap({ status: 'error', error: e.message });
    }
  }

  async function readSlip() {
    const text = slipText(wrap.take_home);
    if (demo) return play(await demoAudio('slip'));
    try {
      await say(text, true);
    } catch (e) {
      setError(e.message);
    }
  }

  // ---------- demo: the scripted consult through the same screen ----------
  // scripts/bake-demo.mjs writes the demo audio once a Gnani key exists, and lists it in baked.json.
  const demoAudio = async (name) => (baked.files.includes(name) ? `/demo/${name}.mp3` : null);

  async function demoTurn(i) {
    const s = DEMO.turns[i];
    const id = `t${i + 1}`;
    setFocus(null);
    setTurns((ts) => [...ts, { id, speaker: s.speaker, text: '', status: 'pending', step: 'listen' }]);
    await wait(900);
    patch(id, { text: s.text, step: 'interpret' });
    await wait(s.caught ? 1500 : 1000);
    const checked = (s.speaker === 'doctor' ? s.interp.plain_source : s.text).match(/\d+(?:[.\/-]\d+)*/g) || [];
    patch(id, {
      ...s,
      id,
      lang: s.speaker === 'doctor' ? 'en-IN' : DEMO.patientLang,
      status: 'done',
      hold: Boolean(s.hold),
      lock: { ok: true, missing: [], extra: [], checked, caught: s.caught || null },
    });
    if (s.discards) patch(s.discards, { discarded: true, hold: false });
    // Prescriptions wait for the doctor's read-back; in the script Dr. Arjun confirms after a moment.
    if (s.speaker === 'doctor' && !s.hold && s.interp.medicines.some((m) => m.dose || m.frequency)) {
      patch(id, { hold: true, readback: true });
      await wait(1900);
      patch(id, { hold: false, confirmed: true });
    }
    if (!s.hold) play(await demoAudio(id));
  }

  async function runDemoTeach(pending) {
    const prev = teachRef.current;
    setTeach((p) => (pending ? { ...p, status: 'listening', pending } : { status: 'listening' }));
    await wait(1600);
    setTeach((p) => ({ ...p, status: 'checking', retelling: pending ? DEMO.teachback.retelling2 : DEMO.teachback.retelling }));
    await wait(1400);
    setFocus(null);
    if (!pending) return setTeach({ status: 'done', round: 1, ...DEMO.teachback });
    // Second round in the script: Lakshmi gets the re-explained items right.
    const items = pending.map((item) => ({ item, status: 'understood', patient_said: 'Said correctly this time', re_explain: '', ask: '' }));
    setTeach(mergeTeach({ ...prev, pending }, { retelling: DEMO.teachback.retelling2, items, summary_for_doctor: 'Every instruction understood.' }));
  }

  const demoSteps = DEMO.turns.length + 2;
  async function demoNext() {
    const i = demoStep;
    setDemoStep(i + 1);
    setBusy(true);
    try {
      if (i < DEMO.turns.length) await demoTurn(i);
      else if (i === DEMO.turns.length) await runDemoTeach();
      else await wrapUp();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!demo || !autoplay || demoStep >= demoSteps) return;
    if (busy) return;
    const t = setTimeout(demoNext, demoStep === 0 ? 300 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, autoplay, demoStep, busy]);

  // ---------- render ----------
  if (phase === 'setup')
    return (
      <Setup
        {...{ lang, setLang, voice, setVoice, status, mic, cloneState, setCloneState, detectState, prior, loadSlip }}
        onDetect={() => {
          target.current = 'detect';
          setDetectState('');
          mic.start('patient');
        }}
        onForget={() => setPrior(null)}
        onRecordClone={() => {
          target.current = 'clone';
          mic.start('doctor');
        }}
        onStopClone={() => mic.stop()}
        onStart={() => setPhase('live')}
      />
    );

  const done = turns.filter((t) => t.status === 'done' && !t.discarded);
  const said = turns.filter(released);
  const meds = medicinesSoFar(said);
  const last = turns.at(-1);
  // The patient half keeps the last thing the patient actually heard; a held or failed turn never blanks it.
  const shown = [...turns].reverse().find((t) => t.status === 'pending' || released(t));
  const checking = last?.status === 'done' && last.hold && !last.discarded;
  const flags = [...new Set(done.flatMap((t) => t.interp.red_flags))];
  const L = LANGUAGES[lang];
  const P = phrases(lang);
  const micOnPatient = mic.side === 'patient' || mic.side === 'family';
  const patientListening = teach?.status === 'listening' || micOnPatient;
  const facts = patientFacts(turns, prior);
  const heardDoctor = done.some((t) => t.speaker === 'doctor' && !t.hold);

  return (
    <div className={`consult ${table ? 'table' : ''}`}>
      {/* ---------- patient half (faces the patient: rotated on a phone lying flat) ---------- */}
      <section className="pane patient" aria-label="Patient side" lang={lang.slice(0, 2)}>
        <div className="pane-in">
          <div className="p-head">
            <span className="role patient">
              <PatientIcon />
              <span lang={lang.slice(0, 2)}>{L.patient}</span>
              <small>Patient · {L.name}</small>
            </span>
            {!demo && (
              <button className={`fam ${family ? 'on' : ''}`} onClick={() => setFamily((f) => !f)} aria-pressed={family} aria-label="A family member is speaking for the patient">
                <FamilyIcon />
                <span lang={lang.slice(0, 2)}>{P.family}</span>
              </button>
            )}
          </div>
          <PatientView turn={shown} focus={focus} checking={checking} />
          <div className="p-actions">
            {heardDoctor && (
              <button className="again" onClick={repeatLast} aria-label={`${L.again} (repeat what the doctor said)`}>
                <AgainIcon />
                <span>{L.again}</span>
              </button>
            )}
            {heardDoctor && (
              <button className="again lost" onClick={simpler} aria-label={`${P.lost} (say it again in simpler words, slower)`}>
                <LostIcon />
                <span>{P.lost}</span>
              </button>
            )}
          <button
            className={`mic big ${patientListening ? 'on' : ''}`}
            style={{ '--lvl': micOnPatient ? mic.level : 0 }}
            onClick={() => (micOnPatient ? mic.stop() : demo ? !autoplay && !busy && demoNext() : listen(family ? 'family' : 'patient'))}
            aria-pressed={patientListening}
            aria-label={`${L.speak} (${family ? 'family' : 'patient'} microphone)`}
          >
            {micOnPatient ? <StopIcon /> : <MicIcon />}
            <span lang={lang.slice(0, 2)}>{L.speak}</span>
            {micOnPatient && <span className={`heard-dot ${mic.heard ? 'on' : ''}`} aria-hidden />}
          </button>
          </div>
        </div>
      </section>

      {/* ---------- doctor half ---------- */}
      <section className="pane doctor" aria-label="Doctor side">
        <header className="d-bar">
          <Link href="/" className="mark small">
            Dubash
          </Link>
          <span className="role doctor">
            <DoctorIcon />
            Doctor <small>English</small>
          </span>
          <span className="pill quiet" title="The voice the patient hears">Patient hears: {voice.kind === 'clone' ? 'your voice' : voice.name}</span>
          <div className="d-actions">
            {!demo && (
              <label className="switch">
                <input type="checkbox" checked={mic.handsFree} onChange={(e) => mic.setHandsFree(e.target.checked)} />
                <span>Hands-free</span>
              </label>
            )}
            <label className="switch only-phone">
              <input type="checkbox" checked={table} onChange={(e) => setTable(e.target.checked)} />
              <span>Flip patient side</span>
            </label>
            <button className="btn small ghost" onClick={() => startTeach()} disabled={!said.some((t) => t.speaker === 'doctor') || (demo && demoStep < DEMO.turns.length)}>
              Teach-back
            </button>
            <button className="btn small" onClick={wrapUp} disabled={!said.length || (demo && demoStep <= DEMO.turns.length)}>
              Wrap up
            </button>
          </div>
        </header>

        {demo && (
          <div className="demo-bar">
            <span className="demo-who">
              Scripted demo with synthetic people: {DEMO.doctor} and {DEMO.patient}.
            </span>
            <span className="demo-ctl">
              <span className="count">
                {Math.min(demoStep, demoSteps)}/{demoSteps}
              </span>
              <button className="btn small ghost" onClick={() => setAutoplay((a) => !a)} disabled={demoStep >= demoSteps}>
                {autoplay ? 'Pause' : 'Play all'}
              </button>
              <button className="btn small" onClick={demoNext} disabled={autoplay || busy || demoStep >= demoSteps}>
                Next
              </button>
            </span>
          </div>
        )}
        {!demo && status && (!status.gnani || !status.llm) && (
          <div className="warn">
            Live mode needs {[!status.gnani && 'GNANI_API_KEY', !status.llm && 'OPENAI_API_KEY (or ANTHROPIC_API_KEY / EVON_BASE_URL)'].filter(Boolean).join(' and ')} on the server.{' '}
            <Link href="/consult?demo=1">Open the scripted demo</Link> instead.
          </div>
        )}
        {(error || mic.error) && (
          <div className="warn" role="alert">
            {error || mic.error} <button className="link" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        {flags.length > 0 && (
          <aside className="flags" aria-label="Red flags">
            <strong>Don’t miss</strong>
            <ul>
              {flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </aside>
        )}

        {facts.length > 0 && (
          <aside className="facts-pin" aria-label="Patient facts to keep in mind">
            <strong>Keep in mind</strong>
            <ul>
              {facts.map((f) => (
                <li key={f.text} className={f.kind}>
                  {f.text} <span className="cite">{f.from}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {meds.length > 0 && (
          <aside className="meds" aria-label="Medicines so far">
            <strong>Medicines so far</strong>
            <ul>
              {meds.map((m) => (
                <li key={m.name}>
                  <b>{m.name}</b> {[sameStrength(m.name, m.dose) ? '' : m.dose, m.frequency, m.timing, m.duration].filter(Boolean).join(', ')}{' '}
                  <span className="cite">{m.id}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <ol className="turns" ref={listRef} aria-live="polite">
          {turns.length === 0 && (
            <li className="empty">
              {demo ? (
                'Press Next or Play all to start the consult.'
              ) : mic.handsFree ? (
                'Listening. Just talk; Dubash works out who is speaking.'
              ) : (
                <ol className="howto">
                  <li>
                    <b className="doc">Doctor</b> taps the blue <b>Speak</b> button below and talks in English. Pause when done: it sends by itself.
                  </li>
                  <li>
                    <b className="pat">Patient</b> taps the green <b lang={lang.slice(0, 2)}>{L.speak}</b> button on their side and talks in {L.name}.
                  </li>
                  <li>Each hears the other in their own language. Anything Dubash is unsure of waits here for you.</li>
                </ol>
              )}
            </li>
          )}
          {turns.map((t) => (
            <Turn
              key={t.id}
              t={t}
              lang={lang}
              onSpeak={() => speakAnyway(t)}
              onDiscard={() => patch(t.id, { discarded: true, hold: false })}
              onRetry={() => retryTurn(t)}
              onClarify={(o) => clarify(t, o)}
            />
          ))}
          {teach && <TeachBack teach={teach} onReExplain={reExplain} onAgain={startTeach} onAsk={askItem} />}
        </ol>

        {!demo && (
          <div className="quick" role="group" aria-label="Quick phrases: fixed wording, spoken at once">
            {QUICK.map((q) => (
              <button key={q.id} type="button" onClick={() => quick(q)} title={P.quick[q.id]}>
                {q.en}
              </button>
            ))}
          </div>
        )}

        {!demo && (
          <form
            className="d-input"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) sendTurn({ text: typed.trim(), side: 'doctor' });
              setTyped('');
            }}
          >
            <button
              type="button"
              className={`mic wide ${mic.side === 'doctor' ? 'on' : ''}`}
              style={{ '--lvl': mic.side === 'doctor' ? mic.level : 0 }}
              onClick={() => (mic.side === 'doctor' ? mic.stop() : ((target.current = 'turn'), listen('doctor')))}
              aria-pressed={mic.side === 'doctor'}
              aria-label={mic.side === 'doctor' ? 'Stop and interpret' : 'Doctor microphone'}
            >
              {mic.side === 'doctor' ? <StopIcon /> : <MicIcon />}
              <span>{mic.side === 'doctor' ? (mic.heard ? 'Hearing you' : 'Listening') : 'Speak'}</span>
            </button>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={mic.side === 'doctor' ? 'Talk, then pause; it sends by itself (or tap Stop)' : mic.side === 'patient' ? 'Patient is speaking…' : 'Or type what you want to say'} aria-label="Type a doctor turn" />
            <button className="btn small" disabled={!typed.trim()}>
              Send
            </button>
          </form>
        )}
      </section>

      {wrap && <Wrap wrap={wrap} lang={lang} demo={demo} facts={facts} onClose={() => setWrap(null)} onRead={readSlip} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Setup({ lang, setLang, voice, setVoice, status, mic, cloneState, setCloneState, onRecordClone, onStopClone, onStart, detectState, onDetect, prior, loadSlip, onForget }) {
  const live = status?.gnani && status?.llm;
  const recording = mic.side === 'doctor';
  const detecting = mic.side === 'patient';
  const [link, setLink] = useState('');
  const [scan, setScan] = useState(false);
  const [slipErr, setSlipErr] = useState('');
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  async function load(value) {
    setScan(false);
    setSlipErr((await loadSlip(value)) ? '' : 'That is not a Dubash slip link.');
  }
  return (
    <main className="setup">
      <header className="top">
        <Link href="/" className="mark">
          Dubash
        </Link>
        <Link href="/consult?demo=1" className="btn small ghost">
          Play the scripted demo
        </Link>
      </header>
      <h1>New consult</h1>

      <fieldset className="field">
        <legend>Patient’s language</legend>
        <div className="langs">
          {Object.entries(LANGUAGES)
            .filter(([c]) => c !== 'en-IN')
            .map(([code, l]) => (
              <button key={code} type="button" className={`lang ${lang === code ? 'sel' : ''}`} onClick={() => setLang(code)} aria-pressed={lang === code}>
                <span lang={code.slice(0, 2)}>{l.native}</span>
                <small>{l.mixesEnglish ? 'Hindi + English' : l.name}</small>
              </button>
            ))}
        </div>
        <p className="hint">
          {LANGUAGES[lang]?.mixesEnglish
            ? 'Hinglish mixes in English, so Dubash cannot always tell the doctor from the patient by language: use the two mic buttons rather than hands-free. Patient text is in Roman script.'
            : 'Prisma listens for English and this language only, so it can tell who is speaking.'}
        </p>
        <div className="detect">
          <button type="button" className={`btn small ${detecting ? 'rec' : 'ghost'}`} disabled={!live} onClick={detecting ? () => mic.stop() : onDetect}>
            {detecting ? 'Stop' : 'Not sure? Let the patient speak'}
          </button>
          {detectState && (
            <span className="hint" role="status">
              {detectState}
            </span>
          )}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Returning patient</legend>
        {prior ? (
          <p className="prior" role="status">
            <span className="stamp ok">Loaded</span> Last visit’s slip: {prior.count} medicine{prior.count === 1 ? '' : 's'}
            {prior.facts.length > prior.count ? ` and ${prior.facts.length - prior.count} thing${prior.facts.length - prior.count === 1 ? '' : 's'} to keep in mind` : ''}. Dubash will remind you if
            today’s plan clashes with them.{' '}
            <button type="button" className="link" onClick={onForget}>
              Forget
            </button>
          </p>
        ) : (
          <>
            <form
              className="slip-in"
              onSubmit={(e) => {
                e.preventDefault();
                load(link);
              }}
            >
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste the link from their last slip’s QR code" aria-label="Link from the last slip" />
              <button className="btn small ghost" disabled={!link.trim()}>
                Load
              </button>
              {canScan && (
                <button type="button" className="btn small ghost" onClick={() => setScan((s) => !s)}>
                  {scan ? 'Cancel' : 'Scan QR'}
                </button>
              )}
            </form>
            {scan && <QrScan onCode={load} onFail={() => (setScan(false), setSlipErr('The camera is not available. Paste the link instead.'))} />}
            {slipErr && <p className="warn">{slipErr}</p>}
            <p className="hint">The slip carries its own data in the QR, so last visit’s medicines and allergies come back without any patient record being stored.</p>
          </>
        )}
      </fieldset>

      <fieldset className="field">
        <legend>The voice your patient hears</legend>
        <div className="voices">
          {[
            ['Avinash', 'Male stock voice'],
            ['Shivani', 'Female stock voice'],
          ].map(([name, label]) => (
            <button key={name} type="button" className={`lang ${voice.kind === 'stock' && voice.name === name ? 'sel' : ''}`} onClick={() => setVoice({ kind: 'stock', name, embedding: null })}>
              <span>{name}</span>
              <small>{label}</small>
            </button>
          ))}
          <div className={`clone ${voice.kind === 'clone' ? 'sel' : ''}`}>
            <span className="clone-t">Your own voice</span>
            <p>Read this aloud (about 10 seconds):</p>
            <blockquote>{CLONE_SCRIPT}</blockquote>
            <label className="consent">
              <input type="checkbox" checked={cloneState.consent} onChange={(e) => setCloneState((c) => ({ ...c, consent: e.target.checked }))} />
              <span>I consent to Dubash using a clone of my voice for my own consultations. The voice print stays in this browser tab.</span>
            </label>
            <button
              type="button"
              className={`btn small ${recording ? 'rec' : 'ghost'}`}
              disabled={!cloneState.consent || !live}
              onClick={recording ? onStopClone : onRecordClone}
            >
              {recording ? 'Stop and make my voice' : 'Record'}
            </button>
            {cloneState.status && <p className="hint">{cloneState.status}</p>}
          </div>
        </div>
      </fieldset>

      {status && !live && (
        <p className="warn">
          This deployment has no {[!status.gnani && 'Gnani key', !status.llm && 'interpreter model'].filter(Boolean).join(' or ')} yet, so live consults are off.{' '}
          <Link href="/consult?demo=1">The scripted demo</Link> runs the same screen.
        </p>
      )}
      <button className="btn" onClick={onStart} disabled={!live}>
        Start consult
      </button>
    </main>
  );
}

function PatientView({ turn, focus, checking }) {
  // While the doctor reviews a held turn, the patient sees a quiet "working" mark, never the unchecked words.
  const wait = checking && (
    <span className="dots small" aria-label="The doctor is checking">
      <i />
      <i />
      <i />
    </span>
  );
  if (focus)
    return (
      <div className="p-main" key={focus}>
        <p className="p-big">{focus}</p>
      </div>
    );
  if (!turn) return <div className="p-main">{wait}</div>;
  if (turn.status === 'pending')
    return (
      <div className="p-main">
        <span className="dots" aria-label="Working">
          <i />
          <i />
          <i />
        </span>
        {turn.speaker && turn.speaker !== 'doctor' && turn.text && <p className="p-own">{turn.text}</p>}
      </div>
    );
  if (turn.status !== 'done' || turn.discarded) return <div className="p-main" />;
  if (turn.speaker === 'doctor')
    return (
      <div className="p-main" key={turn.id}>
        <span className="p-from" aria-hidden>
          <DoctorIcon />
        </span>
        <p className="p-big">{turn.interp.translation}</p>
        {wait}
      </div>
    );
  return (
    <div className="p-main" key={turn.id}>
      <p className="p-own">{turn.text}</p>
      <span className="p-check" aria-hidden>
        ✓
      </span>
      {wait}
    </div>
  );
}

function Turn({ t, lang, onSpeak, onDiscard, onRetry, onClarify }) {
  const who = WHO[t.speaker] || 'Someone';
  if (t.status === 'pending')
    return (
      <li className={`turn ${t.speaker || ''} pending`}>
        <div className="who">{who}</div>
        {t.text ? <p className="said">{t.text}</p> : null}
        <p className="step">{STEPS[t.step]}…</p>
      </li>
    );
  if (t.status === 'error')
    return (
      <li className="turn error">
        <div className="who">Not interpreted</div>
        <p className="said">{t.error}</p>
        {t.retry && (
          <button className="btn small ghost" onClick={onRetry}>
            Try again
          </button>
        )}
      </li>
    );
  const i = t.interp;
  // Show the rewrite only when it resolved shorthand; small rephrasings are noise.
  const rewritten = t.speaker === 'doctor' && i.ambiguities.length > 0 && i.plain_source && norm(i.plain_source) !== norm(t.text);
  return (
    <li className={`turn ${t.speaker} ${t.discarded ? 'discarded' : ''}`}>
      <div className="who">
        {who}
        {t.sttModel && <span className="model">{t.sttModel}</span>}
      </div>
      <p className="said" lang={t.speaker === 'doctor' ? 'en' : lang.slice(0, 2)}>
        {t.text}
      </p>
      {rewritten && (
        <p className="plain">
          <span className="tag">Plain words</span> {i.plain_source}
        </p>
      )}
      <p className="heard" lang={t.speaker === 'doctor' ? lang.slice(0, 2) : 'en'}>
        {i.translation}
      </p>
      {i.ambiguities.map((a) => (
        <p className="amb" key={a.phrase}>
          <strong>“{a.phrase}”</strong> {a.issue} <em>{a.resolved_as}</em>
        </p>
      ))}
      {t.speaker === 'doctor' && i.back_translation && (
        <details className="back">
          <summary>What the patient hears, word for word</summary>
          <p>{i.back_translation}</p>
        </details>
      )}
      {t.again && (
        <p className="plain again-said">
          <span className="tag">{t.again.simpler ? 'Said again, simpler' : 'Said again, slower'}</span> <span lang={lang.slice(0, 2)}>{t.again.text}</span>
          {t.again.back && <small>{t.again.back}</small>}
        </p>
      )}
      <div className="chips">
        {t.fixed && <span className="chip ok">Fixed phrase: no model, nothing to mistranslate</span>}
        {t.confirmed && <span className="chip ok">Read back and confirmed</span>}
        <LockChip lock={t.lock} />
        {i.confidence !== 'high' && (
          <span className={`chip ${i.confidence === 'low' ? 'bad' : 'meh'}`} title={i.confidence_reason}>
            {i.confidence === 'low' ? 'Unsure' : 'Check'}: {i.confidence_reason}
          </span>
        )}
        {t.ms?.stt > 0 && <span className="chip time">heard {sec(t.ms.stt)}</span>}
        {t.ms?.interpret > 0 && <span className="chip time">interpreted {sec(t.ms.interpret)}</span>}
        {t.ms?.voice > 0 && <span className="chip time">voiced {sec(t.ms.voice)}</span>}
      </div>
      {t.hold && t.readback && (
        <div className="rx" role="group" aria-label="Read-back: confirm before the patient hears it">
          <span className="rx-t">Read-back. Is this what you prescribed?</span>
          {/* The sentence as Dubash understood it: the table can drop a detail ("1 tablet") that the sentence keeps. */}
          <p className="rx-said">{i.plain_source || t.text}</p>
          <table>
            <tbody>
              {i.medicines.map((m) => (
                <tr key={m.name}>
                  <th>{m.name}</th>
                  <td>{m.dose || '—'}</td>
                  <td>{[m.frequency, m.timing].filter(Boolean).join(', ') || '—'}</td>
                  <td>{m.duration || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rx-go">
            <button className="btn small" onClick={onSpeak}>
              Yes, say it
            </button>
            <button className="btn small ghost" onClick={onDiscard}>
              No, I will say it again
            </button>
          </div>
        </div>
      )}
      {t.hold && !t.readback && (
        <div className="held" role="alert">
          <span className="stamp">Held</span>
          <span>
            {(i.conflicts || []).length > 0
              ? 'This clashes with something the patient told you, so it was not spoken.'
              : !t.lock.ok
                ? 'The numbers did not survive translation, so this was not spoken.'
                : 'Dubash is not sure of this one, so it was not spoken.'}{' '}
            {i.clarify?.options?.length >= 2 ? 'Tap what you meant, or rephrase.' : 'Rephrase, or check and send it.'}
          </span>
          {(i.conflicts || []).map((c) => (
            <span className="clash" key={c}>
              Reminder: {c}
            </span>
          ))}
          {i.clarify?.options?.length >= 2 && (
            <span className="ask-back">
              <strong>{i.clarify.question || 'Which did you mean?'}</strong>
              {i.clarify.options.slice(0, 2).map((o) => (
                <button key={o} className="btn small ghost" onClick={() => onClarify(o)}>
                  {o}
                </button>
              ))}
            </span>
          )}
          <button className="btn small" onClick={onSpeak}>
            Speak anyway
          </button>
          <button className="btn small ghost" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}
    </li>
  );
}

function LockChip({ lock }) {
  if (!lock) return null;
  if (!lock.ok) return <span className="chip bad">Numbers differ: {[...lock.missing.map((n) => `lost ${n}`), ...lock.extra.map((n) => `added ${n}`)].join(', ')}</span>;
  if (lock.caught)
    return (
      <span className="chip caught">
        Dose lock caught a {lock.caught.missing.length ? `lost ${lock.caught.missing.join(', ')}` : `stray ${lock.caught.extra.join(', ')}`} and fixed it
      </span>
    );
  if (!lock.checked.length) return null;
  return <span className="chip ok">Numbers match: {lock.checked.join(', ')}</span>;
}

function TeachBack({ teach, onReExplain, onAgain, onAsk }) {
  if (teach.status === 'listening' && !teach.items)
    return (
      <li className="teach">
        <h3>Teach-back</h3>
        <p>Ask the patient to say the plan back in their own words, then tap their microphone.</p>
      </li>
    );
  if (teach.status === 'checking' && !teach.items)
    return (
      <li className="teach">
        <h3>Teach-back</h3>
        {teach.retelling && <p className="said">{teach.retelling}</p>}
        <p className="step">Checking each instruction…</p>
      </li>
    );
  if (teach.status === 'error')
    return (
      <li className="teach">
        <h3>Teach-back</h3>
        <p className="said">{teach.error}</p>
      </li>
    );
  const gaps = teach.items.filter((i) => i.status !== 'understood');
  const got = teach.items.length - gaps.length;
  const waiting = teach.status !== 'done';
  return (
    <li className="teach">
      <h3>
        Teach-back
        <span className={`score ${gaps.length ? '' : 'full'}`}>
          {got} of {teach.items.length} understood{teach.round > 1 ? ` · round ${teach.round}` : ''}
        </span>
      </h3>
      <span className="meter" aria-hidden>
        <i style={{ width: `${(got / teach.items.length) * 100}%` }} />
      </span>
      <p className="said">{teach.retelling}</p>
      <ul className="checks">
        {teach.items.map((i) => (
          <li key={i.item} className={i.status}>
            <span className="mark-s">{{ understood: 'Got it', partial: 'Partly', missed: 'Missed', wrong: 'Wrong' }[i.status]}</span>
            <span className="item">{i.item}</span>
            {i.re_explain && (
              <button className="link" onClick={() => onReExplain([i])} disabled={waiting}>
                Re-explain
              </button>
            )}
            {i.ask && i.status !== 'understood' && (
              <button className="link" onClick={() => onAsk(i)} disabled={waiting} title={i.ask}>
                Ask just this
              </button>
            )}
          </li>
        ))}
      </ul>
      {gaps.length > 0 && (
        <p className="sum">
          {teach.summary_for_doctor}{' '}
          <button className="btn small" onClick={() => onReExplain(gaps)} disabled={waiting}>
            Re-explain all {gaps.length}
          </button>
          <button className="btn small ghost" onClick={() => onAgain(gaps)} disabled={waiting}>
            Ask again: only these {gaps.length}
          </button>
        </p>
      )}
      {waiting && <p className="step">{teach.status === 'listening' ? 'Listening for the patient: tap their microphone when they are ready…' : 'Checking the missed items…'}</p>}
      {!gaps.length && teach.round > 1 && <p className="grounding ok">Every instruction understood after {teach.round} rounds. This goes on the clinical note.</p>}
    </li>
  );
}

function Wrap({ wrap, lang, demo, facts, onClose, onRead }) {
  // Allergies, conditions and pregnancy ride along in the QR, so the next doctor who scans this slip starts with them.
  const carry = facts.filter((f) => f.kind !== 'current_medicine' && f.kind !== 'prior').map((f) => f.text);
  const [qr, setQr] = useState(null);
  useEffect(() => {
    if (wrap.status !== 'done') return;
    // The check fields are for the doctor; the patient's QR carries only the slip.
    const h = { ...wrap.take_home, medicines: wrap.take_home.medicines.map(({ unsaid, unsourced, ...m }) => m) };
    encodeSlip({ l: lang, h, d: demo ? 1 : 0, f: carry })
      .then((code) => QRCode.toDataURL(`${location.origin}/slip#${code}`, { margin: 1, width: 264, errorCorrectionLevel: 'L', color: { dark: '#1a1c2e', light: '#fbeef0' } }))
      .then(setQr)
      .catch(() => setQr(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrap, lang, demo]);
  return (
    <div className="wrap" role="dialog" aria-modal="true" aria-label="Wrap-up">
      <div className="wrap-in">
        <header className="wrap-head">
          <h2>Wrap-up</h2>
          <div>
            {wrap.status === 'done' && (
              <button className="btn small ghost" onClick={() => window.print()}>
                Print slip
              </button>
            )}
            <button className="btn small ghost" onClick={onClose}>
              Back to consult
            </button>
          </div>
        </header>
        {wrap.status === 'writing' && <p className="step">Writing the note and the take-home slip…</p>}
        {wrap.status === 'error' && <p className="warn">{wrap.error}</p>}
        {wrap.status === 'done' && (
          <div className="wrap-grid">
            <article className="note">
              <h3>Clinical note</h3>
              <p className="cc">{wrap.note.chief_complaint}</p>
              <NoteRows title="History" rows={wrap.note.history} />
              <NoteRows title="Plan" rows={wrap.note.plan} />
              <h4>Medicines</h4>
              <table>
                <tbody>
                  {wrap.note.medicines.map((m) => (
                    <tr key={m.name} className={m.unsaid?.length ? 'unsaid' : ''}>
                      <th>{m.name}</th>
                      <td>
                        {[m.dose, m.frequency, m.timing, m.duration].filter(Boolean).join(', ')}
                        {m.unsaid?.length > 0 && <span className="unsaid-tag">not said: {m.unsaid.join(', ')}</span>}
                      </td>
                      <td>
                        <span className="cite">{m.turns.join(' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wrap.note.red_flags.length > 0 && (
                <>
                  <h4>Red flags</h4>
                  <ul>
                    {wrap.note.red_flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
              <h4>Follow-up</h4>
              <p>{wrap.note.follow_up}</p>
              {wrap.leftOut?.length > 0 && (
                <p className="hint">Left out: {wrap.leftOut.join(' ')}, still held and never said to the patient.</p>
              )}
              <p className="hint">Each line cites the turns it came from. Lines without a valid citation, and numbers not said in the cited turns, are flagged for review.</p>
            </article>
            <div className="slip-col">
              {wrap.issues?.length > 0 ? (
                <div className="grounding bad" role="alert">
                  <strong>Check before printing.</strong> These numbers were not said in the consult:
                  <ul>
                    {wrap.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                wrap.issues && <p className="grounding ok">Every dose, count and day on the note and the slip was said in the consult.</p>
              )}
              <Slip takeHome={wrap.take_home} lang={lang} onListen={onRead} qr={qr} />
              {carry.length > 0 && <p className="hint">Carried in the QR for the next visit: {carry.join('; ')}.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRows({ title, rows }) {
  return (
    <>
      <h4>{title}</h4>
      <ul>
        {rows.map((r) => (
          <li key={r.text} className={r.turns.length ? '' : 'uncited'}>
            {r.text} <span className="cite">{r.turns.length ? r.turns.join(' ') : 'no source'}</span>
            {r.unsaid?.length > 0 && <span className="unsaid-tag">not said: {r.unsaid.join(', ')}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AgainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoctorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0M14 20a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M9 9.2a3 3 0 1 1 4.6 2.5c-.9.6-1.6 1.2-1.6 2.3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.2" fill="currentColor" />
    </svg>
  );
}

// Reads a slip's QR with the browser's own BarcodeDetector (Android Chrome and others); desktop users paste the link.
function QrScan({ onCode, onFail }) {
  const video = useRef(null);
  useEffect(() => {
    let stream;
    let timer;
    let off = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (off) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          const [code] = await detector.detect(video.current).catch(() => []);
          if (code?.rawValue) onCode(code.rawValue);
        }, 350);
      } catch {
        onFail();
      }
    })();
    return () => {
      off = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <video className="scan" ref={video} muted playsInline aria-label="Point the camera at the QR code on the slip" />;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// One line per drug from the doctor's released turns; a later mention of the same drug replaces the earlier one.
function medicinesSoFar(turns) {
  const byDrug = new Map();
  for (const t of turns) {
    if (t.speaker !== 'doctor') continue;
    for (const m of t.interp.medicines || []) {
      const key = String(m.name).toLowerCase().match(/[a-z]+/)?.[0];
      if (key) byDrug.set(key, { ...m, id: t.id });
    }
  }
  return [...byDrug.values()];
}

// "Dolo 650" with dose "650 mg" says the strength twice; keep the dose only when it adds something (e.g. "1 tablet").
function sameStrength(name, dose) {
  const nums = (s) => String(s).match(/\d+(?:\.\d+)?/g) || [];
  const inName = new Set(nums(name));
  const n = nums(dose);
  return n.length > 0 && n.every((x) => inName.has(x));
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function PatientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
