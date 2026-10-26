// 14-day low-path ledger (D5 + R3). Deterministic integer-cent maths; no LLM anywhere in here.
import { addDays, addMonths, dateInMonth, dayOfMonth, diffDays, weekday, type ISODate } from '../lib/dates';
import {
  detectPatterns, nextRecurringDate, pieceJobOffsets,
  type Patterns, type RecurringPattern,
} from './patterns';
import { WEIGHT, type Goal, type IncomePlanItem, type IncomeSource, type Obligation, type PlanProfile, type Reliability, type Txn } from './types';

export const HORIZON_DAYS = 14;
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export interface IncomeEvent {
  date: ISODate;
  amount_cents: number;
  weight: number;
  reliability: Reliability;
  source: IncomeSource;
  origin: 'plan' | 'pattern' | 'scheduled';
  pattern_key?: string;
}

export interface CostEvent {
  date: ISODate;
  amount_cents: number;
  name: string;
  category: string;
  obligation_id: string;
}

export type EssentialKey = 'transport' | 'food' | 'electricity' | 'data_airtime';
export interface EssentialInput {
  key: EssentialKey;
  /** weekly total in cents */
  weekly_cents: number;
  origin: 'you' | 'learned' | 'none';
}

export interface LedgerDay {
  date: ISODate;
  offset: number;
  income_cents: number; // weighted
  costs_cents: number; // obligations due
  essentials_cents: number;
  balance_cents: number; // end of day
  events: { income: IncomeEvent[]; costs: CostEvent[] };
}

export interface SetAside {
  kind: 'goal' | 'obligation';
  name: string;
  daily_cents: number;
  total_cents: number; // over the horizon
  due: ISODate | null;
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export interface Confidence {
  level: ConfidenceLevel;
  history_days: number;
  confirmed_entries: number;
  strong_patterns: number;
}

export interface Forecast {
  today: ISODate;
  balance_cents: number;
  horizon_days: number;
  horizon_date: ISODate;
  horizon_reason: 'income' | 'cap';
  horizon_income: IncomeEvent | null;
  min_balance_cents: number;
  reserve_cents: number;
  set_asides: SetAside[];
  set_aside_cents: number;
  safe_cents: number;
  daily_cents: number;
  shortfall: { date: ISODate; offset: number; balance_cents: number } | null;
  days: LedgerDay[];
  income: IncomeEvent[];
  costs: CostEvent[];
  essentials: EssentialInput[];
  patterns: Patterns;
  confidence: Confidence;
}

export interface ForecastInput {
  today: ISODate;
  txns: Txn[];
  obligations: Obligation[];
  goals: Goal[];
  profile: PlanProfile;
  horizon?: number;
}

export function currentBalance(txns: Txn[], today: ISODate): number {
  let b = 0;
  for (const t of txns) if (t.confirmed && t.occurred_on <= today) b += t.direction === 'in' ? t.amount_cents : -t.amount_cents;
  return b;
}

/** Due dates of an obligation inside (today, today+horizon]. */
export function obligationDates(o: Obligation, today: ISODate, horizon: number): ISODate[] {
  if (!o.active) return [];
  const end = addDays(today, horizon);
  const out: ISODate[] = [];
  if (o.due_kind === 'once' && o.due_date) {
    if (o.due_date > today && o.due_date <= end) out.push(o.due_date);
  } else if (o.due_kind === 'monthly' && o.due_day) {
    let d = dateInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)), o.due_day);
    if (d <= today) d = addMonths(d, 1, o.due_day);
    for (; d <= end; d = addMonths(d, 1, o.due_day)) out.push(d);
  } else if (o.due_kind === 'weekly' && o.due_weekday != null) {
    for (let i = 1; i <= horizon; i++) if (weekday(addDays(today, i)) === o.due_weekday) out.push(addDays(today, i));
  }
  return out;
}

/** The next due date of an obligation after today, however far away. */
export function nextObligationDate(o: Obligation, today: ISODate): ISODate | null {
  const d = obligationDates(o, today, 62);
  return d[0] ?? null;
}

