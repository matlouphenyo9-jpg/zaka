// Captures the judge-facing screenshots (docs/screenshots/) from a running build at phone size, 390×844 @2x.
// Uses the real demo account and the live Edge Functions, so the AI steps (Type it, Scam Shield) are real.
//   npm run build && npx vite preview --port 4173   (in another shell)
//   node scripts/screenshots.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-ZA' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

const settle = (ms = 700) => p.waitForTimeout(ms);
const shot = async (name) => {
  await settle();
  await p.screenshot({ path: `${OUT}${name}.png` });
  console.log('saved', name);
};
const toastGone = () => p.waitForTimeout(4000); // toasts close after 3.6 s
const tabs = p.locator('nav a');
const top = () => p.evaluate(() => window.scrollTo(0, 0));
// Scroll an element to just below the sticky header.
const scrollTo = (loc) => loc.first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 84));
const aiDone = () => p.waitForFunction(() => !/Explaining in your language|Kuchazwa ngolwimi lwakho/.test(document.body.innerText), null, { timeout: 45000 });

// 1. Language picker
await p.goto(BASE);
await p.getByText('English', { exact: true }).waitFor();
await shot('01-language');
await p.getByText('English', { exact: true }).click();
await p.getByRole('button', { name: 'Continue' }).click();

// 2. Home
await p.getByText('Try the demo (Lerato)').click();
await p.waitForSelector('[data-testid=safe-amount]', { timeout: 30000 });
await p.waitForSelector('[data-testid=shortfall]');
await settle(1500);
await shot('02-home');

// 3. Add: type a sentence, let the AI fill the form, save and show the impact
await tabs.nth(1).click();
const typeIt = p.getByPlaceholder('e.g. got R350 from a piece job');
await typeIt.fill('got R350 from a piece job');
await typeIt.evaluate((el) => { el.blur(); el.scrollLeft = 0; });
await shot('03-add-typed');
await p.getByRole('button', { name: 'Fill the form' }).click();
await p.getByText('Check these details before saving.').waitFor({ timeout: 30000 });
await shot('04-add-filled');
await p.getByRole('button', { name: 'Save' }).click();
await p.getByText('Your tight day moved').waitFor({ timeout: 15000 });
await toastGone();
await top();
await shot('05-add-saved');

// 4. Plan and "Why this estimate?"
await tabs.nth(2).click();
await top();
await shot('06-plan');
await p.getByRole('button', { name: 'Why this estimate?' }).click();
await shot('07-why');
await p.keyboard.press('Escape');
await settle();

// 5. Scam Shield on the SASSA example (rules on the phone + AI explanation)
await tabs.nth(3).click();
await p.getByText('Try example 2').click();
await aiDone();
await scrollTo(p.getByText('High risk'));
await shot('08-scam-en');

// 6. Loan Check above the legal maximum (unsecured loan, R5,000, 35% a year, R700 initiation, R69 service fee)
await top();
await p.getByRole('radio', { name: 'Loan Check' }).click();
await p.selectOption('#loan-type', 'unsecured');
await p.getByLabel('Amount borrowed (R)').fill('5000');
await p.getByRole('radio', { name: '% per year' }).click();
await p.getByLabel('Interest rate (% per year)').fill('35');
await p.getByLabel('Term (months)').fill('12');
await p.getByLabel('Initiation fee (R)').fill('700');
await p.getByLabel('Service fee a month (R)').fill('69');
await p.getByRole('button', { name: 'Show total cost' }).click();
await scrollTo(p.getByText('You would pay back'));
await shot('09-loan-above-max');

// 7. Me / language switch
await tabs.nth(4).click();
await top();
await shot('10-me-language');

// 8. Scam Shield in isiXhosa
await p.getByRole('button', { name: /isiXhosa/ }).click();
await settle();
await tabs.nth(3).click();
await top();
await p.getByRole('radio').first().click();
await p.getByText('Zama umzekelo 2').click();
await aiDone();
await scrollTo(p.getByText('Umngcipheko omkhulu'));
await shot('11-scam-xh');

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
