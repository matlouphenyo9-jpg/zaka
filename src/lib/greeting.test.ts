import { describe, expect, it } from 'vitest';
import { greetingKey, hourSA } from './greeting';

// SA is UTC+2 all year (no daylight saving).
const at = (utc: string) => new Date(`2026-10-26T${utc}:00Z`);

describe('greeting by South African time', () => {
  it('uses Johannesburg time, not the phone’s', () => expect(hourSA(at('22:30'))).toBe(0));
  it.each([
    ['02:59', 'greet_evening'], // 04:59 SA
    ['03:00', 'greet_morning'], // 05:00
    ['09:59', 'greet_morning'], // 11:59
    ['10:00', 'greet_afternoon'], // 12:00
    ['15:59', 'greet_afternoon'], // 17:59
    ['16:00', 'greet_evening'], // 18:00
    ['21:59', 'greet_evening'], // 23:59
  ])('%s UTC → %s', (utc, key) => expect(greetingKey(at(utc))).toBe(key));
});
