import { bcp47 } from '../i18n';
import { toUTC, type ISODate } from './dates';

function fmt(d: ISODate, opts: Intl.DateTimeFormatOptions): string {
  const date = new Date(toUTC(d));
  try {
    return new Intl.DateTimeFormat(bcp47(), { timeZone: 'UTC', ...opts }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-ZA', { timeZone: 'UTC', ...opts }).format(date);
  }
}

/** "Thu 30 Oct" */
export const shortDate = (d: ISODate) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
/** "Thursday" */
export const weekdayName = (d: ISODate) => fmt(d, { weekday: 'long' });
/** "30 Oct 2026" */
export const longDate = (d: ISODate) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
/** weekday name for 0=Sun..6, using a known week */
export const weekdayFromIndex = (i: number) => weekdayName(`2026-10-${String(25 + i).padStart(2, '0')}`); // 25 Oct 2026 is a Sunday
