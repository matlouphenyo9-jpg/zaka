// B4-A: sign-in and sign-up rules. Supabase enforces the password policy and rate limits on the server too.
export const SUPPORT_EMAIL = 'support@jis-tech.co.za';
export const MAX_FAILS = 5;
export const COOLDOWN_MS = 30_000;
const FAILS_KEY = 'zaka.login.fails';

/** Trims and lower-cases; null if it isn't a plausible email (no spaces, one @, a dot in the domain, ≤254 chars). */
export function normaliseEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  if (!e || e.length > 254 || /\s/.test(e)) return null;
  if (!/^[^@\s]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e)) return null;
  if (/[<>()[\]\\,;:"]/.test(e.split('@')[0])) return null;
  return e;
}

export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  number: boolean;
  ok: boolean;
}

/** At least 8 characters with at least one letter and one number (the same rule is set in Supabase Auth). */
export function checkPassword(pw: string): PasswordCheck {
  const length = pw.length >= 8 && pw.length <= 72; // bcrypt ignores bytes after 72
  const letter = /\p{L}/u.test(pw);
  const number = /\d/.test(pw);
  return { length, letter, number, ok: length && letter && number };
}

type Fails = { count: number; until: number };

function read(): Fails {
  try {
    const v = JSON.parse(localStorage.getItem(FAILS_KEY) ?? 'null') as Fails | null;
    return v && typeof v.count === 'number' && typeof v.until === 'number' ? v : { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

function write(f: Fails) {
  try {
    localStorage.setItem(FAILS_KEY, JSON.stringify(f));
  } catch {
    /* private mode */
  }
}

/** Milliseconds left in the cool-down, or 0. Survives a page refresh. */
export function cooldownLeft(now = Date.now()): number {
  return Math.max(0, read().until - now);
}

/** Records a failed sign-in; every 5th failure starts a 30-second cool-down (doubling each time, up to 8 minutes). */
export function recordFailure(now = Date.now()): number {
  const f = read();
  const count = f.count + 1;
  let until = f.until;
  if (count % MAX_FAILS === 0) until = now + Math.min(COOLDOWN_MS * 2 ** (count / MAX_FAILS - 1), 16 * COOLDOWN_MS);
  write({ count, until });
  return Math.max(0, until - now);
}

export function clearFailures() {
  try {
    localStorage.removeItem(FAILS_KEY);
  } catch {
    /* ignore */
  }
}

/** Maps a Supabase auth error to a message key that never reveals whether an email is registered. */
export function authErrorKey(err: { status?: number; code?: string; message?: string }, mode: 'signin' | 'signup'): string {
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (err.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || msg.includes('rate limit')) return 'auth_rate_limited';
  if (mode === 'signup' && (code === 'weak_password' || msg.includes('password'))) return 'auth_password_rule';
  if (mode === 'signup') return 'auth_signup_failed';
  return 'auth_error';
}
