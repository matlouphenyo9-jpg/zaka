import type { ISODate } from '../lib/dates';

export type Direction = 'in' | 'out';

export const INCOME_CATEGORIES = ['grant', 'piece_job', 'salary', 'trade', 'gift', 'income'] as const;
export const SPEND_CATEGORIES = [
  'transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel',
  'savings_goal', 'funeral', 'debt', 'health', 'household', 'other',
] as const;
export type Category = 'opening_balance' | 'balance_correction' | (typeof INCOME_CATEGORIES)[number] | (typeof SPEND_CATEGORIES)[number];
export type Source = 'cash' | 'bank' | 'grant' | 'piece_job' | 'trade' | 'other';

export interface Txn {
  id: string;
  direction: Direction;
  amount_cents: number;
  category: Category;
  source: Source;
  note?: string | null;
  occurred_on: ISODate;
  created_via: 'manual' | 'ai_parsed' | 'seed';
  confirmed: boolean;
}

export interface Obligation {
  id: string;
  name: string;
  amount_cents: number;
  due_kind: 'once' | 'monthly' | 'weekly';
  due_date?: ISODate | null;
  due_day?: number | null;
  due_weekday?: number | null;
  category: 'rent' | 'school' | 'electricity' | 'stokvel' | 'funeral' | 'other';
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target_cents: number;
  due_on?: ISODate | null;
  kind: 'savings' | 'stokvel';
}

export type Reliability = 'confirmed' | 'likely' | 'possible';
export const WEIGHT: Record<Reliability, number> = { confirmed: 1, likely: 0.5, possible: 0 };

export type IncomeRule =
  | { kind: 'monthly'; day: number }
  | { kind: 'weekly'; weekday: number }
  | { kind: 'once'; date: ISODate }
  | { kind: 'frequency'; per_week: number };

export type IncomeSource = 'grant' | 'piece_job' | 'salary' | 'trade' | 'other';

export interface IncomePlanItem {
  key: string;
  source: IncomeSource;
  amount_cents: number;
  rule: IncomeRule;
  reliability: Reliability;
}

export interface Essentials {
  transport_daily_cents?: number | null;
  /** weekdays with transport, 0 = Sunday. Default Mon–Fri. */
  workdays?: number[] | null;
  food_weekly_cents?: number | null;
  electricity_weekly_cents?: number | null;
  data_weekly_cents?: number | null;
  fare_single_cents?: number | null;
  trips_per_day?: number | null;
  price_ref?: string | null;
  km_each_way?: string | null;
  l_per_100km?: string | null;
}

export interface PlanProfile {
  reserve_amount: number;
  income_plan: IncomePlanItem[];
  essentials: Essentials;
  ignored_patterns: string[];
}
