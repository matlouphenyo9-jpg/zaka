import { bcp47 } from '../i18n';
import { toUTC, type ISODate } from './dates';

// Browsers without data for a locale silently fall back to US English ("Fri, Oct 30"); use South African English instead.
function dateLocale(): string {
  const want = bcp47();
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([want]).length ? want : 'en-ZA';
  } catch {
    return 'en-ZA';
  }
}

function fmt(d: ISODate, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(), { timeZone: 'UTC', ...opts }).format(new Date(toUTC(d)));
}

/** "Thu 30 Oct" */
export const shortDate = (d: ISODate) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
/** "Thursday" */
export const weekdayName = (d: ISODate) => fmt(d, { weekday: 'long' });
/** "30 Oct 2026" */
export const longDate = (d: ISODate) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
/** weekday name for 0=Sun..6, using a known week */
export const weekdayFromIndex = (i: number) => weekdayName(`2026-10-${String(25 + i).padStart(2, '0')}`); // 25 Oct 2026 is a Sunday
