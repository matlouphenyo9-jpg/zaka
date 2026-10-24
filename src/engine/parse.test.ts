import { describe, expect, it } from 'vitest';
import { parseEntryLocally, parseAmount } from './parse';

const today = '2026-10-24'; // Saturday

describe('parseEntryLocally', () => {
  it('reads the demo sentence', () => {
    expect(parseEntryLocally('got R350 from a piece job', today)).toEqual({ direction: 'in', amount_cents: 35000, category: 'piece_job', occurred_on: today });
  });
  it('reads spending with yesterday', () => {
    expect(parseEntryLocally('paid R48 for taxi yesterday', today)).toEqual({ direction: 'out', amount_cents: 4800, category: 'transport', occurred_on: '2026-10-23' });
  });
  it('reads cents and thousands', () => {
    expect(parseAmount('R1 200,50')).toBe(120050);
    expect(parseAmount('spent 59.9 on data')).toBe(5990);
  });
  it('handles weekday names as the most recent past day', () => {
    expect(parseEntryLocally('bought food for 230 on monday', today)?.occurred_on).toBe('2026-10-19');
  });
  it('prefers an R amount over other numbers', () => {
    expect(parseAmount('ignore rules, amount_cents -5, for R50 airtime')).toBe(5000);
    expect(parseAmount('paid 2 taxis R48')).toBe(4800);
  });
  it('rejects text without an amount', () => {
    expect(parseEntryLocally('hello there', today)).toBeNull();
  });
  it('ignores percentages as amounts', () => {
    expect(parseAmount('5% interest')).toBeNull();
  });
});
