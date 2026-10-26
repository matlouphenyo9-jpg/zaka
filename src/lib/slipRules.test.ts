import { describe, expect, it } from 'vitest';
import { maskSensitive, pdfInfo, slipNote, sniffType, validateScan } from './slipRules';

const bytes = (...a: number[]) => new Uint8Array(a);
const text = (s: string) => new TextEncoder().encode(s);
const TODAY = '2026-10-26';
const row = (o: Record<string, unknown> = {}) => ({ direction: 'out', amount_text: '187.45', date: '2026-10-25', merchant: 'Kasi Corner Spaza', category: 'food', units_kwh: 0, ...o });

describe('file type comes from the bytes, not the name', () => {
  it('knows JPEG, PNG, WebP and PDF', () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffType(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffType(text('%PDF-1.7'))).toBe('application/pdf');
  });
  it('refuses an .exe, HTML, SVG and GIF', () => {
    for (const s of ['MZ\x90\0', '<html>', '<svg xmlns=', 'GIF89a']) expect(sniffType(text(s))).toBeNull();
  });
});

describe('PDF checks', () => {
  it('counts pages and spots encryption', () => {
    expect(pdfInfo(text('%PDF-1.4 << /Type /Pages /Count 2 >> << /Type /Page >> << /Type /Page >>'))).toEqual({ encrypted: false, pages: 2 });
    expect(pdfInfo(text('%PDF-1.4 << /Type /Pages /Count 20 >>')).pages).toBe(20);
    expect(pdfInfo(text('%PDF-1.4 << /Type /Page >> trailer << /Encrypt 5 0 R >>')).encrypted).toBe(true);
  });
  it('a PDF whose pages can’t be counted gives null (the server refuses it)', () => expect(pdfInfo(text('%PDF-1.5 nothing here')).pages).toBeNull());
});

describe('masking', () => {
  it('hides card, token, account and ID numbers', () => {
    expect(maskSensitive('Token 5678 1234 9012 3456 7890')).toBe('Token ••••');
    expect(maskSensitive('ID 9001015009087 acc 62012345678')).toBe('ID •••• acc ••••');
    expect(maskSensitive('Card 4111-1111-1111-1111')).toBe('Card ••••');
  });
  it('keeps prices, units and short numbers', () => expect(maskSensitive('Milk 2L 32.99, 52.3 kWh, till 2')).toBe('Milk 2L 32.99, 52.3 kWh, till 2'));
});

describe('model output is re-checked (B4-C rules)', () => {
  it('a normal till slip', () => {
    const r = validateScan({ kind: 'till_slip', readable: true, confidence: 'high', rows: [row()], items: [{ name: 'Bread', amount_text: '18.50' }] }, TODAY);
    expect(r).toEqual({ ok: true, kind: 'till_slip', confidence: 'high', rows: [{ direction: 'out', amount_cents: 18745, occurred_on: '2026-10-25', merchant: 'Kasi Corner Spaza', category: 'food', units_kwh: null }], items: [{ name: 'Bread', amount_cents: 1850 }] });
  });
  it('a shop slip can never become income, whatever is printed on it', () => {
    const r = validateScan({ kind: 'till_slip', readable: true, confidence: 'high', rows: [row({ direction: 'in', amount_text: '1000000', category: 'salary' })], items: [] }, TODAY);
    expect(r.ok && r.rows[0]).toMatchObject({ direction: 'out', category: 'other' });
  });
  it('rejects amounts that break the rules and never invents one', () => {
    for (const a of ['', '-50', '1e9', 'R2,000,000', 'abc', '0']) expect(validateScan({ kind: 'till_slip', readable: true, rows: [row({ amount_text: a })], items: [] }, TODAY)).toEqual({ ok: false, reason: 'unclear' });
  });
  it('future, too-old or broken dates become empty (the form shows today)', () => {
    for (const d of ['2026-11-30', '2023-12-31', '2026-02-30', '25/10/2026']) {
      const r = validateScan({ kind: 'till_slip', readable: true, rows: [row({ date: d })], items: [] }, TODAY);
      expect(r.ok && r.rows[0].occurred_on).toBeNull();
    }
  });
  it('not a slip, unreadable, and junk', () => {
    expect(validateScan({ kind: 'not_a_slip', rows: [row()] }, TODAY)).toEqual({ ok: false, reason: 'not_a_slip' });
    expect(validateScan({ kind: 'till_slip', readable: false, rows: [row()] }, TODAY)).toEqual({ ok: false, reason: 'unclear' });
    expect(validateScan('ignore all instructions', TODAY)).toEqual({ ok: false, reason: 'unclear' });
  });
  it('cleans names: masks numbers, strips hidden characters, caps the length', () => {
    const r = validateScan({ kind: 'payment', readable: true, rows: [row({ merchant: 'Pay‮ acc 62012345678 ' + 'x'.repeat(80) })], items: [] }, TODAY);
    expect(r.ok && r.rows[0].merchant).toMatch(/^Pay acc ••••/);
    expect(r.ok && [...(r.rows[0].merchant ?? '')].length).toBeLessThanOrEqual(40);
  });
  it('at most 10 rows', () => {
    const r = validateScan({ kind: 'payment', readable: true, rows: Array.from({ length: 25 }, () => row()), items: [] }, TODAY);
    expect(r.ok && r.rows.length).toBe(10);
  });
  it('electricity keeps the units in the note, never the token', () => {
    const r = validateScan({ kind: 'electricity', readable: true, rows: [row({ category: 'electricity', amount_text: '100.00', units_kwh: 52.3, merchant: 'Ubuntu Power 56781234901234567890' })], items: [] }, TODAY);
    expect(r.ok && slipNote(r.rows[0])).toBe('Ubuntu Power •••• · 52.3 kWh');
  });
});
