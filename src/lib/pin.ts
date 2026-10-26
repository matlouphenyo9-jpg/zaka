// B4-B: optional 4-digit PIN lock for shared family phones. Device-only: only a salted PBKDF2 hash is kept in this
// phone's storage (per account), never the PIN itself, and nothing is ever sent to the server. Logging out wipes it.
export const PIN_ITERATIONS = 210_000;
export const LOCK_AFTER_MS = 5 * 60_000; // ask again after 5 minutes in the background
export const WAIT_AFTER = 5; // wrong tries before a 30 s wait
export const WIPE_AFTER = 10; // wrong tries before sign-out and wipe
export const WAIT_MS = 30_000;

const key = (uid: string) => `zaka.pin.${uid}`;
const failsKey = (uid: string) => `zaka.pin.fails.${uid}`;

type Stored = { salt: string; hash: string; iter: number };
type Fails = { count: number; until: number };

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

/** Rejects PINs that are easy to guess: not 4 digits, all the same, runs (1234, 9876), ABAB (1212) and common picks. */
export function weakPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  if (d.every((x) => x === d[0])) return true;
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return true;
  if (d[0] === d[2] && d[1] === d[3]) return true; // 1212, 6969
  if (d[0] === d[1] && d[2] === d[3]) return true; // 1122, 7788
  return ['2580', '0852', '1004', '2000', '1998', '1999', '2001', '2020', '2026', '0007', '1000'].includes(pin);
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256);
  return b64(bits);
}

function read<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export function pinEnabled(uid: string): boolean {
  return !!read<Stored>(key(uid))?.hash;
}

export async function setPin(uid: string, pin: string): Promise<void> {
  if (weakPin(pin)) throw new Error('weak_pin');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, PIN_ITERATIONS);
  localStorage.setItem(key(uid), JSON.stringify({ salt: b64(salt), hash, iter: PIN_ITERATIONS } satisfies Stored));
  localStorage.removeItem(failsKey(uid));
}

export function removePin(uid: string) {
  localStorage.removeItem(key(uid));
  localStorage.removeItem(failsKey(uid));
}

/** Milliseconds left before another try is allowed. */
export function pinWaitLeft(uid: string, now = Date.now()): number {
  return Math.max(0, (read<Fails>(failsKey(uid))?.until ?? 0) - now);
}

/** Checks a PIN. 'wipe' means 10 wrong tries: the caller must sign out and wipe the phone. */
export async function checkPin(uid: string, pin: string, now = Date.now()): Promise<'ok' | 'wrong' | 'wait' | 'wipe'> {
  const s = read<Stored>(key(uid));
  if (!s) return 'ok';
  if (pinWaitLeft(uid, now) > 0) return 'wait';
  // Constant-shape comparison of two base64 strings of equal length.
  const got = await derive(pin, unb64(s.salt), s.iter);
  let diff = got.length ^ s.hash.length;
  for (let i = 0; i < Math.min(got.length, s.hash.length); i++) diff |= got.charCodeAt(i) ^ s.hash.charCodeAt(i);
  if (diff === 0) {
    localStorage.removeItem(failsKey(uid));
    return 'ok';
  }
  const f = read<Fails>(failsKey(uid)) ?? { count: 0, until: 0 };
  const count = f.count + 1;
  if (count >= WIPE_AFTER) return 'wipe';
  localStorage.setItem(failsKey(uid), JSON.stringify({ count, until: count % WAIT_AFTER === 0 ? now + WAIT_MS : 0 } satisfies Fails));
  return count % WAIT_AFTER === 0 ? 'wait' : 'wrong';
}

export function pinFailures(uid: string): number {
  return read<Fails>(failsKey(uid))?.count ?? 0;
}
