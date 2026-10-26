import { describe, expect, it } from 'vitest';
import { buildForecast, currentBalance, safeBreakdown } from './forecast';
import { detectSpending, incomeSourceOf } from './patterns';
import type { PlanProfile, Txn } from './types';

const today = '2026-10-24';
const opening = (cents: number): Txn => ({ id: 'o', direction: 'in', amount_cents: cents, category: 'opening_balance', source: 'cash', occurred_on: today, created_via: 'manual', confirmed: true });
const everyDay = (cents: number): PlanProfile => ({
  reserve_amount: 0, income_plan: [], ignored_patterns: [],
  // R100/day of essentials: transport on all 7 days so the daily amount is exact
  essentials: { transport_daily_cents: cents, workdays: [0, 1, 2, 3, 4, 5, 6], food_weekly_cents: 0, electricity_weekly_cents: 0, data_weekly_cents: 0 },
});

describe('R3 acceptance checks', () => {
  it('R1 (piece job inside the horizon, salary ends it): R1,200 − R300 bill − R500 essentials + weighted R200 = R600, R120/day for 5 days', () => {
    const profile = everyDay(10000);
    const g = buildForecast({
      today, txns: [opening(120000)], goals: [],
      profile: { ...profile, income_plan: [
        { key: 'job', source: 'piece_job', amount_cents: 40000, rule: { kind: 'frequency', per_week: 7 / 3 }, reliability: 'likely' },
        { key: 'pay', source: 'salary', amount_cents: 100000, rule: { kind: 'once', date: '2026-10-29' }, reliability: 'likely' },
      ] },
      obligations: [{ id: 'e', name: 'Electricity', amount_cents: 30000, due_kind: 'once', due_date: '2026-10-25', category: 'electricity', active: true }],
    });
    expect(g.horizon_days).toBe(5);
    expect(g.days[2].income_cents).toBe(20000); // R400 piece job on day 3 counted at half
    expect(g.safe_cents).toBe(60000);
    expect(g.daily_cents).toBe(12000);
  });

  it('R3: R350 with R300 due tomorrow and R100/day flags a shortfall tomorrow', () => {
    const f = buildForecast({
      today, txns: [opening(35000)], goals: [], profile: everyDay(10000),
      obligations: [{ id: 'e', name: 'Electricity', amount_cents: 30000, due_kind: 'once', due_date: '2026-10-25', category: 'electricity', active: true }],
    });
    expect(f.shortfall?.date).toBe('2026-10-25');
    expect(f.shortfall?.balance_cents).toBe(-5000);
    expect(f.safe_cents).toBe(0);
  });

  it('says no shortfall when money lasts 14 days', () => {
    const f = buildForecast({ today, txns: [opening(500000)], goals: [], obligations: [], profile: everyDay(10000) });
    expect(f.shortfall).toBeNull();
    expect(f.horizon_reason).toBe('cap');
    expect(f.safe_cents).toBe(500000 - 14 * 10000);
  });

  it('subtracts the reserve and goal set-aside', () => {
    const p = everyDay(0);
    p.reserve_amount = 5000;
    const f = buildForecast({ today, txns: [opening(100000)], obligations: [], profile: p, goals: [{ id: 'g', name: 'Shoes', target_cents: 14000, due_on: '2026-11-07', kind: 'savings' }] });
    expect(f.set_aside_cents).toBe(14000);
    expect(f.safe_cents).toBe(100000 - 5000 - 14000);
  });

  it('is low confidence with little data', () => {
    const f = buildForecast({ today, txns: [opening(10000)], goals: [], obligations: [], profile: everyDay(0) });
    expect(f.confidence.level).toBe('low');
  });
});

describe('B4-H: money you have now and "How we got this"', () => {
  it('R1 example: R1,200 − R300 bills − R500 essentials + R200 expected = R600 left = R600 safe', () => {
    const profile = everyDay(10000);
    const f = buildForecast({
      today, txns: [opening(120000)], goals: [],
      profile: { ...profile, income_plan: [
        { key: 'job', source: 'piece_job', amount_cents: 40000, rule: { kind: 'frequency', per_week: 7 / 3 }, reliability: 'likely' },
        { key: 'pay', source: 'salary', amount_cents: 100000, rule: { kind: 'once', date: '2026-10-29' }, reliability: 'likely' },
      ] },
      obligations: [{ id: 'e', name: 'Electricity', amount_cents: 30000, due_kind: 'once', due_date: '2026-10-25', category: 'electricity', active: true }],
    });
    expect(safeBreakdown(f)).toEqual({
      balance_cents: 120000, bills_cents: 30000, essentials_cents: 50000, expected_cents: 20000,
      left_cents: 60000, low_day_cents: 0, reserve_cents: 0, set_aside_cents: 0, safe_cents: 60000,
    });
  });

  it('a dip before payday is shown as its own line, and the lines add up to safe to spend', () => {
    // R1,000 now, R100/day, R600 bill tomorrow, R500 grant on day 3 (likely → counted R250), salary on day 5 ends it
    const f = buildForecast({
      today, txns: [opening(100000)], goals: [],
      profile: { ...everyDay(10000), reserve_amount: 5000, income_plan: [
        { key: 'g', source: 'grant', amount_cents: 50000, rule: { kind: 'once', date: '2026-10-27' }, reliability: 'confirmed' },
        { key: 'pay', source: 'salary', amount_cents: 100000, rule: { kind: 'once', date: '2026-10-29' }, reliability: 'likely' },
      ] },
      obligations: [{ id: 'b', name: 'Rent', amount_cents: 60000, due_kind: 'once', due_date: '2026-10-25', category: 'rent', active: true }],
    });
    const b = safeBreakdown(f);
    expect(b.left_cents - b.low_day_cents).toBe(f.min_balance_cents);
    expect(Math.max(0, b.left_cents - b.low_day_cents - b.reserve_cents - b.set_aside_cents)).toBe(f.safe_cents);
  });

  it('a balance correction changes money now but is never learned as spending or income', () => {
    const txns: Txn[] = [
      opening(50000),
      { id: 'c', direction: 'out', amount_cents: 12000, category: 'balance_correction', source: 'cash', occurred_on: today, created_via: 'manual', confirmed: true },
    ];
    expect(currentBalance(txns, today)).toBe(38000);
    const p = detectSpending(txns, today);
    expect(p.by_weekday.every((x) => x === 0)).toBe(true);
    expect(incomeSourceOf({ category: 'balance_correction', source: 'cash' })).toBeNull();
  });
});
