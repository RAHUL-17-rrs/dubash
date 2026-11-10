// Screenshots of every screen, desktop and phone. Usage: BASE=http://localhost:3123 node scripts/shots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { encodeSlip } from '../lib/slip.js';
import { DEMO } from '../lib/demo.js';

const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [name, opts] of Object.entries(sizes)) {
  const page = await (await browser.newContext(opts)).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}-home.png`, fullPage: true });

  await page.goto(`${BASE}/consult`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}-setup.png`, fullPage: true });

  await page.goto(`${BASE}/consult?demo=1`, { waitUntil: 'networkidle' });
  const next = page.getByRole('button', { name: 'Next', exact: true });
  for (let i = 0; i < 10; i++) {
    await next.click();
    await page.waitForFunction(() => !document.querySelector('.turn.pending'), null, { timeout: 8000 });
  }
  await page.waitForTimeout(900); // let the transcript finish scrolling
  await page.screenshot({ path: `${OUT}/${name}-consult.png` });
  for (let i = 0; i < 2; i++) {
    await next.click(); // turns 11-12: the correction and the dose-lock catch
    await page.waitForFunction(() => !document.querySelector('.turn.pending'), null, { timeout: 8000 });
  }
  await next.click(); // teach-back
  await page.waitForSelector('.checks', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}-teachback.png` });
  await next.click(); // wrap-up
  await page.waitForSelector('.slip-qr img', { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/${name}-wrap.png` });
  await page.locator('.wrap-in').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.screenshot({ path: `${OUT}/${name}-wrap-card.png` });
  // the QR link opens the slip on its own page
  const src = await page.locator('.slip-qr img').getAttribute('src');
  if (!src.startsWith('data:image/png')) throw new Error('QR missing');
  // what the family sees after scanning the QR
  await page.goto(`${BASE}/slip#${await encodeSlip({ l: 'te-IN', h: DEMO.note.take_home, d: 1 })}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pills');
  await page.screenshot({ path: `${OUT}/${name}-slip-page.png`, fullPage: true });
  console.log(name, errors.length ? `errors: ${errors.join(' | ')}` : 'no console errors');
}
await browser.close();
