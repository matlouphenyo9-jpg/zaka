import { describe, expect, it } from 'vitest';
import { loanCost } from './loan';

describe('Loan Check', () => {
  it('reproduces the R5 worked example', () => {
    const r = loanCost({ principal_cents: 100000, interest: { mode: 'pct_month', rate: 5 }, fees_cents: 10000, term_months: 1, type: 'short_first' })!;
    expect(r.total_cents).toBe(115000);
    expect(r.cost_cents).toBe(15000);
    expect(r.above_limit).toBe(false);
  });
  it('flags interest above the short-term maximum', () => {
    const r = loanCost({ principal_cents: 100000, interest: { mode: 'rand', cents: 30000 }, fees_cents: 0, term_months: 1, type: 'short_first' })!;
    expect(r.monthly_rate).toBe(30);
    expect(r.above_limit).toBe(true);
  });
  it('uses 3% for a repeat short-term loan', () => {
    const r = loanCost({ principal_cents: 100000, interest: { mode: 'pct_month', rate: 4 }, fees_cents: 0, term_months: 2, type: 'short_repeat' })!;
    expect(r.interest_cents).toBe(8000);
    expect(r.above_limit).toBe(true);
  });
  it('has no verified maximum for other credit', () => {
    expect(loanCost({ principal_cents: 100000, interest: { mode: 'pct_month', rate: 4 }, fees_cents: 0, term_months: 2, type: 'other' })!.above_limit).toBeNull();
  });
  it('rejects missing terms', () => {
    expect(loanCost({ principal_cents: 0, interest: { mode: 'pct_month', rate: 4 }, fees_cents: 0, term_months: 2, type: 'other' })).toBeNull();
  });
});
