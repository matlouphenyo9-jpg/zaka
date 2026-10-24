// National Credit Regulations, reg. 42 (as amended by GN 1080 of 2015) and reg. 44, from Notion task R8 Part B.
// Repo-linked caps use the SARB repo rate; refresh REPO when the MPC changes it.
export const REPO = { rate: 7.25, effective: '2026-09-25', source: 'https://www.resbank.co.za/en/home/publications/publication-detail-pages/statements/monetary-policy-statements/2026/september' };
export const LEGAL_CHECKED = '2026-10-24';
export const REG42_SOURCE = 'https://www.gov.za/sites/default/files/gcis_document/201511/39379gon1080.pdf';

export type CreditType =
  | 'short_first' | 'short_repeat' | 'unsecured' | 'credit_facility' | 'mortgage'
  | 'developmental_business' | 'developmental_housing' | 'other';

export const CREDIT_TYPES: CreditType[] = ['short_first', 'short_repeat', 'unsecured', 'credit_facility', 'mortgage', 'developmental_business', 'developmental_housing', 'other'];

interface Rule {
  /** monthly cap (short-term) or repo margin for an annual cap */
  rate: { per: 'month'; max: number } | { per: 'year'; margin: number };
  /** initiation fee: base + 10% of the amount above `above`, capped at `max` (and pct of principal for short-term) */
  init: { base: number; above: number; max: number; maxPctOfPrincipal?: number };
}

const R = (rands: number) => rands * 100;
const SHORT_INIT = { base: R(165), above: R(1000), max: R(1050), maxPctOfPrincipal: 15 };
export const RULES: Record<CreditType, Rule> = {
  short_first: { rate: { per: 'month', max: 5 }, init: SHORT_INIT },
  short_repeat: { rate: { per: 'month', max: 3 }, init: SHORT_INIT },
  unsecured: { rate: { per: 'year', margin: 21 }, init: { base: R(165), above: R(1000), max: R(1050) } },
  credit_facility: { rate: { per: 'year', margin: 14 }, init: { base: R(165), above: R(1000), max: R(1050) } },
  mortgage: { rate: { per: 'year', margin: 12 }, init: { base: R(1100), above: R(10000), max: R(5250) } },
  developmental_business: { rate: { per: 'year', margin: 27 }, init: { base: R(275), above: R(1000), max: R(2600) } },
  developmental_housing: { rate: { per: 'year', margin: 27 }, init: { base: R(550), above: R(1000), max: R(2600) } },
  other: { rate: { per: 'year', margin: 17 }, init: { base: R(165), above: R(1000), max: R(1050) } },
};

/** Monthly service fee cap (reg. 44), cents. */
export const MAX_SERVICE_FEE = R(60);

/** The legal interest cap for a credit type: { per, max } in % (per month or per year). */
export function rateCap(type: CreditType): { per: 'month' | 'year'; max: number } {
  const r = RULES[type].rate;
  return r.per === 'month' ? { per: 'month', max: r.max } : { per: 'year', max: Math.round((REPO.rate + r.margin) * 100) / 100 };
}

/** Maximum initiation fee for a loan of `principal` cents. */
export function maxInitiationFee(type: CreditType, principal: number): number {
  const i = RULES[type].init;
  let cap = Math.min(i.max, i.base + Math.max(0, Math.round((principal - i.above) * 0.1)));
  if (i.maxPctOfPrincipal != null) cap = Math.min(cap, Math.floor((principal * i.maxPctOfPrincipal) / 100));
  return cap;
}