function planEvents(item: IncomePlanItem, today: ISODate, horizon: number, pieceLast: ISODate | null): IncomeEvent[] {
  const base = { amount_cents: item.amount_cents, weight: WEIGHT[item.reliability], reliability: item.reliability, source: item.source, origin: 'plan' as const, pattern_key: item.key };
  const end = addDays(today, horizon);
  const r = item.rule;
  const out: IncomeEvent[] = [];
  if (r.kind === 'once') {
    if (r.date > today && r.date <= end) out.push({ ...base, date: r.date });
  } else if (r.kind === 'monthly') {
    let d = dateInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)), r.day);
    if (d <= today) d = addMonths(d, 1, r.day);
    for (; d <= end; d = addMonths(d, 1, r.day)) out.push({ ...base, date: d });
  } else if (r.kind === 'weekly') {
    for (let i = 1; i <= horizon; i++) if (weekday(addDays(today, i)) === r.weekday) out.push({ ...base, date: addDays(today, i) });
  } else if (r.kind === 'frequency') {
    for (const off of pieceJobOffsets(r.per_week, pieceLast ?? today, today, horizon)) out.push({ ...base, date: addDays(today, off) });
  }
  return out;
}

function recurringEvents(p: RecurringPattern, today: ISODate, horizon: number): IncomeEvent[] {
  const end = addDays(today, horizon);
  const out: IncomeEvent[] = [];
  let d = nextRecurringDate(p, today);
  while (d <= end) {
    out.push({ date: d, amount_cents: p.amount_cents, weight: WEIGHT.likely, reliability: 'likely', source: p.source, origin: 'pattern', pattern_key: p.key });
    d = p.kind === 'monthly' ? addMonths(d, 1, p.day!) : addDays(d, 7);
  }
  return out;
}

function isFrequencyEvent(e: IncomeEvent, profile: PlanProfile): boolean {
  if (e.origin === 'pattern') return e.pattern_key === 'piece_job';
  if (e.origin === 'plan') return profile.income_plan.find((p) => p.key === e.pattern_key)?.rule.kind === 'frequency';
  return false;
}

export function resolveEssentials(profile: PlanProfile, patterns: Patterns): EssentialInput[] {
  const e = profile.essentials ?? {};
  const workdays = e.workdays?.length ? e.workdays : DEFAULT_WORKDAYS;
  const learned = patterns.spending.weekly;
  const pick = (key: EssentialKey, mine: number | null | undefined): EssentialInput => {
    if (mine != null && mine >= 0) return { key, weekly_cents: Math.round(mine), origin: 'you' };
    const l = learned[key];
    if (l && l > 0) return { key, weekly_cents: l, origin: 'learned' };
    return { key, weekly_cents: 0, origin: 'none' };
  };
  return [
    pick('transport', e.transport_daily_cents != null ? e.transport_daily_cents * workdays.length : null),
    pick('food', e.food_weekly_cents),
    pick('electricity', e.electricity_weekly_cents),
    pick('data_airtime', e.data_weekly_cents),
  ];
}

/** Daily essential spend for a given date: transport only on workdays, the rest spread evenly. */
function essentialsOn(date: ISODate, ess: EssentialInput[], profile: PlanProfile): number {
  const workdays = profile.essentials?.workdays?.length ? profile.essentials.workdays : DEFAULT_WORKDAYS;
  let total = 0;
  for (const e of ess) {
    if (e.weekly_cents <= 0) continue;
    if (e.key === 'transport') {
      if (workdays.includes(weekday(date))) total += e.weekly_cents / workdays.length;
    } else total += e.weekly_cents / 7;
  }
  return total;
}

export function confidenceOf(txns: Txn[], today: ISODate, patterns: Patterns): Confidence {
  const confirmed = txns.filter((t) => t.confirmed && t.occurred_on <= today);
  const first = confirmed.reduce<ISODate | null>((m, t) => (m == null || t.occurred_on < m ? t.occurred_on : m), null);
  const history_days = first ? diffDays(today, first) + 1 : 0;
  const strong_patterns = patterns.recurring.filter((p) => p.strength === 'strong').length + (patterns.pieceJobs?.strength === 'strong' ? 1 : 0);
  let level: ConfidenceLevel = 'low';
  // D5: low under 14 days or six entries; medium after 14 days and five confirmed entries;
  // high only with 8+ weeks and a recurring item seen at least three times.
  if (history_days >= 14 && confirmed.length >= 6) level = 'medium';
  if (history_days >= 56 && confirmed.length >= 30 && patterns.recurring.some((p) => p.strength === 'strong')) level = 'high';
  return { level, history_days, confirmed_entries: confirmed.length, strong_patterns };
}

