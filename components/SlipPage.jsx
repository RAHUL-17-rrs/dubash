'use client';
// Opened from the QR on the take-home slip, usually on a family member's phone.
import { useEffect, useState } from 'react';
import Slip from './Slip';
import { decodeSlip, slipText } from '@/lib/slip';
import baked from '@/public/demo/baked.json';

export default function SlipPage() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const code = location.hash.slice(1);
    if (!code) return setErr('This link has no slip in it.');
    decodeSlip(code).then(setP, () => setErr('This slip link is damaged. Ask the clinic to show the QR again.'));
  }, []);

  async function listen() {
    if (p.d && baked.files.includes('slip')) return new Audio('/demo/slip.mp3').play();
    const r = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slipText(p.h), lang: p.l, voice: 'Shivani' }),
    });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error || 'Audio is not available right now.');
    new Audio(URL.createObjectURL(await r.blob())).play();
  }

  return (
    <main className="slip-page">
      {err && <p className="warn">{err}</p>}
      {p && <Slip takeHome={p.h} lang={p.l} onListen={listen} />}
    </main>
  );
}
