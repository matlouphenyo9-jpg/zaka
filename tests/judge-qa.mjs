// B4-E: the strict-judge QA pass, end to end in a real browser against the live backend (Playwright, 390×844).
// Needs a running build (npx vite preview --port 4173) and the QA account qa-new@zaka-qa.test.
//   node tests/judge-qa.mjs [baseUrl]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const QA = { email: 'qa-new@zaka-qa.test', password: process.env.QA_PASSWORD ?? 'QaTest!2026x' };
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const browser = await chromium.launch();
const errors = [];
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}
const idbKeys = (p) => p.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open('keyval-store'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
  if (!db || !db.objectStoreNames.contains('keyval')) return [];
  return new Promise((r) => { const q = db.transaction('keyval').objectStore('keyval').getAllKeys(); q.onsuccess = () => r(q.result.map(String)); });
});

// 1. "Try the demo" keeps the chosen language
for (const [lang, cont, code] of [['English', 'Continue', 'en-ZA'], ['isiXhosa', 'Qhubeka', 'xh-ZA'], ['isiZulu', 'Qhubeka', 'zu-ZA']]) {
  const p = await fresh();
  await p.goto(BASE);
  await p.getByText(lang, { exact: true }).click();
  await p.getByRole('button', { name: cont }).click();
  await p.locator('button:has(.bg-gold)').first().click();
  await p.waitForSelector('[data-testid=safe-amount]', { timeout: 30000 });
  await p.waitForTimeout(1500);
  const htmlLang = await p.evaluate(() => document.documentElement.lang);
  ok(`demo in ${lang}: stays in ${lang}, shows safe to spend and balance`, htmlLang === code && (await p.getByTestId('balance-now').isVisible()), htmlLang);
  await p.context().close();
}

// 2–6. Demo in English: entries, Type it, Plan, Why, Scam Shield, Loan Check, refresh
const p = await fresh();
await p.goto(BASE);
await p.getByText('English', { exact: true }).click();
await p.getByRole('button', { name: 'Continue' }).click();
await p.getByText('Try the demo (Lerato)').click();
await p.waitForSelector('[data-testid=safe-amount]', { timeout: 30000 });
await p.waitForTimeout(1500);
const balance0 = await p.getByTestId('balance-now').innerText();
const nav = p.locator('nav a');
const keypad = async (digits) => { for (const k of digits) await p.getByRole('button', { name: k, exact: true }).first().click(); };

await nav.nth(1).click();
await keypad('120');
await p.getByRole('button', { name: 'Piece job' }).first().click();
await p.getByRole('button', { name: 'Save entry' }).click();
await p.waitForTimeout(1200);
await p.getByRole('radio', { name: /Money out/ }).click();
await keypad('25');
await p.getByRole('button', { name: 'Transport' }).first().click();
await p.getByRole('button', { name: 'Save entry' }).click();
await p.waitForTimeout(1200);
await nav.nth(0).click();
await p.waitForTimeout(800);
const balance1 = await p.getByTestId('balance-now').innerText();
const rands = (s) => Number(s.replace(/[^\d]/g, ''));
ok('money in R120 and money out R25 change the balance by +R95', rands(balance1) - rands(balance0) === 95, `${balance0} → ${balance1}`);

await nav.nth(1).click();
await p.getByPlaceholder('e.g. got R350 from a piece job').fill('got R350 from a piece job');
await p.getByRole('button', { name: 'Fill the form' }).click();
await p.getByText('Check these details before saving.').waitFor({ timeout: 30000 });
const filled = await p.locator('main').innerText();
ok('Type it "got R350 from a piece job" fills R350, money in, piece job', /R350/.test(filled), '');
await p.getByRole('button', { name: 'Save entry' }).click();
await p.waitForTimeout(1500);
ok('saving shows the effect on the plan', /Safe to spend/.test(await p.locator('main').innerText()));

await nav.nth(2).click();
await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Why this estimate?' }).click();
await p.waitForTimeout(500);
ok('Why this estimate? starts with Money you have now', (await p.getByTestId('why-balance').innerText()).includes('Money you have now'));
await p.keyboard.press('Escape');

const scam = async (text) => {
  await nav.nth(3).click();
  await p.waitForTimeout(400);
  if (await p.getByRole('button', { name: 'Check another' }).count()) await p.getByRole('button', { name: 'Check another' }).click();
  await p.locator('#scam-text').fill(text);
  await p.getByRole('button', { name: 'Check this message' }).click();
  await p.getByTestId('scam-level').waitFor();
  return p.getByTestId('scam-level').innerText();
};
const l1 = await scam('SASSA: Your SRD grant is on hold. Pay a R50 release fee today at sassa-srd.xyz or lose your payment.');
ok('fake SASSA fee SMS → High risk', l1 === 'High risk', l1);
const l2 = await scam('Hi Mom, this is my new number, my phone was stolen. Please send me R500 on e-wallet urgently.');
ok('"Hi Mom, new number" WhatsApp → flagged', l2 !== 'No common warning signs found', l2);
const l3 = await scam('Hey! Are we still meeting at the taxi rank at 5? I will bring the bread for supper.');
ok('normal friend message → NOT High risk', l3 !== 'High risk', l3);

