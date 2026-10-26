import { describe, expect, it } from 'vitest';
import { byDay, chipFor, filterTxns, rangeFor, summarize } from './txnFilter';
import type { Txn } from '../engine/types';

let n = 0;
const tx = (occurred_on: string, direction: 'in' | 'out', amount_cents: number, category: Txn['category'], created_via: Txn['created_via'] = 'manual'): Txn => ({ id: `t${++n}`, occurred_on, direction, amount_cents, category, source: 'cash', created_via, confirmed: true, note: null });

const T = [
  tx('2026-10-02', 'out', 10000, 'electricity', 'slip'), tx('2026-10-09', 'out', 12000, 'electricity'), tx('2026-10-16', 'out', 10000, 'electricity'), tx('2026-10-23', 'out', 10000, 'electricity'),
  tx('2026-10-25', 'out', 18745, 'food', 'slip'), tx('2026-10-26', 'out', 2900, 'data_airtime'), tx('2026-10-20', 'in', 35000, 'piece_job'), tx('2026-10-21', 'out', 2000, 'health'),
  tx('2026-09-30', 'out', 5000, 'electricity'), tx('2026-10-01', 'in', 50000, 'opening_balance'), tx('2026-10-24', 'out', 1500, 'balance_correction'),
];

describe('date ranges', () => {
  it('this week starts on Monday', () => expect(rangeFor('week', '2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-10-28' }));
  it('a Sunday belongs to the week that started the Monday before', () => expect(rangeFor('week', '2026-11-01').from).toBe('2026-10-26'));
  it('this month and last month', () => {
    expect(rangeFor('month', '2026-10-26')).toEqual({ from: '2026-10-01', to: '2026-10-26' });
    expect(rangeFor('last_month', '2026-10-26')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeFor('last_month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('custom ranges given back to front are swapped', () => expect(rangeFor('custom', '2026-10-26', { from: '2026-10-20', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-20' }));
});

describe('filters and summary', () => {
  const month = { ...rangeFor('month', '2026-10-26'), dir: 'all' as const, chips: [] };
  it('"Electricity: 4 times this month, R420 total"', () => {
    const s = summarize(filterTxns(T, { ...month, chips: ['electricity'] }));
    expect(s.lines).toEqual([{ category: 'electricity', direction: 'out', count: 4, total_cents: 42000 }]);
  });
  it('totals in and out leave balance fixes out', () => {
    const s = summarize(filterTxns(T, month));
    expect(s.in_cents).toBe(35000);
    expect(s.out_cents).toBe(42000 + 18745 + 2900 + 2000);
    expect(s.lines[0].category).toBe('electricity');
  });
  it('In / Out filter', () => {
    expect(filterTxns(T, { ...month, dir: 'in' }).every((x) => x.direction === 'in')).toBe(true);
    expect(filterTxns(T, { ...month, dir: 'out' }).some((x) => x.direction === 'in')).toBe(false);
  });
  it('"other" chip holds every category without its own chip', () => {
    expect(chipFor('health')).toBe('other');
    expect(chipFor('data_airtime')).toBe('data_airtime');
    expect(filterTxns(T, { ...month, chips: ['other'], dir: 'out' }).map((x) => x.category).sort()).toEqual(['balance_correction', 'health']);
  });
  it('newest first, grouped by day', () => {
    const g = byDay(filterTxns(T, month));
    expect(g[0].date).toBe('2026-10-26');
    expect(g.every((d, i) => i === 0 || g[i - 1].date > d.date)).toBe(true);
  });
  it('an empty period sums to zero', () => expect(summarize([])).toEqual({ in_cents: 0, out_cents: 0, lines: [] }));
});
