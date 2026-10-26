// 320 px check of the B5 screens (Home, Scan, Transactions) in all five languages: no sideways scrolling.
//   node scripts/layout-320-b5.mjs [baseUrl]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 320, height: 640 } });
const p = await ctx.newPage();
await p.goto(BASE);
await p.getByText('English', { exact: true }).click();
await p.getByRole('button', { name: 'Continue' }).click();
await p.getByText('Try the demo (Lerato)').click();
await p.waitForSelector('[data-testid=home-scan]', { timeout: 30000 });
let bad = 0, n = 0;
for (const lang of ['en', 'zu', 'xh', 'nso', 'af']) {
  await p.evaluate((l) => localStorage.setItem('zaka.locale', l), lang);
  for (const path of ['/', '/scan', '/transactions', '/add']) {
    await p.goto(BASE + path);
    await p.waitForTimeout(900);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    if (path === '/scan' && lang === 'zu' && !(await p.getByText('Thatha noma ulayishe isiliphu').count())) { bad++; console.log('language not applied'); }
    n++;
    if (w > 320) { bad++; console.log(`OVERFLOW ${lang} ${path}: ${w}px`); }
  }
}
console.log(`${n - bad}/${n} screen×language checks fit 320 px`);
await b.close();
process.exit(bad ? 1 : 0);
