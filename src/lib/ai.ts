// Calls to the Edge Functions. The browser never sees the Claude key; it only sends the user's JWT.
import { supabase } from './supabase';
import { parseEntryLocally, type ParsedEntry } from '../engine/parse';
import type { Category } from '../engine/types';
import { todaySA, isValidISODate } from './dates';
import type { ScamFlag } from '../engine/scam';
import { validateScan, type ScanResult } from './slipRules';

const ALLOWED: Category[] = ['income', 'grant', 'piece_job', 'salary', 'trade', 'gift', 'transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel', 'savings_goal', 'funeral', 'debt', 'health', 'household', 'other'];

export async function parseEntry(text: string, locale: string): Promise<{ entry: ParsedEntry; via: 'ai' | 'rules' } | null> {
  const today = todaySA();
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.functions.invoke('parse-entry', { body: { text: text.slice(0, 200), locale, today } });
      // The server read it and found no clear amount and direction: don't let the phone guess instead.
      const status = (error as { context?: { status?: number } } | null)?.context?.status;
      if (status === 422 || status === 400) return null;
      if (!error && data?.ok) {
        const e = data.entry;
        // Re-validate on the client too: model output is untrusted end to end.
        if ((e.direction === 'in' || e.direction === 'out') && Number.isInteger(e.amount_cents) && e.amount_cents > 0 && e.amount_cents <= 100_000_000 && ALLOWED.includes(e.category) && isValidISODate(e.occurred_on)) {
          return { entry: { direction: e.direction, amount_cents: e.amount_cents, category: e.category, occurred_on: e.occurred_on }, via: data.via === 'rules' ? 'rules' : 'ai' };
        }
      }
    } catch {
      /* fall through to the on-device parser */
    }
  }
  const local = parseEntryLocally(text, today);
  return local ? { entry: local, via: 'rules' } : null;
}

export async function explainScam(text: string, flags: ScamFlag[], level: string, locale: string): Promise<{ summary: string; next_step: string } | null> {
  if (!navigator.onLine) return null;
  try {
    const { data, error } = await supabase.functions.invoke('explain-scam', { body: { text: text.slice(0, 2000), flags, level, locale } });
    if (error || !data?.ok) return null;
    const s = String(data.summary ?? '').slice(0, 600);
    const n = String(data.next_step ?? '').slice(0, 400);
    return s ? { summary: s, next_step: n } : null;
  } catch {
    return null;
  }
}

export type ScanError = 'offline' | 'not_a_slip' | 'unclear' | 'too_big' | 'unsupported_type' | 'pdf_encrypted' | 'pdf_pages' | 'rate_limited' | 'unavailable';
export type ScanResponse = { ok: true; result: Extract<ScanResult, { ok: true }> } | { ok: false; error: ScanError };

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Sends one slip (already shrunk on the phone) to scan-receipt. The file is not kept anywhere. */
export async function scanSlip(blob: Blob, locale: string): Promise<ScanResponse> {
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  try {
    const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { file: await toBase64(blob), locale } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
      const e = String(body?.error ?? '');
      const known: ScanError[] = ['not_a_slip', 'unclear', 'too_big', 'unsupported_type', 'pdf_encrypted', 'pdf_pages', 'rate_limited'];
      return { ok: false, error: (known as string[]).includes(e) ? (e as ScanError) : 'unavailable' };
    }
    // Re-check on the phone too: the answer is untrusted end to end.
    const r = validateScan({ ...data, rows: (data?.rows ?? []).map((x: { amount_cents?: number }) => ({ ...x, amount_text: typeof x.amount_cents === 'number' ? (x.amount_cents / 100).toFixed(2) : '', date: (x as { occurred_on?: string }).occurred_on ?? '', items: undefined })), items: (data?.items ?? []).map((x: { name?: string; amount_cents?: number | null }) => ({ name: x.name, amount_text: typeof x.amount_cents === 'number' ? (x.amount_cents / 100).toFixed(2) : '' })) }, todaySA());
    return r.ok ? { ok: true, result: r } : { ok: false, error: r.reason };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
