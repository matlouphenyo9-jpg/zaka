// B6: every error / warning / empty-state message a judge is likely to hit, in all five languages, at 320 px.
// Checks the text is a real sentence (not a raw key), differs from English outside English, and fits the screen.
//   node scripts/messages-5lang.mjs [baseUrl]   (needs: npm run build && npx vite preview --port 4173)
import { createRequire } from 'node:module';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
const ui = (l) => JSON.parse(readFileSync(new URL(`../src/i18n/ui.${l}.json`, import.meta.url), 'utf8'));
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const b = await chromium.launch();
const junk = `${mkdtempSync(`${tmpdir()}/zaka-`)}/not-a-slip.txt`;
writeFileSync(junk, 'this is just text, not a photo');
let bad = 0, n = 0;
const seen = {};
const check = (lang, what, text, width) => {
  n++;
  const t = (text ?? '').trim();
  const rawKey = /^[a-z]+(_[a-z0-9]+)+$/.test(t) || /\b(scan_err|err_|auth_|tx_)[a-z_]+\b/.test(t);
  const sameAsEn = lang !== 'en' && seen[what] === t;
  const fits = width <= 320;
  if (lang === 'en') seen[what] = t;
  const good = t.length > 3 && !rawKey && !sameAsEn && fits;
  if (!good) bad++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${lang} ${what}: ${t.slice(0, 90)}${!fits ? ` (page ${width}px wide)` : ''}${sameAsEn ? ' (same as English)' : ''}`);
};
for (const lang of ['en', 'zu', 'xh', 'nso', 'af']) {
  const ctx = await b.newContext({ viewport: { width: 320, height: 640 } });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.evaluate((l) => localStorage.setItem('zaka.locale', l), lang);
  await p.goto(BASE);
  // Wrong password: one generic message
  await p.locator('input[type=email]').fill('nobody@zaka-qa.test');
  await p.locator('input[type=password]').fill('wrongpass1');
  await p.locator('form button[type=submit]').click();
  const err = p.locator('form [role=alert], form .text-risk, [role=alert]').first();
  await err.waitFor({ timeout: 15000 });
  check(lang, 'wrong password', await err.innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Into the demo
  await p.locator('button:has(.bg-gold)').click();
  await p.waitForSelector('[data-testid=greeting]', { timeout: 30000 });
  // Type it: gibberish never reaches the AI
  await p.goto(`${BASE}/add`);
  await p.locator('#typeit').fill('asdkjhqwe zxcvbnm');
  await p.locator('#typeit').press('Enter');
  const typed = p.locator('main p.text-risk').first();
  await typed.waitFor({ timeout: 10000 });
  check(lang, 'Type it gibberish', await typed.innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Type it: a question for the AI is off topic (no AI call, nothing saved)
  await p.locator('#typeit').fill("what's the capital of France");
  await p.locator('#typeit').press('Enter');
  await p.waitForTimeout(300);
  check(lang, 'Type it off topic', await p.locator('main p.text-risk').first().innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Slip: a text file is refused on the phone
  await p.goto(`${BASE}/scan`);
  await p.getByTestId('scan-file').setInputFiles(junk);
  await p.getByTestId('scan-error').waitFor({ timeout: 10000 });
  check(lang, 'slip not a photo', await p.getByTestId('scan-error').innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Scam Shield: too short
  await p.goto(`${BASE}/safety`);
  await p.locator('textarea').first().fill('hi');
  await p.locator('textarea').first().press('Tab');
  await p.locator('main button:has(svg)').filter({ hasText: /./ }).and(p.locator('button.w-full')).first().click();
  const scamErr = p.getByTestId('scam-input-error');
  await scamErr.waitFor({ timeout: 10000 });
  check(lang, 'Scam Shield too short', await scamErr.innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Scam Shield: a request to the AI isn't a message to check (no AI call)
  await p.locator('textarea').first().fill('Write a poem about the ocean for me please');
  await p.locator('main button:has(svg)').filter({ hasText: /./ }).and(p.locator('button.w-full')).first().click();
  await p.waitForTimeout(300);
  check(lang, 'Scam Shield not a message', await p.getByTestId('scam-input-error').innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  // Transactions: empty filter
  await p.goto(`${BASE}/transactions`);
  await p.waitForSelector('[data-testid=tx-lines], main');
  await p.getByRole('button', { name: ui(lang).tx_range_custom, exact: true }).click(); // "Pick dates"
  const dates = p.locator('main input[type=date]');
  await dates.nth(0).fill('2024-01-01');
  await dates.nth(1).fill('2024-01-02');
  await p.waitForTimeout(400);
  const empty = p.locator('main .text-center p').last();
  check(lang, 'Transactions empty', await empty.innerText(), await p.evaluate(() => document.documentElement.scrollWidth));
  await ctx.close();
}
await b.close();
console.log(`\n${n - bad}/${n} message checks passed`);
process.exit(bad ? 1 : 0);
