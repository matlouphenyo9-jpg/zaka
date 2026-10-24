import { describe, expect, it } from 'vitest';
import { seedLerato } from '../data/demo';
import { buildForecast } from './forecast';
import { buildInsights } from './insights';
import { addDays } from '../lib/dates';

const DATES = ['2026-10-24', '2026-11-02', '2026-11-15', '2026-12-01', '2027-01-20', '2027-02-27'];

describe('judge demo state (holds for any judging date)', () => {
  for (const today of DATES) {
    it(`today = ${today}`, () => {
      const s = seedLerato(today);
      const f = buildForecast({ today, ...s });
      if (process.env.DEBUG_DEMO) {
        console.log(today, { bal: f.balance_cents, H: f.horizon_days, safe: f.safe_cents, daily: f.daily_cents, setAside: f.set_asides, sf: f.shortfall, conf: f.confidence, rec: f.patterns.recurring.map((p) => [p.key, p.day, p.occurrences]), pj: f.patterns.pieceJobs, ess: f.essentials });
        console.log(f.days.map((d) => `${d.date} +${d.income_cents} -${d.costs_cents} -${d.essentials_cents} = ${d.balance_cents}`).join('\n'));
        console.log(buildInsights(f));
      }
      // a detected grant pattern
      expect(f.patterns.recurring.find((p) => p.source === 'grant')?.strength).toBe('strong');
      // piece-job frequency
      expect(f.patterns.pieceJobs?.per_week).toBeGreaterThan(1);
      // an upcoming stokvel payment
      expect(f.costs.some((c) => c.category === 'stokvel' && c.date === addDays(today, 5))).toBe(true);
      // a predicted tight day within 14 days
      expect(f.shortfall).not.toBeNull();
      expect(f.confidence.level).toBe('high');
      // a positive safe-to-spend number
      expect(f.safe_cents).toBeGreaterThan(0);

      // adding the R350 piece job today visibly pushes the shortfall back
      const after = buildForecast({
        today, ...s,
        txns: [...s.txns, { id: 'new', direction: 'in', amount_cents: 35000, category: 'piece_job', source: 'piece_job', occurred_on: today, created_via: 'ai_parsed', confirmed: true }],
      });
      if (process.env.DEBUG_DEMO) console.log('after', { safe: after.safe_cents, H: after.horizon_days, sf: after.shortfall });
      expect(after.shortfall === null || after.shortfall.date > f.shortfall!.date).toBe(true);
      expect(after.safe_cents).toBeGreaterThan(f.safe_cents);
    });
  }
});
