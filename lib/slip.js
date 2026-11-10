// The take-home slip travels inside the QR link itself (URL fragment, deflated), so nothing is stored on a server
// and the fragment never reaches one.
import { numberTokens, drugKey } from './medical.js';

// "Ask the slip" at home: an answer is only spoken if the model said it found it on the slip AND every number in
// the answer is a number printed on the slip. Anything else becomes the fixed "ask your doctor" line.
export function groundAnswer({ found, answer }, h, fallback) {
  const onSlip = new Set(numberTokens(JSON.stringify(h)));
  const invented = numberTokens(answer || '').filter((n) => !onSlip.has(n));
  const ok = Boolean(found) && Boolean(answer?.trim()) && invented.length === 0;
  return { found: ok, answer: ok ? answer.trim() : fallback, invented };
}

// "Show the strip": what the camera read against what the doctor prescribed. The model only reads the foil;
// the match itself is decided here. Brand names differ from the slip, so the generic name is tried too.
export function matchStrip(read, medicines) {
  if (!read?.readable) return { status: 'unreadable' };
  const keys = new Set([read.generic, read.brand].flatMap((n) => String(n || '').toLowerCase().match(/[a-z]{4,}/g) || []));
  const med = medicines.find((m) => keys.has(drugKey(m.name)));
  if (!med) return { status: 'not_on_slip', read };
  const want = numberTokens(med.name);
  const have = new Set(numberTokens(read.strength));
  // A slip line with no strength ("BP tablet") cannot contradict the strip.
  if (want.length && have.size && !want.some((n) => have.has(n))) return { status: 'wrong_strength', med, read };
  return { status: 'match', med, read };
}

export function slipText(h) {
  return [h.greeting, ...h.medicines.map((m) => `${m.name}. ${m.how}`), ...h.tests, ...h.come_back_if, h.next_visit].join(' ');
}

export async function encodeSlip(payload) {
  const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeSlip(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}
