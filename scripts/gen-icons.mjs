// Renders the hand-made coin mark to the PNG icons the PWA manifest needs (run once; output is committed).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const coin = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${40 + 2 * pad} ${40 + 2 * pad}"><rect x="${-pad}" y="${-pad}" width="${40 + 2 * pad}" height="${40 + 2 * pad}" fill="#006B64"/><circle cx="20" cy="20" r="18.5" fill="#C9A227"/><circle cx="20" cy="20" r="14.5" fill="none" stroke="#8C6D12" stroke-width="1.4" stroke-dasharray="1.6 2.2"/><path d="M15 29V11.5h6.2a4.9 4.9 0 0 1 0 9.8H15m6 0 5 7.7" fill="none" stroke="#102A43" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of [['icon-192.png', 192, 6], ['icon-512.png', 512, 6], ['icon-maskable-512.png', 512, 14], ['apple-touch-icon.png', 180, 8]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${coin(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: false });
}
await browser.close();
console.log('icons written');
