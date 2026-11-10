// Run: node lib/slip.test.mjs
import assert from 'node:assert/strict';
import { encodeSlip, decodeSlip } from './slip.js';
import { DEMO } from './demo.js';

const payload = { l: 'te-IN', h: DEMO.note.take_home, d: 1 };
const code = await encodeSlip(payload);
assert.match(code, /^[A-Za-z0-9_-]+$/);
assert.deepEqual(await decodeSlip(code), payload);
console.log(`slip link: round-trips, ${code.length} chars for the demo slip`);
