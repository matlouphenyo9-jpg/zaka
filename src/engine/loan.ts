// Loan Check: transparent total-cost arithmetic (R5). Not a recommendation; compares only the interest rate
// against the reg. 42 short-term ceiling, the one maximum R5 verified.

export type CreditType = 'short_first' | 'short_repeat' | 'other';

/** National Credit Regulations reg. 42 short-term credit: 5% per month for the first loan in a calendar year, 3% for later ones. */
export const MAX_MONTHLY_RATE: Record<CreditType, number | null> = { short_first: 5, short_repeat: 3, other: null };

export interface LoanInput {
  principal_cents: number;
  interest: { mode: 'pct_month'; rate: number } | { mode: 'rand'; cents: number };
  fees_cents: number;
  term_months: number;
  type: CreditType;
}

export interface LoanResult {
  interest_cents: number;
  total_cents: number;
  cost_cents: number;
  monthly_cents: number;
  cost_pct: number; // cost as % of principal
  monthly_rate: number; // effective simple interest % per month (interest only)
  max_rate: number | null;
  above_limit: boolean | null; // null = no verified maximum
}

export function loanCost(i: LoanInput): LoanResult | null {
  if (!(i.principal_cents > 0) || !(i.term_months > 0) || i.fees_cents < 0) return null;
  const interest_cents =
    i.interest.mode === 'pct_month' ? Math.round(i.principal_cents * (i.interest.rate / 100) * i.term_months) : Math.round(i.interest.cents);
  if (!(interest_cents >= 0)) return null;
  const total_cents = i.principal_cents + interest_cents + i.fees_cents;
  const cost_cents = interest_cents + i.fees_cents;
  const monthly_rate = Math.round(((interest_cents / i.principal_cents / i.term_months) * 100) * 100) / 100;
  const max_rate = MAX_MONTHLY_RATE[i.type];
  return {
    interest_cents,
    total_cents,
    cost_cents,
    monthly_cents: Math.round(total_cents / i.term_months),
    cost_pct: Math.round((cost_cents / i.principal_cents) * 1000) / 10,
    monthly_rate,
    max_rate,
    above_limit: max_rate == null ? null : monthly_rate > max_rate + 1e-9,
  };
}
