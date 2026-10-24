// Writes src/i18n/cldr-dates.json: CLDR weekday/month names and date layouts for locales whose data many
// browsers don't ship (Chromium has none for zu, xh, nso and falls back to English). Read from Node's full ICU,
// so the names are CLDR's, not ours. Re-run after a Node/ICU upgrade:  node scripts/gen-cldr-dates.mjs
import { writeFileSync } from 'node:fs';

const LOCALES = ['zu', 'xh', 'nso'];
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const SUNDAY = utc(2026, 9, 25);

// Turns formatToParts output into a template with {w} weekday, {d} day, {m} month, {y} year.
function template(locale, opts) {
  const parts = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).formatToParts(utc(2026, 9, 27));
  const token = { weekday: '{w}', day: '{d}', month: '{m}', year: '{y}' };
  return parts.map((p) => token[p.type] ?? p.value).join('');
}

const out = { _source: `CLDR ${process.versions.cldr} via ICU ${process.versions.icu} (Node ${process.version})` };
for (const l of LOCALES) {
  if (!Intl.DateTimeFormat.supportedLocalesOf([l]).length) throw new Error(`Node has no ICU data for ${l}`);
  const day = (i, weekday) => new Intl.DateTimeFormat(l, { timeZone: 'UTC', weekday }).format(new Date(SUNDAY.getTime() + i * 86_400_000));
  out[l] = {
    weekdays: Array.from({ length: 7 }, (_, i) => day(i, 'long')),
    weekdaysShort: Array.from({ length: 7 }, (_, i) => day(i, 'short')),
    monthsShort: Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(l, { timeZone: 'UTC', month: 'short' }).format(utc(2026, m, 1))),
    short: template(l, { weekday: 'short', day: 'numeric', month: 'short' }),
    long: template(l, { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}
writeFileSync(new URL('../src/i18n/cldr-dates.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(out);
