import { parseRands } from './validate';
// Money is integer cents everywhere. Formatting keeps the "R" and digits stable in every language.

export function formatRand(cents: number, opts: { cents?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const showCents = opts.cents ?? rem !== 0;
  const s = showCents ? `R${whole}.${String(rem).padStart(2, '0')}` : `R${whole}`;
  return neg ? `−${s}` : s;
}

/**
 * Parse what a person types ("350", "R1 200,50", "1200.5") into cents. Returns null when invalid (see lib/validate:
 * letters, signs, "1e9", emoji and more than R1,000,000 are refused). "0" is returned as 0; callers decide if 0 is allowed.
 */
export function parseRandInput(input: string): number | null {
  if (/^\s*R?\s*0+([.,]0{1,2})?\s*$/i.test(input)) return 0;
  const r = parseRands(input);
  return r.ok ? r.value : null;
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Forecast numbers are estimates: show whole rands, rounded towards caution (down for money you have). */
export function formatEstimate(cents: number): string {
  return formatRand(cents >= 0 ? Math.floor(cents / 100) * 100 : -Math.ceil(-cents / 100) * 100);
}