export function savedForGoal(txns: Txn[], goal: Goal): number {
  const cat = goal.kind === 'stokvel' ? 'stokvel' : 'savings_goal';
  return txns.filter((t) => t.confirmed && t.direction === 'out' && t.category === cat).reduce((s, t) => s + t.amount_cents, 0);
}

export function buildForecast(input: ForecastInput): Forecast {
  const { today, txns, obligations, goals, profile } = input;
  const horizonCap = input.horizon ?? HORIZON_DAYS;
  const patterns = detectPatterns(txns, today);
  const ignored = new Set(profile.ignored_patterns ?? []);
  const balance = currentBalance(txns, today);

  // ---- expected income: your plan first, then learned patterns for sources you haven't set yourself
  const planSources = new Set(profile.income_plan.map((p) => p.source));
  const income: IncomeEvent[] = [];
  for (const item of profile.income_plan) income.push(...planEvents(item, today, horizonCap, patterns.pieceJobs?.last ?? null));
  for (const p of patterns.recurring) {
    if (ignored.has(p.key) || planSources.has(p.source)) continue;
    income.push(...recurringEvents(p, today, horizonCap));
  }
  const pj = patterns.pieceJobs;
  if (pj && !ignored.has(pj.key) && !planSources.has('piece_job')) {
    for (const off of pieceJobOffsets(pj.per_week, pj.last, today, horizonCap)) {
      income.push({ date: addDays(today, off), amount_cents: pj.median_cents, weight: WEIGHT.likely, reliability: 'likely', source: 'piece_job', origin: 'pattern', pattern_key: pj.key });
    }
  }
  // future-dated confirmed entries are scheduled money (weight 1.0)
  for (const t of txns) {
    if (t.confirmed && t.direction === 'in' && t.occurred_on > today && diffDays(t.occurred_on, today) <= horizonCap) {
      income.push({ date: t.occurred_on, amount_cents: t.amount_cents, weight: 1, reliability: 'confirmed', source: 'other', origin: 'scheduled' });
    }
  }
  income.sort((a, b) => a.date.localeCompare(b.date));

  // ---- obligations due
  const costs: CostEvent[] = [];
  for (const o of obligations) for (const d of obligationDates(o, today, horizonCap)) costs.push({ date: d, amount_cents: o.amount_cents, name: o.name, category: o.category, obligation_id: o.id });
  for (const t of txns) {
    if (t.confirmed && t.direction === 'out' && t.occurred_on > today && diffDays(t.occurred_on, today) <= horizonCap) {
      costs.push({ date: t.occurred_on, amount_cents: t.amount_cents, name: t.note || t.category, category: t.category, obligation_id: t.id });
    }
  }
  costs.sort((a, b) => a.date.localeCompare(b.date));

  // ---- daily essentials
  const essentials = resolveEssentials(profile, patterns);

  // ---- ledger. Fractions are accumulated exactly and only the running balance is rounded.
  const days: LedgerDay[] = [];
  let running = balance;
  for (let i = 1; i <= horizonCap; i++) {
    const date = addDays(today, i);
    const inc = income.filter((e) => e.date === date);
    const cst = costs.filter((c) => c.date === date);
    const incomeC = inc.reduce((s, e) => s + e.amount_cents * e.weight, 0);
    const costC = cst.reduce((s, c) => s + c.amount_cents, 0);
    const essC = essentialsOn(date, essentials, profile);
    running += incomeC - costC - essC;
    days.push({ date, offset: i, income_cents: Math.round(incomeC), costs_cents: costC, essentials_cents: Math.round(essC), balance_cents: Math.round(running), events: { income: inc, costs: cst } });
  }

  // ---- horizon: the next confirmed or likely money, capped at 14 days
  // A dated income (grant, salary, a date you entered) ends the horizon. Piece jobs are spread by frequency, so their
  // dates are only estimates: they count (at half) inside the horizon and end it only when no dated money is due.
  const counted = income.filter((e) => e.weight >= WEIGHT.likely);
  const next = counted.find((e) => !isFrequencyEvent(e, profile)) ?? counted[0] ?? null;
  const H = next ? diffDays(next.date, today) : horizonCap;
  // Money must last until the horizon income arrives, so that day's own income is not counted in the minimum.
  const lows = days.slice(0, H).map((d, i) => (i === H - 1 && next ? d.balance_cents - Math.round(d.events.income.reduce((s, e) => s + e.amount_cents * e.weight, 0)) : d.balance_cents));
  const min_balance_cents = Math.min(balance, ...lows);

  // ---- set-asides: savings goal pace + bills that fall after the horizon but inside 14 days
  const set_asides: SetAside[] = [];
  for (const g of goals) {
    if (g.kind !== 'savings' || !g.due_on || g.due_on <= today) continue;
    const remaining = g.target_cents - savedForGoal(txns, g);
    if (remaining <= 0) continue;
    const daily = Math.ceil(remaining / diffDays(g.due_on, today));
    set_asides.push({ kind: 'goal', name: g.name, daily_cents: daily, total_cents: daily * H, due: g.due_on });
  }
  for (const c of costs) {
    const off = diffDays(c.date, today);
    if (off <= H) continue; // already inside the ledger minimum
    const daily = Math.ceil(c.amount_cents / off);
    set_asides.push({ kind: 'obligation', name: c.name, daily_cents: daily, total_cents: Math.min(c.amount_cents, daily * H), due: c.date });
  }
  const set_aside_cents = set_asides.reduce((s, a) => s + a.total_cents, 0);
  const reserve_cents = Math.max(0, profile.reserve_amount ?? 0);

  const safe_cents = Math.max(0, min_balance_cents - reserve_cents - set_aside_cents);
  const daily_cents = Math.floor(safe_cents / Math.max(1, H));
  const sf = days.find((d) => d.balance_cents < 0);

  return {
    today,
    balance_cents: balance,
    horizon_days: H,
    horizon_date: addDays(today, H),
    horizon_reason: next ? 'income' : 'cap',
    horizon_income: next,
    min_balance_cents,
    reserve_cents,
    set_asides,
    set_aside_cents,
    safe_cents,
    daily_cents,
    shortfall: sf ? { date: sf.date, offset: sf.offset, balance_cents: sf.balance_cents } : null,
    days,
    income,
    costs,
    essentials,
    patterns,
    confidence: confidenceOf(txns, today, patterns),
  };
}

