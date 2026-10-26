// Renders public/og.png (1200×630), the WhatsApp/Twitter link preview: logo, tagline, address. Made in code.
//   node scripts/gen-og.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const logo = `<svg width="520" height="130" viewBox="0 0 176 44"><g transform="translate(0 4)"><circle cx="18" cy="20" r="17.5" fill="#C9A227"/><circle cx="18" cy="20" r="13.6" fill="none" stroke="#8C6D12" stroke-width="1.3" stroke-dasharray="1.5 2.1"/><path d="M13.2 28.5V11.8h5.9a4.7 4.7 0 0 1 0 9.4h-5.9m5.7 0 4.8 7.3" fill="none" stroke="#102A43" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g><g fill="none" stroke="#FAF8F2" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"><path d="M48 16h18L48 39h18"/><circle cx="86.5" cy="27.5" r="11.5"/><path d="M98 16v23"/><path d="M110 5v34M127 16l-14 12.5M118.5 24l10 15"/><circle cx="149.5" cy="27.5" r="11.5"/><path d="M161 16v23"/></g></svg>`;
const html = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#102A43;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;right:-140px;top:-140px;width:560px;height:560px;border-radius:50%;background:#C9A227;opacity:.09"></div>
<div style="position:absolute;left:96px;top:120px">${logo}
<div style="margin-top:46px;color:#FAF8F2;font-size:68px;font-weight:700;letter-spacing:-1px">Every rand, with a plan.</div>
<div style="margin-top:22px;color:#9FE3D9;font-size:34px;font-weight:600">Safe to spend · tight-day warnings · scam &amp; loan checks</div>
<div style="margin-top:48px;color:#FAF8F2;opacity:.8;font-size:30px">zaka.pages.dev</div></div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname });
await b.close();
console.log('public/og.png');
