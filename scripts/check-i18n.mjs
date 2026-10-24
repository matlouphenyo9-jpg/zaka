// Key parity + placeholder checks for every locale (D4 files and the ui.* namespace files).
import { readFileSync, existsSync } from 'node:fs';
const LOCALES = ['zu', 'xh', 'nso', 'af'];
const load = (p) => JSON.parse(readFileSync(new URL(`../src/i18n/${p}`, import.meta.url), 'utf8'));
const ph = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');
let errors = 0;
function compare(base, other, label, missingIsWarning = false) {
  const missing = [];
  for (const k of Object.keys(base)) {
    if (k.startsWith('_') || k === 'language' || k === 'status') continue;
    if (!(k in other)) {
      if (missingIsWarning) missing.push(k);
      else { console.log(`${label}: missing ${k}`); errors++; }
      continue;
    }
    if (ph(base[k]) !== ph(other[k])) { console.log(`${label}: placeholder mismatch in ${k}: ${ph(base[k])} vs ${ph(other[k])}`); errors++; }
  }
  for (const k of Object.keys(other)) if (!(k in base) && !k.startsWith('_')) { console.log(`${label}: extra key ${k}`); errors++; }
  if (missing.length) console.log(`${label}: ${missing.length} newer key(s) not translated yet (English fallback): ${missing.join(', ')}`);
}
const en = load('en.json');
for (const l of LOCALES) compare(en, load(`${l}.json`), `${l}.json`);
const uiEn = load('ui.en.json');
for (const l of LOCALES) {
  if (existsSync(new URL(`../src/i18n/ui.${l}.json`, import.meta.url))) compare(uiEn, load(`ui.${l}.json`), `ui.${l}.json`, true);
  else console.log(`ui.${l}.json: not translated yet (English fallback)`);
}
console.log(errors ? `${errors} problem(s)` : 'i18n OK');
process.exit(errors ? 1 : 0);
