// Pattern detection from confirmed history. Pure and deterministic: same input, same output.
import { addDays, addMonths, dateInMonth, dayOfMonth, diffDays, weekday, type ISODate } from '../lib/dates';
import type { Category, IncomeSource, Txn } from './types';

export const AMOUNT_TOLERANCE = 0.15;
export const MONTHLY_DAY_TOLERANCE = 3;
export const PIECE_JOB_WINDOW_DAYS = 42; // 6 weeks
export const SPEND_WINDOW_DAYS = 28; // 4 weeks for learned everyday costs

export type Strength = 'emerging' | 'strong';

export interface RecurringPattern {
  key: string;
  kind: 'monthly' | 'weekly';
  source: IncomeSource;
  amount_cents: number;
  day?: number; // monthly: usual day of month
  weekday?: number; // weekly
  occurrences: number;
  dates: ISODate[];
  last: ISODate;
  strength: Strength;
}

export interface PieceJobPattern {
  key: 'piece_job';
  per_week: number;
  median_cents: number;
  occurrences: number; // in the window
  window_days: number;
  last: ISODate;
  strength: Strength;
}

export interface SpendingPattern {
  /** average spend per weekday (0 = Sun), cents */
  by_weekday: number[];
  /** average spend per day in each part of the month, cents */
  by_part: { early: number; mid: number; late: number };
  /** day of month when the balance is usually lowest */
  tight_day: number | null;
  busiest_weekday: number | null;
  /** learned weekly cost per category over the last 4 weeks, cents */
  weekly: Partial<Record<Category, number>>;
}

