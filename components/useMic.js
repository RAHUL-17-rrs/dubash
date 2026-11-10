'use client';
// Microphone -> 16 kHz mono WAV utterances. Two ways in:
//  - hands-free: an energy voice detector cuts each utterance (one phone hears both people)
//  - tap-to-talk: start() / stop() on a specific side
// Gnani REST STT takes wav/mp3/ogg/flac/aac/m4a only (not Chrome's webm), so we encode WAV ourselves.
import { useEffect, useRef, useState } from 'react';

const WORKLET = `registerProcessor('tap', class extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
});`;

const OUT_RATE = 16000;
const FRAME_MS = 30;
const START_FRAMES = 5; // 150 ms of voice opens an utterance
const HANG_MS = 750; // this much quiet closes it
const MIN_VOICE_MS = 400; // shorter blips (coughs, taps) are dropped
const MAX_MS = 28000; // Prisma REST takes 30 s per clip
const PRE_FRAMES = 10; // 300 ms pre-roll so first syllables are not clipped

export function useMic(onUtterance) {
  const cb = useRef(onUtterance);
  cb.current = onUtterance;
  const io = useRef(null);
  const v = useRef(fresh());
  const [ui, setUi] = useState({ open: false, handsFree: false, side: null, voiced: false, level: 0, error: '' });

  function fresh() {
    return { handsFree: false, side: null, paused: false, frame: [], pre: [], chunks: [], run: 0, inSpeech: false, voiceMs: 0, quietMs: 0, totalMs: 0, floor: 0.008, tick: 0 };
  }

  async function open() {
    if (io.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      const ctx = new AudioContext();
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'tap');
      node.port.onmessage = (e) => onSamples(e.data, ctx.sampleRate);
      ctx.createMediaStreamSource(stream).connect(node);
      node.connect(ctx.destination); // silent output; keeps the node pulled on every browser
      io.current = { ctx, stream, node };
      setUi((u) => ({ ...u, open: true, error: '' }));
      return true;
    } catch (e) {
      setUi((u) => ({ ...u, error: e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.message }));
      return false;
    }
  }

  function onSamples(block, rate) {
    const s = v.current;
    s.frame.push(block);
    const n = s.frame.reduce((a, b) => a + b.length, 0);
    if (n < (rate * FRAME_MS) / 1000) return;
    const frame = concat(s.frame);
    s.frame = [];
    if (s.paused) return;

    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    const voiced = rms > Math.max(0.012, s.floor * 2.8);
    if (++s.tick % 4 === 0) setUi((u) => ({ ...u, level: Math.min(1, rms * 12), voiced: s.inSpeech || Boolean(s.side) }));

    if (s.side) {
      // tap-to-talk: keep everything until stop()
      s.chunks.push(frame);
      s.totalMs += FRAME_MS;
      if (s.totalMs >= MAX_MS) stop();
      return;
    }
    if (!s.handsFree) return;

    if (!s.inSpeech) {
      if (!voiced) s.floor = s.floor * 0.95 + rms * 0.05;
      s.pre.push(frame);
      if (s.pre.length > PRE_FRAMES) s.pre.shift();
      s.run = voiced ? s.run + 1 : 0;
      if (s.run >= START_FRAMES) {
        s.inSpeech = true;
        s.chunks = [...s.pre];
        s.voiceMs = s.run * FRAME_MS;
        s.quietMs = 0;
        s.totalMs = s.chunks.length * FRAME_MS;
        s.pre = [];
      }
      return;
    }
    s.chunks.push(frame);
    s.totalMs += FRAME_MS;
    if (voiced) {
      s.voiceMs += FRAME_MS;
      s.quietMs = 0;
    } else s.quietMs += FRAME_MS;
    if (s.quietMs >= HANG_MS || s.totalMs >= MAX_MS) {
      const keep = s.voiceMs >= MIN_VOICE_MS;
      const chunks = s.chunks;
      Object.assign(s, { inSpeech: false, chunks: [], run: 0, voiceMs: 0, quietMs: 0, totalMs: 0 });
      if (keep) cb.current(toWav(concat(chunks), io.current.ctx.sampleRate), 'auto');
    }
  }

  async function setHandsFree(on) {
    if (on && !(await open())) return;
    // Safari/iOS can hand back a suspended context after the permission prompt; then hands-free would hear nothing.
    if (on) await io.current.ctx.resume();
    Object.assign(v.current, { handsFree: on, inSpeech: false, chunks: [], run: 0 });
    setUi((u) => ({ ...u, handsFree: on }));
  }

  async function start(side) {
    if (!(await open())) return;
    await io.current.ctx.resume();
    Object.assign(v.current, { side, chunks: [], totalMs: 0, inSpeech: false });
    setUi((u) => ({ ...u, side }));
  }

  function stop() {
    const s = v.current;
    const side = s.side;
    if (!side) return;
    const chunks = s.chunks;
    Object.assign(s, { side: null, chunks: [], totalMs: 0 });
    setUi((u) => ({ ...u, side: null, voiced: false }));
    if (chunks.length * FRAME_MS >= 300) cb.current(toWav(concat(chunks), io.current.ctx.sampleRate), side);
  }

  // While Dubash is speaking, it must not interpret its own voice.
  function pause(on) {
    Object.assign(v.current, { paused: on, inSpeech: false, chunks: v.current.side ? v.current.chunks : [], run: 0 });
  }

  useEffect(
    () => () => {
      io.current?.stream.getTracks().forEach((t) => t.stop());
      io.current?.ctx.close();
    },
    []
  );

  return { ...ui, open, setHandsFree, start, stop, pause };
}

function concat(parts) {
  const out = new Float32Array(parts.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Downsample (box average) to 16 kHz and wrap as 16-bit PCM WAV.
export function toWav(samples, rate) {
  const ratio = rate / OUT_RATE;
  const n = Math.floor(samples.length / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const d = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  d.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, OUT_RATE, true);
  d.setUint32(28, OUT_RATE * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  str(36, 'data');
  d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += samples[j];
    const x = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
    d.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
