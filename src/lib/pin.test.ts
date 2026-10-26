import { beforeEach, describe, expect, it } from 'vitest';
import { checkPin, pinEnabled, pinFailures, pinWaitLeft, removePin, setPin, weakPin } from './pin';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size; },
} as Storage;

describe('weak PINs are refused', () => {
  it.each(['0000', '1111', '1234', '4321', '6789', '9876', '1212', '6969', '1122', '2580', '123', '12345', 'abcd', ''])('%j is weak', (p) => expect(weakPin(p)).toBe(true));
  it.each(['4831', '7294', '0571', '3916'])('%s is fine', (p) => expect(weakPin(p)).toBe(false));
});

describe('PIN lock', () => {
  const uid = 'user-1';
  beforeEach(() => store.clear());

  it('stores only a salted hash, never the PIN', async () => {
    await setPin(uid, '4831');
    expect(pinEnabled(uid)).toBe(true);
    const raw = [...store.values()].join(' ');
    expect(raw).not.toContain('4831');
    expect(JSON.parse(store.get(`zaka.pin.${uid}`)!)).toMatchObject({ iter: 210000 });
  });

  it('two accounts with the same PIN get different hashes (salted)', async () => {
    await setPin('a', '4831');
    await setPin('b', '4831');
    expect(JSON.parse(store.get('zaka.pin.a')!).hash).not.toBe(JSON.parse(store.get('zaka.pin.b')!).hash);
  });

  it('accepts the right PIN and refuses a wrong one', async () => {
    await setPin(uid, '4831');
    expect(await checkPin(uid, '4831')).toBe('ok');
    expect(await checkPin(uid, '4832')).toBe('wrong');
    expect(pinFailures(uid)).toBe(1);
  });

  it('5 wrong tries → 30 s wait; 10 wrong tries → wipe', async () => {
    await setPin(uid, '4831');
    const t0 = 1_000_000;
    for (let i = 1; i <= 4; i++) expect(await checkPin(uid, '0571', t0)).toBe('wrong');
    expect(await checkPin(uid, '0571', t0)).toBe('wait');
    expect(await checkPin(uid, '4831', t0 + 1_000)).toBe('wait'); // even the right PIN must wait
    expect(pinWaitLeft(uid, t0 + 1_000)).toBe(29_000);
    const t1 = t0 + 31_000;
    for (let i = 6; i <= 9; i++) expect(await checkPin(uid, '0571', t1)).toBe('wrong');
    expect(await checkPin(uid, '0571', t1)).toBe('wipe');
  });

  it('refuses to set a weak PIN, and can be turned off', async () => {
    await expect(setPin(uid, '1234')).rejects.toThrow('weak_pin');
    await setPin(uid, '4831');
    removePin(uid);
    expect(pinEnabled(uid)).toBe(false);
    expect(await checkPin(uid, 'anything')).toBe('ok');
  });
});
