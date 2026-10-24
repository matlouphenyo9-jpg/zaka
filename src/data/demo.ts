// The judge demo, built in TypeScript exactly as seed_demo() builds it in SQL (kept in sync by tests).
import { addDays, addMonths, dayOfMonth, type ISODate } from '../lib/dates';
import type { Goal, Obligation, PlanProfile, Txn } from '../engine/types';
import { LERATO_ROWS } from './lerato';

export const DEMO_STOKVEL_DAYS_AHEAD = 5;
export const DEMO_GOAL_DAYS_AHEAD = 56;
export const DEMO_GOAL_TARGET_CENTS = 50000;
export const DEMO_STOKVEL_CENTS = 20000;
export const DEMO_TAXI_DAILY_CENTS = 4800;

export function seedLerato(today: ISODate): { txns: Txn[]; obligations: Obligation[]; goals: Goal[]; profile: PlanProfile } {
  const stokvelDue = addDays(today, DEMO_STOKVEL_DAYS_AHEAD);
  const stokvelRows = LERATO_ROWS.filter((r) => r[3] === 'stokvel').map((r) => r[0]);
  const txns: Txn[] = LERATO_ROWS.map(([id, offset, direction, category, source, cents, note]) => {
    // Stokvel history is re-anchored to the same day of month as the upcoming contribution,
    // so the demo always shows "stokvel due in 5 days" and the history agrees with it.
    const k = stokvelRows.indexOf(id);
    const occurred_on = k >= 0 ? addMonths(stokvelDue, -(stokvelRows.length - k)) : addDays(today, offset);
    return { id: `seed-${id}`, direction, amount_cents: cents, category: category as Txn['category'], source: source as Txn['source'], note, occurred_on, created_via: 'seed', confirmed: true };
  });
  const obligations: Obligation[] = [
    { id: 'seed-stokvel', name: 'Stokvel', amount_cents: DEMO_STOKVEL_CENTS, due_kind: 'monthly', due_day: dayOfMonth(stokvelDue), category: 'stokvel', active: true },
  ];
  const goals: Goal[] = [{ id: 'seed-goal', name: 'School shoes', target_cents: DEMO_GOAL_TARGET_CENTS, due_on: addDays(today, DEMO_GOAL_DAYS_AHEAD), kind: 'savings' }];
  const profile: PlanProfile = {
    reserve_amount: 0,
    income_plan: [],
    essentials: { transport_daily_cents: DEMO_TAXI_DAILY_CENTS, workdays: [1, 2, 3, 4, 5], fare_single_cents: 2400, trips_per_day: 2 },
    ignored_patterns: [],
  };
  return { txns, obligations, goals, profile };
}
