// The take-home slip travels inside the QR link itself (URL fragment, deflated), so nothing is stored on a server
// and the fragment never reaches one.
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
