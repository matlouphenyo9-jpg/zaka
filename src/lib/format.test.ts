import { afterEach, describe, expect, it, vi } from 'vitest';

let current = 'zu-ZA';
vi.mock('../i18n', () => ({ bcp47: () => current }));
const { shortDate, weekdayName, longDate, weekdayFromIndex } = await import('./format');

describe('dates in the chosen language', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses bundled CLDR names when the browser has no data for the locale', () => {
    vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf').mockReturnValue([]);
    current = 'zu-ZA';
    expect(weekdayName('2026-10-27')).toBe('ULwesibili');
    expect(shortDate('2026-10-27')).toBe('Bil, Okt 27');
    current = 'xh-ZA';
    expect(weekdayFromIndex(0)).toBe('Cawe');
    current = 'nso-ZA';
    expect(weekdayName('2026-10-30')).toBe('Labohlano');
    expect(longDate('2026-10-30')).toBe('2026 Dipha 30');
  });

  it('falls back to South African English for a locale with neither', () => {
    vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf').mockReturnValue([]);
    current = 'af-ZA';
    expect(weekdayName('2026-10-27')).toBe('Tuesday');
  });

  it('prefers the browser data when it has the locale', () => {
    current = 'af-ZA';
    expect(weekdayName('2026-10-27')).toBe('Dinsdag');
  });
});