export interface SafeBreakdown {
  balance_cents: number;
  bills_cents: number;
  essentials_cents: number;
  expected_cents: number;
  /** what the plan says is left the day before the horizon money arrives */
  left_cents: number;
  /** extra kept back because a day before then dips lower than the end */
  low_day_cents: number;
  reserve_cents: number;
  set_aside_cents: number;
  safe_cents: number;
}

/**
 * "How we got this": money now − bills − essentials + expected (weighted) = left by the horizon; minus the dip to the
 * lowest day, the reserve and set-asides = safe to spend. The lines always add up to the engine's own numbers.
 */
export function safeBreakdown(f: Forecast): SafeBreakdown {
  const H = f.horizon_days;
  const inH = f.days.slice(0, H);
  const bills = inH.reduce((s, d) => s + d.costs_cents, 0);
  const essentials = inH.reduce((s, d) => s + d.essentials_cents, 0);
  // The horizon day's own income is not counted (money must last until it arrives).
  const expected = inH.reduce((s, d, i) => s + (i === H - 1 && f.horizon_reason === 'income' ? 0 : d.income_cents), 0);
  const left = f.balance_cents - bills - essentials + expected;
  const low_day = Math.max(0, left - f.min_balance_cents);
  return {
    balance_cents: f.balance_cents,
    bills_cents: bills,
    essentials_cents: essentials,
    expected_cents: expected,
    left_cents: left,
    low_day_cents: low_day,
    reserve_cents: f.reserve_cents,
    set_aside_cents: f.set_aside_cents,
    safe_cents: f.safe_cents,
  };
}

/** "Your R200 stokvel is due Fri — put away R40 a day." */
export function stokvelPlan(obligations: Obligation[], today: ISODate): { amount_cents: number; due: ISODate; days: number; daily_cents: number; name: string } | null {
  const candidates = obligations
    .filter((o) => o.active && o.category === 'stokvel')
    .map((o) => ({ o, due: nextObligationDate(o, today) }))
    .filter((x): x is { o: Obligation; due: ISODate } => !!x.due)
    .sort((a, b) => a.due.localeCompare(b.due));
  if (!candidates.length) return null;
  const { o, due } = candidates[0];
  const days = Math.max(1, diffDays(due, today));
  return { amount_cents: o.amount_cents, due, days, daily_cents: Math.ceil(o.amount_cents / days / 100) * 100, name: o.name };
}

export { dayOfMonth };
