// Records the demo story from the real app (isiXhosa) as PNG frame sequences + tap coordinates for the Remotion video.
// Needs a running build (npx vite preview --port 4173) and network access to Supabase (live demo account + AI).
//   node video/capture.mjs [baseUrl]   → video/public/rec/<scene>/NNN.png and video/src/rec.json
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const ROOT = new URL('./public/rec/', import.meta.url).pathname;
const i18n = (f) => JSON.parse(readFileSync(new URL(`../src/i18n/${f}`, import.meta.url), 'utf8'));
const xh = { ...i18n('xh.json'), ...i18n('ui.xh.json') };
const t = (k) => {
  if (!xh[k]) throw new Error(`missing xh string ${k}`);
  return xh[k];
};

rmSync(ROOT, { recursive: true, force: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-ZA' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

const meta = {};
let scene = '';
let n = 0;
const start = (name) => {
  scene = name;
  n = 0;
  meta[name] = { frames: 0, taps: [], marks: {} };
  mkdirSync(ROOT + name, { recursive: true });
};
const frame = async () => {
  await p.screenshot({ path: `${ROOT}${scene}/${String(n).padStart(3, '0')}.png` });
  n++;
  meta[scene].frames = n;
};
const mark = (label) => (meta[scene].marks[label] = n); // index of the next frame
const settle = (ms = 600) => p.waitForTimeout(ms);
// Records where a tap lands (centre of the element, CSS px) and on which frame index it happens.
const tap = async (loc) => {
  const b = await loc.first().boundingBox();
  const visible = await loc.first().evaluate((el, [x, y]) => { const hit = document.elementFromPoint(x, y); return !!hit && (el === hit || el.contains(hit)); }, [b.x + b.width / 2, b.y + b.height / 2]);
  if (!visible) throw new Error(`tap target hidden or off screen in ${scene} at frame ${n}`);
  meta[scene].taps.push({ at: n, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  await loc.first().click();
};
const tabs = p.locator('nav a');
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Real scrolling captured as frames, eased, to `target` (px from top).
const scrollFrames = async (target, count) => {
  const from = await p.evaluate(() => window.scrollY);
  for (let i = 1; i <= count; i++) {
    const y = Math.round(from + (target - from) * ease(i / count));
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(30);
    await frame();
  }
};
const yOf = (loc) => loc.first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 84);
const aiDone = () => p.waitForFunction((s) => !document.body.innerText.includes(s), t('scam_explaining'), { timeout: 45000 });

// 1. Pick isiXhosa
start('pick');
await p.goto(BASE);
await p.getByText('isiXhosa', { exact: true }).waitFor();
await settle();
await frame();
await tap(p.getByText('isiXhosa', { exact: true }));
await settle(400);
await frame();
await tap(p.getByRole('button', { name: t('continue') }));
await settle();
await frame(); // sign-in screen, in isiXhosa

// 2. Try the demo
start('demo');
await frame();
await tap(p.locator('button:has(.bg-gold)'));
await p.waitForSelector('[data-testid=safe-amount]', { timeout: 30000 });
await p.waitForSelector('[data-testid=shortfall]');
await settle(1500);
await frame();
meta.demo.home = {
  safe: await p.locator('[data-testid=safe-amount]').innerText(),
  shortfall: await p.locator('[data-testid=shortfall]').innerText(),
};

// 3. Type the piece job, let AI fill the form, save
start('type');
await tap(tabs.nth(1));
await settle();
await frame();
const input = p.getByPlaceholder(t('type_it_hint'));
const sentence = t('type_it_hint').replace(/^umz\.\s*/, ''); // the app's own example sentence
await tap(input);
for (const ch of sentence) {
  await input.press(ch === ' ' ? 'Space' : ch);
  await frame();
}
mark('fill');
await tap(p.getByRole('button', { name: t('type_it_go') }));
await frame(); // "reading…"
await p.getByText(t('confirm_parse')).waitFor({ timeout: 30000 });
await settle();
await frame();
meta.type.filled = { amount: await p.locator('main').innerText().then((s) => (s.match(/R\s?\d[\d\s]*/) ?? [''])[0]) };
await scrollFrames(await yOf(p.getByRole('button', { name: t('save') })) - 420, 18);
mark('save');
await tap(p.getByRole('button', { name: t('save') }));
await p.waitForTimeout(900); // smooth scroll to top
await p.waitForFunction(() => !document.querySelector('[role=status]'), null, { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(3200);
await frame();
meta.type.impact = await p.locator('main .bg-teal-soft, main [class*=teal]').first().innerText().catch(() => '');

// 4. Plan and Why this estimate?
start('why');
await tap(tabs.nth(2));
await p.evaluate(() => window.scrollTo(0, 0));
await settle();
await frame();
await tap(p.getByRole('button', { name: t('why') }));
await settle(800);
await frame();

// 5. Scam Shield on the SASSA example
start('scam');
await p.keyboard.press('Escape');
await settle();
await tap(tabs.nth(3));
await settle();
const example = p.getByText(t('scam_example').replace('{n}', '2'));
await p.evaluate((y) => window.scrollTo(0, y), await yOf(example) - 380);
await settle();
await frame();
await tap(example);
await settle(500);
await frame(); // rules result + explaining…
await aiDone();
await settle();
await frame();
await scrollFrames(await yOf(p.getByTestId('scam-level')), 30);
await settle(300);
await frame();
await scrollFrames(await yOf(p.getByText(t('scam_next_step'))), 30);
await frame();

// 6. Loan Check above the legal maximum
start('loan');
await p.evaluate(() => window.scrollTo(0, 0));
await settle(300);
await frame(); // Safety screen top, with the Loan Check tab
await tap(p.getByRole('radio').nth(1));
await settle();
await p.selectOption('#loan-type', 'unsecured');
const dec = p.locator('main input[inputmode=decimal]');
await dec.nth(0).fill('5000');
await p.getByRole('radio').nth(3).click(); // % per year
await dec.nth(1).fill('35');
await p.locator('main input[inputmode=numeric]').first().fill('12');
await dec.nth(2).fill('700');
await dec.nth(3).fill('69');
await settle();
await frame();
const showTotal = p.getByRole('button', { name: t('show_total') });
await scrollFrames(await yOf(showTotal) - 380, 24);
await tap(showTotal);
await settle(500);
await frame();
await scrollFrames(await yOf(p.getByTestId('loan-total')) - 24, 30);
await settle(300);
await frame();

writeFileSync(new URL('./src/rec.json', import.meta.url), JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, { frames: v.frames, taps: v.taps.length, ...('home' in v ? { home: v.home } : {}), ...('impact' in v ? { impact: v.impact } : {}) }])), null, 1));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
