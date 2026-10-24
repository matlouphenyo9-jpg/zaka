import type { Category, Source } from './types';

export const IN_CATEGORIES: Category[] = ['piece_job', 'grant', 'salary', 'trade', 'gift', 'income'];
export const OUT_CATEGORIES: Category[] = ['transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel', 'savings_goal', 'debt', 'household', 'health', 'funeral', 'other'];

/** Icon name per category (see components/Icon). */
export const CATEGORY_ICON: Record<Category, string> = {
  opening_balance: 'opening_balance', income: 'income', grant: 'grant', piece_job: 'piece_job', salary: 'salary', trade: 'trade', gift: 'gift',
  transport: 'transport', food: 'food', electricity: 'electricity', data_airtime: 'data_airtime', rent: 'rent', school: 'school', stokvel: 'stokvel',
  savings_goal: 'savings_goal', funeral: 'funeral', debt: 'debt', health: 'health', household: 'household', other: 'other',
};

/** Where money came from, derived from the category; spending uses how it was paid. */
export function sourceFor(category: Category, paidWith: 'cash' | 'bank' = 'cash'): Source {
  if (category === 'grant') return 'grant';
  if (category === 'piece_job') return 'piece_job';
  if (category === 'trade') return 'trade';
  return paidWith;
}
