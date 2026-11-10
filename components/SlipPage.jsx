'use client';
// Opened from the QR on the take-home slip, usually on a family member's phone.
// Beyond reading the slip aloud, the family can ask it questions (answered only from the slip itself)
// and hold a medicine strip up to the camera to check it is the one the doctor prescribed.
import { useEffect, useRef, useState } from 'react';
import Slip from './Slip';
import { useMic } from './useMic';
import { decodeSlip, slipText } from '@/lib/slip';
import { LANGUAGES } from '@/lib/medical';
import { phrases } from '@/lib/phrases';
import baked from '@/public/demo/baked.json';

const STRIP = {
  match: (r) => ({ ok: true, title: `Yes. This is ${r.med.name}.`, body: r.med.how }),
  wrong_strength: (r) => ({ ok: false, title: 'Same medicine, different strength.', body: `The pack says ${r.read.strength}. The slip says ${r.med.name}. Show both to the chemist before taking it.` }),
  not_on_slip: (r) => ({ ok: false, title: `${r.read.brand || r.read.generic || 'This medicine'} is not on this slip.`, body: 'Do not take it on the strength of this slip. Ask the chemist or the doctor.' }),
  unreadable: () => ({ ok: false, title: 'Could not read the pack.', body: 'Try again in better light, with the printed name facing the camera.' }),
};

export default function SlipPage() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [qa, setQa] = useState(null); // { question, answer, found, busy, fixed }
  const [strip, setStrip] = useState(null);
  const [typed, setTyped] = useState('');
  const player = useRef(null);
  const mic = useMic((wav) => ask({ wav }));

  useEffect(() => {
    const code = location.hash.slice(1);
    if (!code) return setErr('This link has no slip in it.');
    decodeSlip(code).then(setP, () => setErr('This slip link is damaged. Ask the clinic to show the QR again.'));
  }, []);

  function play(src) {
    player.current?.pause();
    if (!src) return;
    player.current = new Audio(src);
    player.current.play().catch(() => {});
  }

  async function speak(text) {
    const r = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: p.l, voice: 'Shivani' }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Audio is not available right now.');
    play(URL.createObjectURL(await r.blob()));
  }

  async function listen() {
    if (p.d && baked.files.includes('slip')) return play('/demo/slip.mp3');
    speak(slipText(p.h)).catch((e) => setErr(e.message));
  }

  // Tapping a medicine reads that medicine's own line from the slip: no model, so nothing can be invented.
  function tell(m) {
    const answer = [m.how, m.why].filter(Boolean).join(' ');
    setQa({ question: m.name, answer, found: true, fixed: true });
    speak(`${m.name}. ${answer}`).catch(() => {}); // the words are on screen even when the voice is not available
  }

  async function ask({ wav, question }) {
    setQa({ busy: true, question: question || '' });
    const fd = new FormData();
    fd.append('lang', p.l);
    fd.append('slip', JSON.stringify(p.h));
    if (wav) fd.append('audio', wav, 'question.wav');
    if (question) fd.append('question', question);
    try {
      const r = await fetch('/api/ask', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not answer right now.');
      if (j.empty) return setQa(null);
      setQa(j);
      play(j.audio);
    } catch (e) {
      // If the answer cannot be checked against the slip, the only safe answer is the fixed one.
      setQa({ question: question || '', answer: phrases(p.l).askDoctor, found: false, note: e.message });
    }
  }

  async function check(file) {
    if (!file) return;
    setStrip({ busy: true });
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('medicines', JSON.stringify(p.h.medicines.map(({ name, how }) => ({ name, how }))));
    try {
      const r = await fetch('/api/strip', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not check the photo.');
      setStrip(STRIP[j.status](j));
    } catch (e) {
      setStrip({ ok: false, title: 'Could not check this photo.', body: e.message });
    }
  }

  const L = p && LANGUAGES[p.l];
  const listening = mic.side === 'patient';

  return (
    <main className="slip-page">
      {err && <p className="warn">{err}</p>}
      {p && <Slip takeHome={p.h} lang={p.l} onListen={listen} />}

      {p && (
        <section className="ask" aria-labelledby="ask-h">
          <h2 id="ask-h">
            Ask this slip <small>It answers only from what the doctor wrote above.</small>
          </h2>
          <div className="ask-meds">
            {p.h.medicines.map((m) => (
              <button key={m.name} onClick={() => tell(m)}>
                {m.name}
              </button>
            ))}
          </div>
          <form
            className="ask-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) ask({ question: typed.trim() });
              setTyped('');
            }}
          >
            <button
              type="button"
              className={`mic wide ask-mic ${listening ? 'on' : ''}`}
              style={{ '--lvl': listening ? mic.level : 0 }}
              onClick={() => (listening ? mic.stop() : mic.start('patient'))}
              aria-pressed={listening}
              aria-label="Ask a question by voice"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              </svg>
              <span lang={p.l.slice(0, 2)}>{L?.speak}</span>
            </button>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="or type a question" aria-label="Type a question about this slip" />
            <button className="btn small" disabled={!typed.trim()}>
              Ask
            </button>
          </form>
          {mic.error && <p className="warn">{mic.error}</p>}
          {qa && (
            <div className={`answer ${qa.busy ? 'busy' : qa.found ? 'found' : 'none'}`} role="status" key={qa.answer || 'busy'}>
              {qa.question && <p className="q">{qa.question}</p>}
              {qa.busy ? (
                <span className="dots" aria-label="Looking at the slip">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <p className="a" lang={p.l.slice(0, 2)}>
                  {qa.answer}
                </p>
              )}
              {!qa.busy && <small lang="en">{qa.fixed ? 'Read from the slip, word for word.' : qa.found ? 'Answered from the slip. Every number in it is printed above.' : 'Not on the slip, so Dubash will not guess.'}</small>}
            </div>
          )}
        </section>
      )}

      {p && (
        <section className="ask" aria-labelledby="strip-h">
          <h2 id="strip-h">
            Check a medicine pack <small>Photograph the strip or box. Dubash checks it against this slip.</small>
          </h2>
          <label className="btn ghost shot">
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => check(e.target.files[0])} />
            Take a photo of the pack
          </label>
          {strip && (
            <div className={`answer ${strip.busy ? 'busy' : strip.ok ? 'found' : 'none'}`} role="status" key={strip.title || 'busy'}>
              {strip.busy ? (
                <span className="dots" aria-label="Reading the pack">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  <p className="a">
                    <span className={`verdict ${strip.ok ? 'yes' : 'no'}`} aria-hidden>
                      {strip.ok ? '✓' : '✕'}
                    </span>{' '}
                    {strip.title}
                  </p>
                  <p lang={strip.ok ? p.l.slice(0, 2) : 'en'}>{strip.body}</p>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
