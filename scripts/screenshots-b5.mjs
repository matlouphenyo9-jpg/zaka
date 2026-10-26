// B5 screenshots and a browser check of the slip flow on the demo account (real scan of a bundled SAMPLE slip):
// 12-snap-slip, 13-slip-filled, 14-transactions. Fails if saving a slip doesn't change "Money you have now".
//   npm run build && npx vite preview --port 4173   (in another shell)
//   node scripts/screenshots-b5.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-ZA' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const settle = (ms = 700) => p.waitForTimeout(ms);
const shot = async (name) => { await settle(); await p.screenshot({ path: `${OUT}${name}.png` }); console.log('saved', name); };
let fails = 0;
const check = (name, cond) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

await p.goto(BASE);
await p.getByText('English', { exact: true }).click();
await p.getByRole('button', { name: 'Continue' }).click();
await p.getByText('Try the demo (Lerato)').click();
await p.waitForSelector('[data-testid=safe-amount]', { timeout: 30000 });
await settle(1500);
const balance0 = await p.locator('[data-testid=balance-now]').innerText();
const safe0 = await p.locator('[data-testid=safe-amount]').innerText();
const scanBtn = p.locator('[data-testid=home-scan]');
check('Home: slip button is the main action', await scanBtn.isVisible() && (await scanBtn.boundingBox()).height >= 60);

await scanBtn.click();
await p.waitForSelector('[data-testid=sample-spaza]');
await shot('12-snap-slip');
await p.locator('[data-testid=sample-spaza]').click();
await p.waitForSelector('[data-testid=scan-check], [data-testid=scan-error]', { timeout: 60000 });
check('sample slip read and form filled', await p.locator('[data-testid=scan-check]').isVisible());
check('total R187.45 pre-filled', (await p.locator('[data-testid=scan-amount-0]').inputValue()) === '187.45');
await p.locator('[data-testid=scan-items] summary').click();
await settle();
await p.evaluate(() => window.scrollTo(0, 0));
await shot('13-slip-filled');
await p.locator('[data-testid=scan-save]').click();
await p.waitForSelector('[data-testid=scan-saved]');
check('saved from the slip', true);
await p.getByRole('button', { name: 'Home' }).click();
await p.waitForSelector('[data-testid=balance-now]');
await settle(800);
const balance1 = await p.locator('[data-testid=balance-now]').innerText();
const safe1 = await p.locator('[data-testid=safe-amount]').innerText();
check(`Money you have now changed (${balance0} → ${balance1})`, balance0 !== balance1);
check(`Safe to spend changed (${safe0} → ${safe1})`, safe0 !== safe1);

await p.locator('[data-testid=home-transactions]').click();
await p.waitForSelector('[data-testid=tx-lines]');
check('Transactions: 📸 badge on the slip entry', (await p.getByText('📸').count()) >= 1);
check('Transactions: summary line "Food: … this month, … total"', /Food: .*this month, R.* total/.test(await p.locator('[data-testid=tx-lines]').innerText()));
await p.getByRole('button', { name: 'Electricity', exact: false }).first().click();
await settle();
check('category filter shows only electricity lines', (await p.locator('[data-testid=tx-lines] li').allInnerTexts()).every((t) => t.startsWith('Electricity')));
await p.getByRole('button', { name: 'Electricity', exact: false }).first().click();
await shot('14-transactions');
check('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