export interface Patterns {
  recurring: RecurringPattern[];
  pieceJobs: PieceJobPattern | null;
  spending: SpendingPattern;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function incomeSourceOf(t: Pick<Txn, 'category' | 'source'>): IncomeSource | null {
  switch (t.category) {
    case 'opening_balance':
    case 'balance_correction':
      return null;
    case 'grant':
      return 'grant';
    case 'piece_job':
      return 'piece_job';
    case 'salary':
      return 'salary';
    case 'trade':
      return 'trade';
    default:
      if (t.source === 'grant') return 'grant';
      if (t.source === 'piece_job') return 'piece_job';
      if (t.source === 'trade') return 'trade';
      return 'other';
  }
}

function circularDayDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

function withinAmount(x: number, ref: number): boolean {
  return Math.abs(x - ref) <= AMOUNT_TOLERANCE * ref;
}

function detectMonthly(source: IncomeSource, txns: Txn[], today: ISODate): RecurringPattern | null {
  if (txns.length < 2) return null;
  const refDay = median(txns.map((t) => dayOfMonth(t.occurred_on)));
  const refAmt = median(txns.map((t) => t.amount_cents));
  const fit = txns.filter(
    (t) => circularDayDistance(dayOfMonth(t.occurred_on), refDay) <= MONTHLY_DAY_TOLERANCE && withinAmount(t.amount_cents, refAmt),
  );
  // one per calendar month
  const months = new Map<string, Txn>();
  for (const t of fit) months.set(t.occurred_on.slice(0, 7), t);
  const hits = [...months.values()].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  if (hits.length < 2) return null;
  const last = hits[hits.length - 1].occurred_on;
  if (diffDays(today, last) > 45) return null; // missed more than a month: stale
  return {
    key: `monthly:${source}`,
    kind: 'monthly',
    source,
    amount_cents: median(hits.map((t) => t.amount_cents)),
    day: median(hits.map((t) => dayOfMonth(t.occurred_on))),
    occurrences: hits.length,
    dates: hits.map((t) => t.occurred_on),
    last,
    strength: hits.length >= 3 ? 'strong' : 'emerging',
  };
}

function detectWeekly(source: IncomeSource, txns: Txn[], today: ISODate): RecurringPattern | null {
  if (txns.length < 2) return null;
  const counts = new Array(7).fill(0);
  txns.forEach((t) => counts[weekday(t.occurred_on)]++);
  const wd = counts.indexOf(Math.max(...counts));
  const sameDay = txns.filter((t) => weekday(t.occurred_on) === wd);
  const refAmt = median(sameDay.map((t) => t.amount_cents));
  const hits = sameDay.filter((t) => withinAmount(t.amount_cents, refAmt)).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  if (hits.length < 2) return null;
  const spanWeeks = Math.floor(diffDays(hits[hits.length - 1].occurred_on, hits[0].occurred_on) / 7) + 1;
  if (hits.length < 0.6 * spanWeeks) return null; // must happen in most weeks
  const last = hits[hits.length - 1].occurred_on;
  if (diffDays(today, last) > 14) return null;
  return {
    key: `weekly:${source}`,
    kind: 'weekly',
    source,
    amount_cents: median(hits.map((t) => t.amount_cents)),
    weekday: wd,
    occurrences: hits.length,
    dates: hits.map((t) => t.occurred_on),
    last,
    strength: hits.length >= 3 ? 'strong' : 'emerging',
  };
}

export function detectRecurringIncome(txns: Txn[], today: ISODate): RecurringPattern[] {
  const groups = new Map<IncomeSource, Txn[]>();
  for (const t of txns) {
    if (!t.confirmed || t.direction !== 'in' || t.occurred_on > today) continue;
    const src = incomeSourceOf(t);
    // Piece jobs are irregular by nature; they get their own frequency model below.
    if (!src || src === 'piece_job') continue;
    groups.set(src, [...(groups.get(src) ?? []), t]);
  }
  const out: RecurringPattern[] = [];
  for (const [src, list] of groups) {
    const p = detectMonthly(src, list, today) ?? detectWeekly(src, list, today);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.occurrences - a.occurrences);
}

export function detectPieceJobs(txns: Txn[], today: ISODate): PieceJobPattern | null {
  const confirmed = txns.filter((t) => t.confirmed && t.occurred_on <= today);
  if (confirmed.length === 0) return null;
  const first = confirmed.reduce((m, t) => (t.occurred_on < m ? t.occurred_on : m), today);
  const historyDays = diffDays(today, first) + 1;
  const windowDays = Math.max(7, Math.min(PIECE_JOB_WINDOW_DAYS, historyDays));
  const from = addDays(today, -(windowDays - 1));
  const jobs = confirmed.filter((t) => t.direction === 'in' && incomeSourceOf(t) === 'piece_job' && t.occurred_on >= from);
  if (jobs.length < 2) return null;
  const perWeek = Math.round((jobs.length / (windowDays / 7)) * 10) / 10;
  return {
    key: 'piece_job',
    per_week: perWeek,
    median_cents: median(jobs.map((t) => t.amount_cents)),
    occurrences: jobs.length,
    window_days: windowDays,
    last: jobs.map((t) => t.occurred_on).sort().at(-1)!,
    strength: jobs.length >= 3 ? 'strong' : 'emerging',
  };
}

/** Rebuild end-of-day balances from the first entry to today. */
export function balanceHistory(txns: Txn[], today: ISODate): { date: ISODate; balance: number }[] {
  const confirmed = txns.filter((t) => t.confirmed && t.occurred_on <= today);
  if (confirmed.length === 0) return [];
  const byDate = new Map<ISODate, number>();
  for (const t of confirmed) byDate.set(t.occurred_on, (byDate.get(t.occurred_on) ?? 0) + (t.direction === 'in' ? t.amount_cents : -t.amount_cents));
  const start = [...byDate.keys()].sort()[0];
  const out: { date: ISODate; balance: number }[] = [];
  let bal = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    bal += byDate.get(d) ?? 0;
    out.push({ date: d, balance: bal });
  }
  return out;
}

