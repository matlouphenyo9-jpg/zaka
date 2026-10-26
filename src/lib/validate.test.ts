import { describe, expect, it } from 'vitest';
import { cleanName, cleanNote, entryDateError, looksLikeMash, parseRands, scamTextError, stripInvisible, typedEntryError } from './validate';

const ok = (s: string) => {
  const r = parseRands(s);
  return r.ok ? r.value : r.error;
};

describe('parseRands: South African amount formats', () => {
  it.each([
    ['350', 35000], ['R350', 35000], ['r 350', 35000], ['350,50', 35050], ['350.5', 35050], ['1 250', 125000],
    ['1 250,50', 125050], ['1,250', 125000], ['1,250.50', 125050], ['1.250,50', 125050], ['R1 000 000', 100_000_000],
    ['0,50', 50], [' 42 ', 4200], ['007', 700],
  ])('accepts %s', (input, cents) => expect(ok(input)).toBe(cents));

  it.each([
    ['', 'amount_empty'], ['   ', 'amount_empty'], ['abc', 'amount_invalid'], ['-5', 'amount_invalid'], ['--5', 'amount_invalid'],
    ['+5', 'amount_invalid'], ['1e9', 'amount_invalid'], ['12.345', 'amount_invalid'], ['1.2.3', 'amount_invalid'], ['💰', 'amount_invalid'],
    ['350💰', 'amount_invalid'], ['12 50', 'amount_invalid'], ['0', 'amount_zero'], ['0,00', 'amount_zero'], ['1000000,01', 'amount_too_big'],
    ['9999999999', 'amount_too_big'], ['Infinity', 'amount_invalid'], ['NaN', 'amount_invalid'], ['0x10', 'amount_invalid'],
    ["'; drop table transactions;--", 'amount_invalid'], ['<script>alert(1)</script>', 'amount_invalid'],
  ])('rejects %j', (input, err) => expect(ok(input)).toBe(err));

  it('ignores invisible characters hidden inside a number', () => expect(ok('3\u200B50')).toBe(35000));
});

describe('text fields', () => {
  it('trims, collapses spaces and strips invisible and bidi-override characters', () => {
    expect(cleanName('  Rent \u200B  money \u202E ')).toEqual({ ok: true, value: 'Rent money' });
    expect(stripInvisible('a\u202Eb\u2066c\uFEFFd')).toBe('abcd');
  });
  it('rejects keyboard-mash with no letters', () => {
    expect(cleanName('!!!!!')).toEqual({ ok: false, error: 'text_no_letters' });
    expect(cleanName('@@@@')).toEqual({ ok: false, error: 'text_no_letters' });
    expect(cleanName('12345')).toEqual({ ok: false, error: 'text_no_letters' });
  });
  it('enforces length limits (names 40, notes 140) and required names', () => {
    expect(cleanName('a'.repeat(41)).ok).toBe(false);
    expect(cleanName('a'.repeat(40)).ok).toBe(true);
    expect(cleanNote('a'.repeat(141))).toEqual({ ok: false, error: 'text_too_long' });
    expect(cleanNote('')).toEqual({ ok: true, value: '' });
    expect(cleanName('   ')).toEqual({ ok: false, error: 'text_empty' });
  });
  it('keeps attack strings as inert text (React escapes output) but they still need letters', () => {
    expect(cleanNote('<script>alert(1)</script>').ok).toBe(true);
    expect(cleanName('"><img src=x onerror=alert(1)>').ok).toBe(true);
  });
  it('accepts names in all five languages', () => {
    for (const n of ['Stokvel', 'Isibonelelo', 'Thušo ya mmušo', 'Skoolfonds', 'Imali yesikolo']) expect(cleanName(n).ok).toBe(true);
  });
});

describe('dates', () => {
  const today = '2026-10-26';
  it('allows 1 Jan 2024 up to 7 days ahead', () => {
    expect(entryDateError('2024-01-01', today)).toBeNull();
    expect(entryDateError('2026-11-02', today)).toBeNull();
    expect(entryDateError('2023-12-31', today)).toBe('date_too_old');
    expect(entryDateError('2026-11-03', today)).toBe('date_too_far');
    expect(entryDateError('2026-02-30', today)).toBe('date_invalid');
    expect(entryDateError('yesterday', today)).toBe('date_invalid');
  });
});

describe('Type it and Scam Shield input', () => {
  it('rejects too short, too long and gibberish', () => {
    expect(typedEntryError('ab')).toBe('typed_short');
    expect(typedEntryError('x'.repeat(201))).toBe('typed_long');
    expect(typedEntryError('asdkjhqwe')).toBe('typed_gibberish');
    expect(typedEntryError('qwrtpsdf zxcvb')).toBe('typed_gibberish');
    expect(typedEntryError('!!!! 123')).toBe('typed_gibberish');
  });
  it('accepts real sentences in all five languages', () => {
    for (const s of ['got R350 from a piece job', 'ndifumene i-R350 ngomsebenzi wethutyana', 'ngithole u-R350 ngetogo', 'ke hweditše R350 mošomong wa nakwana', 'R350 gekry vir stukwerk', 'taxi 25']) {
      expect(typedEntryError(s)).toBeNull();
    }
  });
  it('detects mash but not real words', () => {
    expect(looksLikeMash('hjkl qwrtz')).toBe(true);
    expect(looksLikeMash('Umsebenzi wethutyana')).toBe(false);
    expect(looksLikeMash('Ndifumene imali')).toBe(false);
  });
  it('Scam Shield needs 10–2,000 characters with words', () => {
    expect(scamTextError('hi')).toBe('scam_short');
    expect(scamTextError('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨')).toBe('scam_no_words');
    expect(scamTextError('!!!!!!!!!!!!!!!!!!!')).toBe('scam_no_words');
    expect(scamTextError('a'.repeat(2001))).toBe('scam_long');
    expect(scamTextError('SASSA: pay R50 to release your grant')).toBeNull();
  });
});

describe('everyday costs stay realistic (same limits as the database)', () => {
  it('flags the first out-of-range field', async () => {
    const { essentialsError } = await import('./validate');
    expect(essentialsError({ transport_daily_cents: 4800, food_weekly_cents: 60000, trips_per_day: 2 })).toBeNull();
    expect(essentialsError({ transport_daily_cents: 100_001 })).toBe('transport_daily_cents');
    expect(essentialsError({ food_weekly_cents: 2_000_000 })).toBe('food_weekly_cents');
    expect(essentialsError({ trips_per_day: 11 })).toBe('trips_per_day');
    expect(essentialsError({ data_weekly_cents: -1 })).toBe('data_weekly_cents');
    expect(essentialsError({ fare_single_cents: Number.NaN })).toBe('fare_single_cents');
  });
});
