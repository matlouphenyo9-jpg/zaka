// Records the "Snap or upload a slip" opening (isiXhosa, real app, live demo account, live AI) as frames in
// public/rec/slip and merges its taps/marks into src/rec.json. The rest of the story keeps its earlier recording:
// a fresh "Try the demo" resets Lerato's data first, so the slip saved here doesn't change those scenes' numbers.
//   node video/capture-slip.mjs [baseUrl]   (needs: npm run build && npx vite preview --port 4173)
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const ROOT = new URL('./public/rec/slip/', import.meta.url).pathname;
const REC = new URL('./src/rec.json', import.meta.url);
const i18n = (f) => JSON.parse(readFileSync(new URL(`../src/i18n/${f}`, import.meta.url), 'utf8'));
const xh = { ...i18n('xh.json'), ...i18n('ui.xh.json') };
const t = (k) => {
  if (!xh[k]) throw new Error(`missing xh string ${k}`);
  return xh[k];
};

rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-ZA' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

const meta = { frames: 0, taps: [], marks: {} };
let n = 0;
const frame = async () => {
  await p.screenshot({ path: `${ROOT}${String(n).padStart(3, '0')}.png` });
  n++;
  meta.frames = n;
};
const mark = (label) => (meta.marks[label] = n);
const settle = (ms = 600) => p.waitForTimeout(ms);
const tap = async (loc) => {
  const b = await loc.first().boundingBox();
  const visible = await loc.first().evaluate((el, [x, y]) => { const hit = document.elementFromPoint(x, y); return !!hit && (el === hit || el.contains(hit)); }, [b.x + b.width / 2, b.y + b.height / 2]);
  if (!visible) throw new Error(`tap target hidden or off screen at frame ${n}`);
  meta.taps.push({ at: n, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  await loc.first().click();
};
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const scrollFrames = async (target, count) => {
  const from = await p.evaluate(() => window.scrollY);
  for (let i = 1; i <= count; i++) {
    await p.evaluate((v) => window.scrollTo(0, v), Math.round(from + (target - from) * ease(i / count)));
    await p.waitForTimeout(30);
    await frame();
  }
};
const yOf = (loc) => loc.first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 84);

// Into the demo in isiXhosa (a fresh reset of Lerato's data).
await p.goto(BASE);
await p.evaluate(() => localStorage.setItem('zaka.locale', 'xh'));
await p.reload();
await p.locator('button:has(.bg-gold)').click();
await p.waitForSelector('[data-testid=home-scan]', { timeout: 30000 });
await settle(1500);
meta.home = { balance: await p.locator('[data-testid=balance-now]').innerText(), safe: await p.locator('[data-testid=safe-amount]').innerText() };

await frame(); // 0: Home, slip button is the main action
mark('home');
await tap(p.getByTestId('home-scan'));
await settle();
await frame(); // 1: Snap or upload a slip, with the samples
mark('pick');
await tap(p.getByTestId('sample-spaza'));
await p.waitForTimeout(250);
await frame(); // 2: reading your slip…
mark('reading');
await p.waitForSelector('[data-testid=scan-check]', { timeout: 60000 });
await settle(500);
await frame(); // 3: filled form
mark('filled');
meta.filled = { amount: await p.getByTestId('scan-amount-0').inputValue() };
await scrollFrames(await yOf(p.getByTestId('scan-save')) - 520, 26);
mark('save');
await tap(p.getByTestId('scan-save'));
await p.waitForSelector('[data-testid=scan-saved]');
await p.waitForTimeout(1200); // smooth scroll back to the top
await frame(); // saved: safe to spend before → after
mark('saved');
meta.saved = await p.getByTestId('scan-saved').locator('xpath=..').innerText();
await tap(p.getByRole('button', { name: t('tx_title') }));
await p.waitForSelector('[data-testid=tx-lines]');
await settle(800);
await frame(); // Transactions top
mark('tx');
await scrollFrames(await yOf(p.getByTestId('tx-lines')) - 200, 28);
await settle(300);
await frame(); // summary lines
mark('txLines');
meta.lines = await p.getByTestId('tx-lines').innerText();

const rec = JSON.parse(readFileSync(REC, 'utf8'));
const ordered = { slip: meta, ...Object.fromEntries(Object.entries(rec).filter(([k]) => k !== 'slip')) };
writeFileSync(REC, JSON.stringify(ordered, null, 2) + '\n');
console.log(JSON.stringify({ frames: meta.frames, marks: meta.marks, home: meta.home, filled: meta.filled, saved: meta.saved, lines: meta.lines }, null, 1));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