export function detectSpending(txns: Txn[], today: ISODate): SpendingPattern {
  const confirmed = txns.filter((t) => t.confirmed && t.occurred_on <= today);
  // A "Count my cash" correction fixes the balance; it is not spending, so it must not teach spending patterns.
  const outs = confirmed.filter((t) => t.direction === 'out' && t.category !== 'balance_correction');
  const empty: SpendingPattern = { by_weekday: new Array(7).fill(0), by_part: { early: 0, mid: 0, late: 0 }, tight_day: null, busiest_weekday: null, weekly: {} };
  if (outs.length === 0) return empty;

  const first = confirmed.reduce((m, t) => (t.occurred_on < m ? t.occurred_on : m), today);
  const historyDays = diffDays(today, first) + 1;

  // per weekday and per part of month, over the whole history
  const wdSum = new Array(7).fill(0);
  const wdDays = new Array(7).fill(0);
  const part = { early: [0, 0], mid: [0, 0], late: [0, 0] } as Record<'early' | 'mid' | 'late', [number, number]>;
  const partOf = (d: ISODate) => (dayOfMonth(d) <= 10 ? 'early' : dayOfMonth(d) <= 20 ? 'mid' : 'late');
  const spendByDate = new Map<ISODate, number>();
  for (const t of outs) spendByDate.set(t.occurred_on, (spendByDate.get(t.occurred_on) ?? 0) + t.amount_cents);
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const s = spendByDate.get(d) ?? 0;
    wdSum[weekday(d)] += s;
    wdDays[weekday(d)] += 1;
    part[partOf(d)][0] += s;
    part[partOf(d)][1] += 1;
  }
  const by_weekday = wdSum.map((s, i) => (wdDays[i] ? Math.round(s / wdDays[i]) : 0));
  const by_part = {
    early: part.early[1] ? Math.round(part.early[0] / part.early[1]) : 0,
    mid: part.mid[1] ? Math.round(part.mid[0] / part.mid[1]) : 0,
    late: part.late[1] ? Math.round(part.late[0] / part.late[1]) : 0,
  };
  const maxWd = Math.max(...by_weekday);
  const busiest_weekday = historyDays >= 21 && maxWd > 0 ? by_weekday.indexOf(maxWd) : null;

  // tight day: day-of-month of the lowest balance, median across months with at least 20 days of data
  const hist = balanceHistory(txns, today);
  const months = new Map<string, { date: ISODate; balance: number }[]>();
  for (const h of hist) months.set(h.date.slice(0, 7), [...(months.get(h.date.slice(0, 7)) ?? []), h]);
  const lowDays: number[] = [];
  for (const days of months.values()) {
    if (days.length < 20) continue;
    const low = days.reduce((m, h) => (h.balance < m.balance ? h : m), days[0]);
    lowDays.push(dayOfMonth(low.date));
  }
  const tight_day = lowDays.length >= 2 ? median(lowDays) : null;

  // learned weekly cost per category: average over the last 4 weeks (or the history if shorter)
  const windowDays = Math.min(SPEND_WINDOW_DAYS, historyDays);
  const from = addDays(today, -(windowDays - 1));
  const weekly: Partial<Record<Category, number>> = {};
  if (historyDays >= 14) {
    for (const t of outs) {
      if (t.occurred_on < from) continue;
      weekly[t.category] = (weekly[t.category] ?? 0) + t.amount_cents;
    }
    for (const k of Object.keys(weekly) as Category[]) weekly[k] = Math.round((weekly[k]! * 7) / windowDays);
  }
  return { by_weekday, by_part, tight_day, busiest_weekday, weekly };
}

export function detectPatterns(txns: Txn[], today: ISODate): Patterns {
  return { recurring: detectRecurringIncome(txns, today), pieceJobs: detectPieceJobs(txns, today), spending: detectSpending(txns, today) };
}

/** Next expected date of a recurring pattern strictly after today. Never assumes a late payment is still coming today. */
export function nextRecurringDate(p: RecurringPattern, today: ISODate): ISODate {
  if (p.kind === 'monthly') {
    let cand = dateInMonth(Number(p.last.slice(0, 4)), Number(p.last.slice(5, 7)) + 1, p.day!);
    while (cand <= today) cand = addMonths(cand, 1, p.day!);
    return cand;
  }
  let cand = addDays(p.last, 7);
  while (cand <= today) cand = addDays(cand, 7);
  return cand;
}

/** Day offsets (1..horizon) where piece jobs are spread, from the observed frequency. */
export function pieceJobOffsets(perWeek: number, last: ISODate, today: ISODate, horizon: number): number[] {
  if (perWeek <= 0) return [];
  const interval = 7 / perWeek;
  let t = -diffDays(today, last) + interval;
  while (t < 1) t += interval;
  const out: number[] = [];
  for (; Math.round(t) <= horizon; t += interval) {
    const d = Math.max(1, Math.round(t));
    if (out.at(-1) !== d) out.push(d);
  }
  return out;
}