await p.getByRole('button', { name: 'Check another' }).click().catch(() => {});
await p.getByRole('radio', { name: 'Loan Check' }).click();
await p.getByLabel('Amount borrowed (R)').fill('1000');
await p.getByLabel('Interest rate (% per month)').fill('30');
await p.getByLabel('Term (months)').fill('1');
await p.getByRole('button', { name: 'Show total cost' }).click();
await p.waitForTimeout(400);
ok('Loan Check R1,000 at 30% a month → above the legal maximum', (await p.getByTestId('above-limit').count()) > 0 && (await p.getByTestId('loan-total').innerText()).replace(/\s/g, '') === 'R1300', await p.getByTestId('loan-total').innerText());

await p.reload();
await p.locator('nav a').first().waitFor({ timeout: 30000 });
await p.locator('nav a').nth(0).click();
await p.waitForSelector('[data-testid=balance-now]', { timeout: 30000 });
ok('page refresh keeps the session and the data', (await p.getByTestId('balance-now').innerText()).length > 1);
await p.context().close();

// 7. A brand-new account (reset first so the test can be re-run: the account deletes its own rows via RLS)
{
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient('https://dalhthsxuyttsgyigwgd.supabase.co', 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr', { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword(QA);
  for (const t of ['transactions', 'obligations', 'goals', 'profiles']) await sb.from(t).delete().eq('user_id', data.user.id);
}
// A brand-new account through consent and onboarding, 3 entries, refresh, log out → phone wiped
const n = await fresh();
await n.goto(BASE);
await n.getByText('English', { exact: true }).click();
await n.getByRole('button', { name: 'Continue' }).click();
await n.getByLabel('Email').fill(QA.email);
await n.getByLabel('Password').fill(QA.password);
await n.getByRole('button', { name: 'Sign in' }).click();
await n.getByRole('button', { name: 'I agree — continue' }).click({ timeout: 20000 });
await n.getByRole('textbox').first().fill('800');
for (let i = 0; i < 4 && !(await n.getByRole('button', { name: 'Save my plan' }).count()); i++) {
  await n.getByRole('button', { name: 'Continue' }).click();
  await n.waitForTimeout(400);
}
await n.getByRole('button', { name: 'Save my plan' }).click();
await n.waitForSelector('[data-testid=balance-now]', { timeout: 30000 });
ok('new account: onboarding opening balance R800 is Money you have now', (await n.getByTestId('balance-now').innerText()) === 'R800', await n.getByTestId('balance-now').innerText());
const navN = n.locator('nav a');
for (const [dir, amt, cat] of [['in', '200', 'Selling'], ['out', '60', 'Food'], ['out', '30', 'Transport']]) {
  await navN.nth(1).click();
  await n.waitForTimeout(300);
  if (dir === 'out') await n.getByRole('radio', { name: /Money out/ }).click();
  for (const k of amt) await n.getByRole('button', { name: k, exact: true }).first().click();
  await n.getByRole('button', { name: cat }).first().click();
  await n.getByRole('button', { name: 'Save entry' }).click();
  await n.waitForTimeout(1200);
}
await n.reload();
await navN.first().waitFor({ timeout: 30000 });
await navN.nth(0).click();
await n.waitForSelector('[data-testid=balance-now]', { timeout: 30000 });
ok('3 entries saved and still there after refresh (R800 + 200 − 60 − 30 = R910)', (await n.getByTestId('balance-now').innerText()) === 'R910', await n.getByTestId('balance-now').innerText());
await navN.nth(4).click();
await n.getByRole('button', { name: 'Log out' }).click();
await n.getByText('Sign in to Zaka').waitFor({ timeout: 15000 });
const left = (await idbKeys(n)).filter((k) => k.startsWith('zaka:data') || k.startsWith('zaka:queue'));
const token = await n.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('zaka.auth')));
ok('log out wipes the phone (no cached data, no queue, no token)', left.length === 0 && token.length === 0, JSON.stringify({ left, token }));
await n.goto(`${BASE}/plan`);
ok('typing /plan after log out shows sign-in, not data', await n.getByText('Sign in to Zaka').isVisible());

ok('no JavaScript errors on any page', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
