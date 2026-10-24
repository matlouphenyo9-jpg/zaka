import { describe, expect, it } from 'vitest';
import { loanCost, type LoanInput } from './loan';
import { maxInitiationFee, rateCap } from './legal';

const base: LoanInput = { principal_cents: 100000, interest: { mode: 'pct_month', rate: 5 }, initiation_cents: 0, service_monthly_cents: 0, other_fees_cents: 0, term_months: 1, type: 'short_first' };

describe('Loan Check', () => {
  it('reproduces the R5 worked example', () => {
    const r = loanCost({ ...base, other_fees_cents: 10000 })!;
    expect(r.total_cents).toBe(115000);
    expect(r.cost_cents).toBe(15000);
    expect(r.rate.verdict).toBe('within');
  });
  it('flags a short-term rate above 5% a month', () => {
    expect(loanCost({ ...base, interest: { mode: 'pct_month', rate: 30 } })!.rate.verdict).toBe('above');
  });
  it('uses 3% for a repeat short-term loan', () => {
    const r = loanCost({ ...base, type: 'short_repeat', interest: { mode: 'pct_month', rate: 4 }, term_months: 2 })!;
    expect(r.interest_cents).toBe(8000);
    expect(r.rate.verdict).toBe('above');
  });
  it('compares annual-rate credit with repo + margin (unsecured: 7.25 + 21 = 28.25% a year)', () => {
    expect(rateCap('unsecured')).toEqual({ per: 'year', max: 28.25 });
    expect(loanCost({ ...base, type: 'unsecured', interest: { mode: 'pct_year', rate: 28 }, term_months: 12 })!.rate.verdict).toBe('within');
    expect(loanCost({ ...base, type: 'unsecured', interest: { mode: 'pct_month', rate: 2.5 }, term_months: 12 })!.rate).toMatchObject({ verdict: 'above', stated: 30 });
  });
  it('has caps for every credit type from R8', () => {
    expect(rateCap('mortgage').max).toBe(19.25);
    expect(rateCap('credit_facility').max).toBe(21.25);
    expect(rateCap('developmental_business').max).toBe(34.25);
    expect(rateCap('other').max).toBe(24.25);
  });
  it('gives no legal verdict from a rand interest amount', () => {
    expect(loanCost({ ...base, interest: { mode: 'rand', cents: 30000 } })!.rate.verdict).toBe('unknown');
  });
  it('checks the initiation fee cap, including 15% of principal for short-term', () => {
    expect(maxInitiationFee('short_first', 100000)).toBe(15000); // R165 base, but max 15% of R1,000
    expect(maxInitiationFee('unsecured', 500000)).toBe(56500); // R165 + 10% of R4,000
    expect(maxInitiationFee('unsecured', 5000000)).toBe(105000); // capped at R1,050
    expect(maxInitiationFee('mortgage', 100000000)).toBe(525000);
    expect(loanCost({ ...base, initiation_cents: 20000 })!.initiation.verdict).toBe('above');
  });
  it('checks the R60 monthly service fee and adds it for every month', () => {
    const r = loanCost({ ...base, service_monthly_cents: 6900, term_months: 3, interest: { mode: 'pct_month', rate: 3 } })!;
    expect(r.service.verdict).toBe('above');
    expect(r.fees_cents).toBe(20700);
  });
  it('rejects missing terms', () => {
    expect(loanCost({ ...base, principal_cents: 0 })).toBeNull();
  });
});
