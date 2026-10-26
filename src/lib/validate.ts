// Input rules shared by every form (B4 section C). The same limits are enforced again by Postgres CHECK constraints
// and triggers (supabase/migrations/*_input_guards.sql) and in the Edge Functions, so skipping the app gains nothing.
import { addDays, isValidISODate, type ISODate } from './dates';

export const MAX_AMOUNT_CENTS = 100_000_000; // R1,000,000 per entry
export const BIG_AMOUNT_CENTS = 5_000_000; // above R50,000: ask "is that right?"
export const BIG_BALANCE_CENTS = 50_000_000; // a balance above R500,000: ask too
export const MIN_ENTRY_DATE: ISODate = '2024-01-01';
export const MAX_FUTURE_DAYS = 7;
export const NAME_MAX = 40;
export const NOTE_MAX = 140;

export type AmountError = 'amount_empty' | 'amount_invalid' | 'amount_zero' | 'amount_too_big';
export type TextError = 'text_empty' | 'text_too_long' | 'text_no_letters';
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Parses a rand amount typed by a person: "350", "R350", "r 350,50", "1 250", "1 250,50", "1,250.50", "350.5".
 * Rejects letters, signs, exponents ("1e9"), emoji, more than 2 decimals, zero and anything above R1,000,000.
 */
export function parseRands(input: string): Result<number, AmountError> {
  let s = stripInvisible(String(input ?? '')).replace(/[\s\u00a0\u202f]+/g, ' ').trim();
  if (!s) return { ok: false, error: 'amount_empty' };
  s = s.replace(/^r\s?/i, '');
  // Spaces may only separate groups of three digits ("1 250"), never split a number elsewhere.
  if (/^\d{1,3}( \d{3})+([.,]\d{1,2})?$/.test(s)) s = s.replace(/ /g, '');
  let m: RegExpMatchArray | null;
  let int: string;
  let dec = '';
  if ((m = s.match(/^(\d+)$/))) int = m[1];
  else if ((m = s.match(/^(\d+)[.,](\d{1,2})$/))) [int, dec] = [m[1], m[2]]; // 350,50 · 350.5
  else if ((m = s.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/))) [int, dec] = [m[1].replace(/,/g, ''), m[2] ?? '']; // 1,250.50
  else if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/))) [int, dec] = [m[1].replace(/\./g, ''), m[2]]; // 1.250,50 (never "12.345": ambiguous)
  else return { ok: false, error: 'amount_invalid' };
  int = int.replace(/^0+(?=\d)/, '');
  if (int.length > 9) return { ok: false, error: 'amount_too_big' };
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  if (cents <= 0) return { ok: false, error: 'amount_zero' };
  if (cents > MAX_AMOUNT_CENTS) return { ok: false, error: 'amount_too_big' };
  return { ok: true, value: cents };
}

/** Zero-width, bidi-override and other invisible characters used to hide or reorder text. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜ᅟᅠ᠎​-‏‪-‮⁠-⁤⁦-⁯ㅤ︀-️﻿ﾠ￹-￻]/g;

export function stripInvisible(s: string): string {
  return s.normalize('NFC').replace(INVISIBLE, '');
}

/** Cleans a name, note, bill or goal: strips invisible characters, collapses spaces, checks length and letters. */
export function cleanText(input: string, opts: { max: number; required?: boolean; needLetter?: boolean }): Result<string, TextError> {
  const v = stripInvisible(String(input ?? '')).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!v) return opts.required ? { ok: false, error: 'text_empty' } : { ok: true, value: '' };
  if ([...v].length > opts.max) return { ok: false, error: 'text_too_long' };
  if ((opts.needLetter ?? true) && !/\p{L}/u.test(v)) return { ok: false, error: 'text_no_letters' };
  return { ok: true, value: v };
}

export const cleanName = (s: string, required = true) => cleanText(s, { max: NAME_MAX, required });
export const cleanNote = (s: string) => cleanText(s, { max: NOTE_MAX, required: false });

/** Entries may be from 1 Jan 2024 up to 7 days ahead. */
export function entryDateError(date: string, today: ISODate): 'date_invalid' | 'date_too_old' | 'date_too_far' | null {
  if (!isValidISODate(date)) return 'date_invalid';
  if (date < MIN_ENTRY_DATE) return 'date_too_old';
  if (date > addDays(today, MAX_FUTURE_DAYS)) return 'date_too_far';
  return null;
}

/** "Type it" input: 3–200 characters with at least one letter and something that looks like a word, not keyboard-mash. */
export function typedEntryError(input: string): 'typed_short' | 'typed_long' | 'typed_gibberish' | null {
  const v = stripInvisible(input).trim();
  if ([...v].length < 3) return 'typed_short';
  if ([...v].length > 200) return 'typed_long';
  if (!/\p{L}/u.test(v) || looksLikeMash(v)) return 'typed_gibberish';
  return null;
}

/** Scam Shield: 10–2,000 characters with real words (not only emoji or symbols). */
export function scamTextError(input: string): 'scam_short' | 'scam_long' | 'scam_no_words' | null {
  const v = stripInvisible(input).trim();
  if ([...v].length < 10) return 'scam_short';
  if ([...v].length > 2000) return 'scam_long';
  if ((v.match(/\p{L}/gu) ?? []).length < 4) return 'scam_no_words';
  return null;
}

/**
 * Keyboard-mash heuristic: every letter-run is long and vowel-less or vowel-poor ("asdkjhqwe", "qwrtpsdf").
 * Words in English and the four SA languages are vowel-rich, so real sentences pass.
 */
export function looksLikeMash(s: string): boolean {
  const words = s.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length === 0) return true;
  const bad = (w: string) => {
    const vowels = (w.match(/[aeiouáéíóúèêëïöü]/g) ?? []).length;
    if (w.length < 5) return w.length >= 3 && vowels === 0;
    return vowels / w.length < 0.25 || /[^aeiou\s]{5,}/.test(w.replace(/(ng|ny|hl|tl|sh|tsh|ch|th|ph|kh|gq|nq|nx|gc|nc|dl|tš|kg)/g, 'a'));
  };
  const known = /\b(r?\d|got|paid|spent|bought|from|for|on|in|out|piece|job|grant|sassa|taxi|food|rent|ndi|ngi|ke|ek|het)\b/;
  return words.every(bad) && !known.test(s.toLowerCase());
}

/** A numeric range check for onboarding/price-book style fields; returns the parsed cents or an error. */
export function inRange(input: string, minCents: number, maxCents: number): Result<number, AmountError | 'out_of_range'> {
  if (String(input).trim() === '0' || String(input).trim() === '0,00' || String(input).trim() === '0.00') {
    return minCents <= 0 ? { ok: true, value: 0 } : { ok: false, error: 'out_of_range' };
  }
  const r = parseRands(input);
  if (!r.ok) return r;
  if (r.value < minCents || r.value > maxCents) return { ok: false, error: 'out_of_range' };
  return r;
}
