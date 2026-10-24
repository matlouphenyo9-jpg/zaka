import { describe, expect, it } from 'vitest';
import { buildForecast } from './forecast';
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
