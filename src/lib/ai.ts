// Calls to the Edge Functions. The browser never sees the Claude key; it only sends the user's JWT.
import { supabase } from './supabase';
import { parseEntryLocally, type ParsedEntry } from '../engine/parse';
import type { Category } from '../engine/types';
import { todaySA, isValidISODate } from './dates';
import type { ScamFlag } from '../engine/scam';

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
