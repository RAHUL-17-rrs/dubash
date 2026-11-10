'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMic } from './useMic';
import { LANGUAGES } from '@/lib/medical';
import { DEMO } from '@/lib/demo';
import baked from '@/public/demo/baked.json';
import QRCode from 'qrcode';
import Slip from './Slip';
import { slipText, encodeSlip } from '@/lib/slip';

const CLONE_SCRIPT =
  'I am a doctor at this clinic. Dubash will carry my words to my patients in their own language, in my voice. I agree to my voice being used only for my own consultations.';

const STEPS = { listen: 'Hearing', interpret: 'Interpreting', voice: 'Voicing' };

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
  function play(src) {
    if (!src) return;
    queue.current.push(src);
    if (!player.current) next();
  }
  function next() {
    const src = queue.current.shift();
    if (!src) {
      player.current = null;
      mic.pause(false);
      return;
    }
    mic.pause(true);
    const a = new Audio(src);
    player.current = a;
    a.onended = a.onerror = next;
    a.play().catch(next);
  }
  async function say(text, toPatient) {
    const r = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toPatient ? { text, lang, embedding: voice.embedding, voice: voice.name } : { text, lang: 'en-IN', voice: 'Shivani' }
      ),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not speak');
    const url = URL.createObjectURL(await r.blob());
    play(url);
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
      .map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, translation: t.interp.translation }));
    const fd = new FormData();
    if (wav) fd.append('audio', wav, 'turn.wav');
    if (text) fd.append('text', text);
    fd.append('side', side);
    fd.append('patientLang', lang);
    fd.append('history', JSON.stringify(history));
    if (voice.embedding) fd.append('embedding', JSON.stringify(voice.embedding));
    fd.append('doctorVoice', voice.name);
    try {
      const r = await fetch('/api/turn', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Turn failed (${r.status})`);
      if (j.empty) return setTurns((ts) => ts.filter((t) => t.id !== id));
      patch(id, { ...j, status: 'done' });
      play(j.audio);
    } catch (e) {
      patch(id, { status: 'error', error: e.message });
    }
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
    patch(t.id, { hold: false, overridden: true });
    try {
      await say(t.interp.translation, t.speaker === 'doctor');
    } catch (e) {
      setError(e.message);
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
    turnsRef.current.filter((t) => t.status === 'done' && !t.discarded && t.speaker === 'doctor').map((t) => t.interp.plain_source || t.text);

  function startTeach() {
    setFocus(null);
    if (demo) return runDemoTeach();
    target.current = 'teach';
    setTeach({ status: 'listening' });
  }

  async function teachback(wav) {
    target.current = 'turn';
    setTeach({ status: 'checking' });
    const fd = new FormData();
    fd.append('audio', wav, 'retelling.wav');
    fd.append('patientLang', lang);
    fd.append('instructions', JSON.stringify(instructions()));
    try {
      const r = await fetch('/api/teachback', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.empty) return setTeach({ status: 'listening' }), (target.current = 'teach');
      setTeach({ status: 'done', ...j });
    } catch (e) {
      setTeach({ status: 'error', error: e.message });
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
    if (demo) return setWrap({ status: 'done', ...DEMO.note });
    setWrap({ status: 'writing' });
    const done = turnsRef.current.filter((t) => t.status === 'done' && !t.discarded);
    try {
      const r = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientLang: lang,
          teachback: teach?.items ? { items: teach.items, summary: teach.summary_for_doctor } : null,
          turns: done.map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, plain: t.interp.plain_source, translation: t.interp.translation })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setWrap({ status: 'done', ...j });
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
    if (!s.hold) play(await demoAudio(id));
  }

  async function runDemoTeach() {
    setTeach({ status: 'listening' });
    await wait(1600);
    setTeach({ status: 'checking', retelling: DEMO.teachback.retelling });
    await wait(1400);
    setTeach({ status: 'done', ...DEMO.teachback });
  }

  const demoSteps = DEMO.turns.length + 2;
  async function demoNext() {
    const i = demoStep;
    setDemoStep(i + 1);
    if (i < DEMO.turns.length) await demoTurn(i);
    else if (i === DEMO.turns.length) await runDemoTeach();
    else await wrapUp();
  }

  useEffect(() => {
    if (!demo || !autoplay || demoStep >= demoSteps) return;
    const t = setTimeout(demoNext, demoStep === 0 ? 300 : 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, autoplay, demoStep]);

  // ---------- render ----------
  if (phase === 'setup')
    return (
      <Setup
        {...{ lang, setLang, voice, setVoice, status, mic, cloneState, setCloneState }}
        onRecordClone={() => {
          target.current = 'clone';
          mic.start('doctor');
        }}
        onStopClone={() => mic.stop()}
        onStart={() => setPhase('live')}
      />
    );

  const done = turns.filter((t) => t.status === 'done' && !t.discarded);
  const last = turns.at(-1);
  const flags = [...new Set(done.flatMap((t) => t.interp.red_flags))];
  const L = LANGUAGES[lang];
  const patientListening = teach?.status === 'listening' || mic.side === 'patient';

  return (
    <div className={`consult ${table ? 'table' : ''}`}>
      {/* ---------- patient half (faces the patient: rotated on a phone lying flat) ---------- */}
      <section className="pane patient" aria-label="Patient side" lang={lang.slice(0, 2)}>
        <div className="pane-in">
          <div className="p-head">
            <span className="p-lang">{L.native}</span>
          </div>
          <PatientView turn={last} focus={focus} />
          <div className="p-actions">
            {done.some((t) => t.speaker === 'doctor' && !t.hold) && (
              <button className="again" onClick={repeatLast} aria-label={`${L.again} (repeat what the doctor said)`}>
                <AgainIcon />
                <span>{L.again}</span>
              </button>
            )}
          <button
            className={`mic big ${mic.side === 'patient' || teach?.status === 'listening' ? 'on' : ''}`}
            style={{ '--lvl': mic.side === 'patient' ? mic.level : 0 }}
            onClick={() => (mic.side === 'patient' ? mic.stop() : demo ? !autoplay && demoNext() : mic.start('patient'))}
            aria-pressed={patientListening}
            aria-label={`${L.speak} (patient microphone)`}
          >
            <MicIcon />
            <span>{L.speak}</span>
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
          <span className="pill">
            {L.name} <span lang={lang.slice(0, 2)}>{L.native}</span>
          </span>
          <span className="pill quiet">{voice.kind === 'clone' ? 'Your voice' : `Voice: ${voice.name}`}</span>
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
            <button className="btn small ghost" onClick={startTeach} disabled={!done.some((t) => t.speaker === 'doctor') || (demo && demoStep < DEMO.turns.length)}>
              Teach-back
            </button>
            <button className="btn small" onClick={wrapUp} disabled={!done.length || (demo && demoStep <= DEMO.turns.length)}>
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
              <button className="btn small" onClick={demoNext} disabled={autoplay || demoStep >= demoSteps}>
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

        <ol className="turns" ref={listRef} aria-live="polite">
          {turns.length === 0 && (
            <li className="empty">
              {demo ? 'Press Next or Play all to start the consult.' : mic.handsFree ? 'Listening. Just talk; Dubash works out who is speaking.' : 'Tap a microphone, or type below.'}
            </li>
          )}
          {turns.map((t) => (
            <Turn key={t.id} t={t} lang={lang} onSpeak={() => speakAnyway(t)} onDiscard={() => patch(t.id, { discarded: true, hold: false })} />
          ))}
          {teach && <TeachBack teach={teach} onReExplain={reExplain} />}
        </ol>

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
              className={`mic ${mic.side === 'doctor' ? 'on' : ''}`}
              style={{ '--lvl': mic.side === 'doctor' ? mic.level : 0 }}
              onClick={() => (mic.side === 'doctor' ? mic.stop() : ((target.current = 'turn'), mic.start('doctor')))}
              aria-pressed={mic.side === 'doctor'}
              aria-label={mic.side === 'doctor' ? 'Stop and interpret' : 'Doctor microphone'}
            >
              <MicIcon />
            </button>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={mic.side === 'doctor' ? 'Listening… tap the mic again to send' : 'Or type what you want to say'} aria-label="Type a doctor turn" />
            <button className="btn small" disabled={!typed.trim()}>
              Send
            </button>
          </form>
        )}
      </section>

      {wrap && <Wrap wrap={wrap} lang={lang} demo={demo} onClose={() => setWrap(null)} onRead={readSlip} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Setup({ lang, setLang, voice, setVoice, status, mic, cloneState, setCloneState, onRecordClone, onStopClone, onStart }) {
  const live = status?.gnani && status?.llm;
  const recording = mic.side === 'doctor';
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
                <small>{l.name}</small>
              </button>
            ))}
        </div>
        <p className="hint">Prisma listens for English and this language only, so it can tell who is speaking.</p>
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

function PatientView({ turn, focus }) {
  if (focus)
    return (
      <div className="p-main">
        <p className="p-big">{focus}</p>
      </div>
    );
  if (!turn) return <div className="p-main" />;
  if (turn.status === 'pending')
    return (
      <div className="p-main">
        <span className="dots" aria-label="Working">
          <i />
          <i />
          <i />
        </span>
        {turn.speaker === 'patient' && turn.text && <p className="p-own">{turn.text}</p>}
      </div>
    );
  if (turn.status !== 'done' || turn.discarded) return <div className="p-main" />;
  if (turn.speaker === 'doctor')
    return (
      <div className="p-main">
        <span className="p-from" aria-hidden>
          <DoctorIcon />
        </span>
        <p className="p-big">{turn.hold ? '…' : turn.interp.translation}</p>
      </div>
    );
  return (
    <div className="p-main">
      <p className="p-own">{turn.text}</p>
      <span className="p-check" aria-hidden>
        ✓
      </span>
    </div>
  );
}

function Turn({ t, lang, onSpeak, onDiscard }) {
  const who = t.speaker === 'doctor' ? 'Doctor' : t.speaker === 'patient' ? 'Patient' : 'Someone';
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
      <p className="said" lang={t.speaker === 'patient' ? lang.slice(0, 2) : 'en'}>
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
      <div className="chips">
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
      {t.hold && (
        <div className="held" role="alert">
          <span className="stamp">Held</span>
          <span>
            {(i.conflicts || []).length > 0
              ? 'This clashes with something the patient told you, so it was not spoken.'
              : !t.lock.ok
                ? 'The numbers did not survive translation, so this was not spoken.'
                : 'Dubash is not sure of this one, so it was not spoken.'}{' '}
            Rephrase, or check and send it.
          </span>
          {(i.conflicts || []).map((c) => (
            <span className="clash" key={c}>
              Reminder: {c}
            </span>
          ))}
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

function TeachBack({ teach, onReExplain }) {
  if (teach.status === 'listening')
    return (
      <li className="teach">
        <h3>Teach-back</h3>
        <p>Ask the patient to say the plan back in their own words, then tap their microphone.</p>
      </li>
    );
  if (teach.status === 'checking')
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
  return (
    <li className="teach">
      <h3>Teach-back</h3>
      <p className="said">{teach.retelling}</p>
      <ul className="checks">
        {teach.items.map((i) => (
          <li key={i.item} className={i.status}>
            <span className="mark-s">{{ understood: 'Got it', partial: 'Partly', missed: 'Missed', wrong: 'Wrong' }[i.status]}</span>
            <span className="item">{i.item}</span>
            {i.re_explain && (
              <button className="link" onClick={() => onReExplain([i])}>
                Re-explain
              </button>
            )}
          </li>
        ))}
      </ul>
      {gaps.length > 0 && (
        <p className="sum">
          {teach.summary_for_doctor}{' '}
          <button className="btn small" onClick={() => onReExplain(gaps)}>
            Re-explain all {gaps.length}
          </button>
        </p>
      )}
    </li>
  );
}

function Wrap({ wrap, lang, demo, onClose, onRead }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    if (wrap.status !== 'done') return;
    encodeSlip({ l: lang, h: wrap.take_home, d: demo ? 1 : 0 })
      .then((code) => QRCode.toDataURL(`${location.origin}/slip#${code}`, { margin: 1, width: 264, errorCorrectionLevel: 'L', color: { dark: '#1a1c2e', light: '#fbeef0' } }))
      .then(setQr)
      .catch(() => setQr(null));
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
                    <tr key={m.name}>
                      <th>{m.name}</th>
                      <td>{[m.dose, m.frequency, m.timing, m.duration].filter(Boolean).join(', ')}</td>
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
              <p className="hint">Each line cites the turns it came from. Lines without a valid citation are flagged for review.</p>
            </article>
            <Slip takeHome={wrap.take_home} lang={lang} onListen={onRead} qr={qr} />
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
