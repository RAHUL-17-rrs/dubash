'use client';
// The hero: a phone lying flat on the consultation table, top half turned to face the patient.
// It replays the scripted consult so the idea reads in one glance, and the play button lets you hear the turn on
// screen in the baked Gnani Timbre voice: a voice product should be audible before the first scroll.
import { useEffect, useRef, useState } from 'react';
import { DEMO } from '@/lib/demo';
import baked from '@/public/demo/baked.json';

const START = DEMO.turns.findIndex((t) => t.text.includes('Hold the metformin'));

export default function HeroDevice() {
  // open on the "hold the metformin" turn, the one that matters
  const [i, setI] = useState(START);
  const [playing, setPlaying] = useState(false);
  const audio = useRef(null);

  // The carousel rests while a clip plays, so the words on screen are the words being heard.
  useEffect(() => {
    if (playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % DEMO.turns.length), 4200);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => () => audio.current?.pause(), []);

  const t = DEMO.turns[i];
  const doc = t.speaker === 'doctor';
  const amb = t.interp.ambiguities[0];
  const clip = !t.hold && baked.files.includes(`t${i + 1}`) ? `/demo/t${i + 1}.mp3` : null;

  function toggle() {
    if (playing) {
      audio.current?.pause();
      return setPlaying(false);
    }
    const a = new Audio(clip);
    audio.current = a;
    a.onended = a.onerror = () => setPlaying(false);
    a.play().then(() => setPlaying(true), () => setPlaying(false));
  }

  return (
    <div className="table-top" aria-label="Dubash on a consultation table, replaying a synthetic consult">
      <div className="slip-peek" aria-hidden="true" lang="te">
        <span className="token">Token 47</span>
        <p>{DEMO.note.take_home.greeting}</p>
        <p>
          <b>Amlodipine 5 mg</b> రోజూ రాత్రి 1 మాత్ర.
        </p>
        <p>
          <b>Metformin 500 mg</b> రోజుకు 2 సార్లు, భోజనం తర్వాత.
        </p>
      </div>
      <div className="phone">
        <div className="screen">
          <div className="half patient-h" lang="te">
            <div key={`p${i}`} className="swap">
              {/* a held turn never reaches the patient's half: it keeps waiting */}
              {doc ? <p className="big">{t.hold ? '…' : t.interp.translation}</p> : <p className="own">{t.text}</p>}
            </div>
            <span className="say">మాట్లాడండి</span>
          </div>
          <div className="half doctor-h">
            <div key={`d${i}`} className="swap">
              <span className={`who ${t.speaker}`}>{doc ? 'Dr. Arjun' : 'Lakshmi'}</span>
              <p className={doc ? 'own' : 'big'}>{doc ? t.text : t.interp.translation}</p>
              {doc && amb && (
                <p className="mini-amb">
                  <b>“{amb.phrase}”</b> rewritten: {t.interp.plain_source.split('. ')[1] || t.interp.plain_source}
                </p>
              )}
              <div className="mini-chips">
                {(doc ? t.interp.plain_source : t.text).match(/\d+/g) && <span className="chip ok">Numbers match</span>}
                {t.caught && <span className="chip caught">Caught a lost 2</span>}
                {t.hold && <span className="chip bad">Held: she is allergic to penicillin</span>}
                {t.interp.red_flags[0] && <span className="chip bad">{t.interp.red_flags[0]}</span>}
              </div>
              {t.hold && <span className="stamp big">Held</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="hero-ctl">
        <button className={`hear ${playing ? 'on' : ''}`} onClick={toggle} disabled={!clip} aria-pressed={playing}>
          <span className="bars" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          {playing ? 'Pause' : clip ? (doc ? 'Hear it in Telugu' : 'Hear it in English') : 'Held: never spoken'}
        </button>
        <span className="pips" aria-hidden>
          {DEMO.turns.map((x, n) => (
            <i key={n} className={`${n === i ? 'on' : ''} ${x.hold ? 'stop' : ''}`} />
          ))}
        </span>
      </div>
    </div>
  );
}
