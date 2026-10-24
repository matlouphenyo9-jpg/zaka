import { createClient } from '@supabase/supabase-js';

// Public, browser-safe values. Every table is protected by owner-only RLS, so the publishable key grants nothing on its own.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://dalhthsxuyttsgyigwgd.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'zaka.auth' },
});

export const DEMO_EMAIL = 'demo@zaka.app';
export const DEMO_PASSWORD = 'Zaka2026!demo';
