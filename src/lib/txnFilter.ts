// B5: Transactions filters and the category summary ("Electricity: 4 times this month, R420 total"). Pure code, no AI.
import type { Category, Direction, Txn } from '../engine/types';
import { addDays, dateInMonth, weekday, type ISODate } from './dates';

export type RangeKind = 'week' | 'month' | 'last_month' | 'custom';
export const CHIP_CATEGORIES = ['electricity', 'data_airtime', 'food', 'transport', 'school', 'rent', 'stokvel', 'other'] as const;
export type ChipCategory = (typeof CHIP_CATEGORIES)[number];
const NAMED = new Set<string>(CHIP_CATEGORIES.filter((c) => c !== 'other'));
/** Balance fixes are shown in the list but are not money earned or spent, so they stay out of the totals. */
const NOT_COUNTED = new Set<Category>(['opening_balance', 'balance_correction']);

/** This week starts on Monday; months run from the 1st. Custom ranges are swapped if given back to front. */
export function rangeFor(kind: RangeKind, today: ISODate, custom?: { from: string; to: string }): { from: ISODate; to: ISODate } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (kind === 'week') return { from: addDays(today, -((weekday(today) + 6) % 7)), to: today };
  if (kind === 'month') return { from: dateInMonth(y, m, 1), to: today };
  if (kind === 'last_month') return { from: dateInMonth(y, m - 1, 1), to: dateInMonth(y, m - 1, 31) };
  const a = custom?.from || today;
  const b = custom?.to || today;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function chipFor(category: Category): ChipCategory {
  return NAMED.has(category) ? (category as ChipCategory) : 'other';
}

export interface TxnFilter { from: ISODate; to: ISODate; dir: 'all' | Direction; chips: ChipCategory[] }

export function filterTxns(txns: Txn[], f: TxnFilter): Txn[] {
  return txns
    .filter((x) => x.occurred_on >= f.from && x.occurred_on <= f.to)
    .filter((x) => f.dir === 'all' || x.direction === f.dir)
    .filter((x) => f.chips.length === 0 || f.chips.includes(chipFor(x.category)))
    .sort((a, b) => (b.occurred_on + b.id).localeCompare(a.occurred_on + a.id));
}

export interface CategoryLine { category: Category; direction: Direction; count: number; total_cents: number }
export interface Summary { in_cents: number; out_cents: number; lines: CategoryLine[] }

/** Count and total per category (money in and out kept apart), plus total in and out, biggest first. */
export function summarize(txns: Txn[]): Summary {
  const map = new Map<string, CategoryLine>();
  let inC = 0;
  let outC = 0;
  for (const x of txns) {
    if (NOT_COUNTED.has(x.category)) continue;
    if (x.direction === 'in') inC += x.amount_cents;
    else outC += x.amount_cents;
    const k = `${x.direction}:${x.category}`;
    const line = map.get(k) ?? { category: x.category, direction: x.direction, count: 0, total_cents: 0 };
    line.count++;
    line.total_cents += x.amount_cents;
    map.set(k, line);
  }
  return { in_cents: inC, out_cents: outC, lines: [...map.values()].sort((a, b) => b.total_cents - a.total_cents || a.category.localeCompare(b.category)) };
}

/** Groups an already sorted list by day, newest first. */
export function byDay(txns: Txn[]): { date: ISODate; txns: Txn[] }[] {
  const out: { date: ISODate; txns: Txn[] }[] = [];
  for (const x of txns) {
    const last = out[out.length - 1];
    if (last && last.date === x.occurred_on) last.txns.push(x);
    else out.push({ date: x.occurred_on, txns: [x] });
  }
  return out;
}
