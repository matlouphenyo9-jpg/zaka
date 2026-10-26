// Home greeting by South African time: morning 05:00–11:59, afternoon 12:00–17:59, evening 18:00–04:59.
export type GreetingKey = 'greet_morning' | 'greet_afternoon' | 'greet_evening';

/** The hour (0–23) in Africa/Johannesburg, whatever the phone's own time zone is. */
export function hourSA(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', hour: '2-digit', hourCycle: 'h23' }).format(now);
  return Number(h) % 24;
}

export function greetingKey(now: Date = new Date()): GreetingKey {
  const h = hourSA(now);
  if (h >= 5 && h < 12) return 'greet_morning';
  if (h >= 12 && h < 18) return 'greet_afternoon';
  return 'greet_evening';
}
