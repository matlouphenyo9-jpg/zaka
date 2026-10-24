import { bcp47 } from '../i18n';
import cldr from '../i18n/cldr-dates.json';
import { toUTC, type ISODate } from './dates';

type CldrDates = { weekdays: string[]; weekdaysShort: string[]; monthsShort: string[]; short: string; long: string };
const TABLES = cldr as unknown as Record<string, CldrDates | undefined>;

// Many browsers (Chromium included) ship no date data for zu, xh or nso and silently fall back to US English.
// Use the browser's data when it has the locale, then the bundled CLDR names, then South African English.
function source(): { locale: string } | { table: CldrDates } {
  const want = bcp47();
  try {
    if (Intl.DateTimeFormat.supportedLocalesOf([want]).length) return { locale: want };
  } catch {
    /* fall through */
  }
  const table = TABLES[want.split('-')[0]];
  return table ? { table } : { locale: 'en-ZA' };
}

function fmt(d: ISODate, opts: Intl.DateTimeFormatOptions, layout: (t: CldrDates, date: Date) => string): string {
  const date = new Date(toUTC(d));
  const src = source();
  return 'table' in src ? layout(src.table, date) : new Intl.DateTimeFormat(src.locale, { timeZone: 'UTC', ...opts }).format(date);
}

const fill = (tpl: string, t: CldrDates, date: Date, weekdays: string[]) =>
  tpl
    .replace('{w}', weekdays[date.getUTCDay()])
    .replace('{d}', String(date.getUTCDate()))
    .replace('{m}', t.monthsShort[date.getUTCMonth()])
    .replace('{y}', String(date.getUTCFullYear()));

/** "Thu 30 Oct" */
export const shortDate = (d: ISODate) =>
  fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }, (t, date) => fill(t.short, t, date, t.weekdaysShort));
/** "Thursday" */
export const weekdayName = (d: ISODate) => fmt(d, { weekday: 'long' }, (t, date) => t.weekdays[date.getUTCDay()]);
/** "30 Oct 2026" */
export const longDate = (d: ISODate) =>
  fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }, (t, date) => fill(t.long, t, date, t.weekdays));
/** weekday name for 0=Sun..6, using a known week */
export const weekdayFromIndex = (i: number) => weekdayName(`2026-10-${String(25 + i).padStart(2, '0')}`); // 25 Oct 2026 is a Sunday
