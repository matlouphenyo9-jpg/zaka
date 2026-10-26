import { beforeEach, describe, expect, it } from 'vitest';
import { authErrorKey, checkPassword, clearFailures, cooldownLeft, normaliseEmail, recordFailure } from './authRules';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe('email', () => {
  it('trims and lower-cases', () => expect(normaliseEmail('  Lerato@Example.CO.ZA ')).toBe('lerato@example.co.za'));
  it.each(['', 'lerato', 'le rato@x.co.za', 'a@b', '@x.co', 'a@x..co', `${'a'.repeat(250)}@x.co`, '<script>@x.co', 'a@-x.co', "x'; drop table users;--@x.co"])('rejects %j', (e) =>
    expect(normaliseEmail(e)).toBeNull(),
  );
});

describe('password rule: 8+ characters, a letter and a number', () => {
  it.each([['short1', false], ['longenough', false], ['12345678', false], ['abcd1234', true], ['Zaka2026!demo', true], ['ábcdefg1', true]])('%s → %s', (pw, ok) =>
    expect(checkPassword(pw as string).ok).toBe(ok),
  );
  it('rejects passwords longer than bcrypt can use', () => expect(checkPassword('a1'.repeat(40)).ok).toBe(false));
});

describe('login cool-down', () => {
  beforeEach(() => clearFailures());
  it('starts a 30 s wait after 5 failures and doubles after 10', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) expect(recordFailure(t0)).toBe(0);
    expect(recordFailure(t0)).toBe(30_000);
    expect(cooldownLeft(t0 + 10_000)).toBe(20_000);
    expect(cooldownLeft(t0 + 31_000)).toBe(0);
    for (let i = 0; i < 4; i++) recordFailure(t0 + 40_000);
    expect(recordFailure(t0 + 40_000)).toBe(60_000);
  });
});

describe('sign-up gives the same answer for a new and an existing email', () => {
  it('new account and existing account → the same message', async () => {
    const { signupMessageKey } = await import('./authRules');
    expect(signupMessageKey(null)).toBe('auth_signup_done');
    expect(signupMessageKey({ status: 422, code: 'user_already_exists', message: 'User already registered' })).toBe('auth_signup_done');
    expect(signupMessageKey({ status: 400, code: 'email_exists' })).toBe('auth_signup_done');
  });
  it('still explains a weak password or too many tries (they reveal nothing about accounts)', async () => {
    const { signupMessageKey } = await import('./authRules');
    expect(signupMessageKey({ status: 422, code: 'weak_password' })).toBe('auth_password_rule');
    expect(signupMessageKey({ status: 429 })).toBe('auth_rate_limited');
  });
});

describe('auth errors never reveal whether an email exists', () => {
  it('sign-in: wrong password and unknown email give the same message', () => {
    expect(authErrorKey({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, 'signin')).toBe('auth_error');
    expect(authErrorKey({ status: 400, code: 'email_not_confirmed' }, 'signin')).toBe('auth_error');
  });
  it('sign-up: an existing account gets a generic message', () => {
    expect(authErrorKey({ status: 422, code: 'user_already_exists', message: 'User already registered' }, 'signup')).toBe('auth_signup_failed');
  });
  it('rate limits and weak passwords are explained', () => {
    expect(authErrorKey({ status: 429 }, 'signin')).toBe('auth_rate_limited');
    expect(authErrorKey({ status: 422, code: 'weak_password' }, 'signup')).toBe('auth_password_rule');
  });
});
