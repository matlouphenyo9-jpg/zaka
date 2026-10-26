// B5: rules for "Snap or upload a slip". Shared by the phone and the scan-receipt Edge Function (copied by
// scripts/sync-functions-shared.mjs), so the server checks exactly what the app checks. Model output is untrusted:
// every field is re-parsed with the B4-C rules, and card, token, account and ID numbers are masked.
import { cleanText, parseRands } from './validate';
import { isValidISODate, type ISODate } from './dates';

export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_PDF_BYTES = 3_000_000;
export const MAX_PDF_PAGES = 3;
export const MAX_ROWS = 10;
export const MAX_ITEMS = 30;
export const MERCHANT_MAX = 40;
export const ITEM_MAX = 40;

export type SlipMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

/** The real file type from its first bytes (the name and the claimed type are ignored). */
export function sniffType(b: Uint8Array): SlipMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 5 && ascii(b, 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function ascii(b: Uint8Array, from: number, to: number): string {
  let s = '';
  for (let i = from; i < to; i++) s += String.fromCharCode(b[i]);
  return s;
}

/**
 * Encryption and page count of a PDF, read from its structure without rendering it. Pages that can't be counted
 * (all page objects hidden in compressed streams) give null, which the server treats as "can't check, refuse".
 */
export function pdfInfo(b: Uint8Array): { encrypted: boolean; pages: number | null } {
  const s = ascii(b, 0, b.length);
  const encrypted = /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(s);
  const pageObjs = (s.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  let counted = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) counted = Math.max(counted, Number(m[1] ?? m[2]));
  const pages = Math.max(pageObjs, counted);
  return { encrypted, pages: pages > 0 ? pages : null };
}

/**
 * Hides long numbers: card numbers, prepaid electricity tokens, account numbers, ID numbers, voucher PINs.
 * Any run of 6+ digits (spaces or dashes allowed between them) becomes "••••". Prices and dates stay readable.
 */
export function maskSensitive(s: string): string {
  return s.replace(/\d(?:[ \-]?\d){5,}/g, '••••');
}

export const SLIP_CATEGORIES = ['income', 'grant', 'piece_job', 'salary', 'trade', 'gift', 'transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel', 'savings_goal', 'funeral', 'debt', 'health', 'household', 'other'] as const;
export type SlipCategory = (typeof SLIP_CATEGORIES)[number];
const INCOME = new Set(['income', 'grant', 'piece_job', 'salary', 'trade', 'gift']);

export const SLIP_KINDS = ['till_slip', 'electricity', 'airtime_data', 'transport_ticket', 'payment', 'payslip', 'money_received', 'other_slip', 'not_a_slip'] as const;
export type SlipKind = (typeof SLIP_KINDS)[number];
/** Slips that are always money spent, whatever text is printed on them. */
const SPEND_KINDS = new Set<SlipKind>(['till_slip', 'electricity', 'airtime_data', 'transport_ticket']);

export interface SlipRow {
  direction: 'in' | 'out';
  amount_cents: number;
  occurred_on: ISODate | null;
  merchant: string | null;
  category: SlipCategory;
  units_kwh: number | null;
}
export interface SlipItem { name: string; amount_cents: number | null }
export type ScanResult =
  | { ok: true; kind: SlipKind; confidence: 'low' | 'medium' | 'high'; rows: SlipRow[]; items: SlipItem[] }
  | { ok: false; reason: 'not_a_slip' | 'unclear' };

type Raw = Record<string, unknown>;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanLabel(v: unknown, max: number): string | null {
  const r = cleanText(maskSensitive(str(v)), { max: max * 3, required: false });
  if (!r.ok || !r.value) return null;
  const chars = [...r.value];
  return chars.length > max ? chars.slice(0, max).join('').trim() : r.value;
}

/**
 * Turns the model's answer into rows the person checks before saving. Anything that fails a rule is dropped, never
 * guessed: no amount → no row; a bad or future date → null (the form shows today); shop slips are always money out.
 */
export function validateScan(raw: unknown, today: ISODate): ScanResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'unclear' };
  const r = raw as Raw;
  const kind = (SLIP_KINDS as readonly string[]).includes(str(r.kind)) ? (r.kind as SlipKind) : 'other_slip';
  if (kind === 'not_a_slip') return { ok: false, reason: 'not_a_slip' };
  if (r.readable === false) return { ok: false, reason: 'unclear' };
  const confidence = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low';
  const rows: SlipRow[] = [];
  for (const x of (Array.isArray(r.rows) ? r.rows : []).slice(0, MAX_ROWS) as Raw[]) {
    if (!x || typeof x !== 'object') continue;
    const amt = parseRands(str(x.amount_text, 30));
    if (!amt.ok) continue;
    const category: SlipCategory = (SLIP_CATEGORIES as readonly string[]).includes(str(x.category)) ? (x.category as SlipCategory) : 'other';
    let direction: 'in' | 'out' = x.direction === 'in' ? 'in' : 'out';
    if (SPEND_KINDS.has(kind)) direction = 'out';
    // An income category on money out (or the reverse) can't be saved as it is: fall back to a neutral category.
    const cat: SlipCategory = direction === 'out' && INCOME.has(category) ? 'other' : direction === 'in' && !INCOME.has(category) ? 'income' : category;
    const d = str(x.date, 10);
    const occurred_on = isValidISODate(d) && d >= '2024-01-01' && d <= today ? (d as ISODate) : null;
    const u = typeof x.units_kwh === 'number' && Number.isFinite(x.units_kwh) && x.units_kwh > 0 && x.units_kwh < 100_000 ? Math.round(x.units_kwh * 10) / 10 : null;
    rows.push({ direction, amount_cents: amt.value, occurred_on, merchant: cleanLabel(x.merchant, MERCHANT_MAX), category: cat, units_kwh: cat === 'electricity' ? u : null });
  }
  if (rows.length === 0) return { ok: false, reason: 'unclear' };
  const items: SlipItem[] = [];
  for (const x of (Array.isArray(r.items) ? r.items : []).slice(0, MAX_ITEMS) as Raw[]) {
    const name = x && typeof x === 'object' ? cleanLabel(x.name, ITEM_MAX) : null;
    if (!name) continue;
    const a = parseRands(str(x.amount_text, 30));
    items.push({ name, amount_cents: a.ok ? a.value : null });
  }
  return { ok: true, kind, confidence, rows, items };
}

/** The note saved with a slip entry: the shop or payer, plus units for electricity. Never a token or card number. */
export function slipNote(row: Pick<SlipRow, 'merchant' | 'units_kwh'>, unitsLabel = 'kWh'): string {
  const parts = [row.merchant, row.units_kwh ? `${row.units_kwh} ${unitsLabel}` : null].filter(Boolean);
  return maskSensitive(parts.join(' · ')).slice(0, 140);
}
