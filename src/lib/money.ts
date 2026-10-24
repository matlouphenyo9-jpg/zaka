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

/** Parse what a person types ("350", "R1 200,50", "1200.5") into cents. Returns null when invalid. */
export function parseRandInput(input: string): number | null {
  const cleaned = input.replace(/[Rr\s ]/g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Forecast numbers are estimates: show whole rands, rounded towards caution (down for money you have). */
export function formatEstimate(cents: number): string {
  return formatRand(cents >= 0 ? Math.floor(cents / 100) * 100 : -Math.ceil(-cents / 100) * 100);
}
