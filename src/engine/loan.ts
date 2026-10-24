// Loan Check: transparent total-cost arithmetic (R5) and a comparison with the legal caps (R8 Part B).
// It compares the lender's *stated* rate and fees only; it never says a loan is legal or recommends one.
import { MAX_SERVICE_FEE, maxInitiationFee, rateCap, type CreditType } from './legal';
export type { CreditType } from './legal';

export interface LoanInput {
  principal_cents: number;
  interest: { mode: 'pct_month'; rate: number } | { mode: 'pct_year'; rate: number } | { mode: 'rand'; cents: number };
  initiation_cents: number;
  service_monthly_cents: number;
  other_fees_cents: number;
  term_months: number;
  type: CreditType;
}

export type Verdict = 'above' | 'within' | 'unknown';

export interface LoanResult {
  interest_cents: number;
  fees_cents: number;
  total_cents: number;
  cost_cents: number;
  monthly_cents: number;
  cost_pct: number;
  /** true when interest was estimated from a rate as simple (flat) interest */
  interest_estimated: boolean;
  rate: { verdict: Verdict; stated: number | null; cap: { per: 'month' | 'year'; max: number } };
  initiation: { verdict: Verdict; cap_cents: number };
  service: { verdict: Verdict; cap_cents: number };
}

export function loanCost(i: LoanInput): LoanResult | null {
  const vals = [i.initiation_cents, i.service_monthly_cents, i.other_fees_cents];
  if (!(i.principal_cents > 0) || !(i.term_months > 0) || vals.some((v) => !(v >= 0))) return null;
  const cap = rateCap(i.type);
  let interest_cents: number;
  let stated: number | null = null;
  if (i.interest.mode === 'rand') {
    if (!(i.interest.cents >= 0)) return null;
    interest_cents = Math.round(i.interest.cents);
  } else {
    if (!(i.interest.rate >= 0)) return null;
    const monthly = i.interest.mode === 'pct_month' ? i.interest.rate : i.interest.rate / 12;
    // Simple interest on the full amount: an upper estimate for loans paid off in instalments.
    interest_cents = Math.round(i.principal_cents * (monthly / 100) * i.term_months);
    // Compare like with like: the stated rate in the cap's own unit.
    stated = cap.per === 'month' ? monthly : i.interest.mode === 'pct_year' ? i.interest.rate : i.interest.rate * 12;
    stated = Math.round(stated * 100) / 100;
  }
  const fees_cents = i.initiation_cents + i.service_monthly_cents * i.term_months + i.other_fees_cents;
  const total_cents = i.principal_cents + interest_cents + fees_cents;
  const cost_cents = interest_cents + fees_cents;
  const initCap = maxInitiationFee(i.type, i.principal_cents);
  return {
    interest_cents,
    fees_cents,
    total_cents,
    cost_cents,
    monthly_cents: Math.round(total_cents / i.term_months),
    cost_pct: Math.round((cost_cents / i.principal_cents) * 1000) / 10,
    interest_estimated: i.interest.mode !== 'rand',
    // A rand interest amount can't be turned into the legal (stated) rate reliably, so no verdict.
    rate: { verdict: stated == null ? 'unknown' : stated > cap.max + 1e-9 ? 'above' : 'within', stated, cap },
    initiation: { verdict: i.initiation_cents > initCap ? 'above' : 'within', cap_cents: initCap },
    service: { verdict: i.service_monthly_cents > MAX_SERVICE_FEE ? 'above' : 'within', cap_cents: MAX_SERVICE_FEE },
  };
}
