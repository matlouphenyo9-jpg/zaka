// App data store: Supabase is the source of truth; IndexedDB keeps a per-user cache and an offline write queue,
// so the forecast recomputes and entries can be added with no connection.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { del, get, set } from 'idb-keyval';
import { supabase } from './supabase';
import type { Essentials, Goal, IncomePlanItem, Obligation, Txn } from '../engine/types';
import { setLocale, type LocaleCode } from '../i18n';

export interface Profile {
  user_id: string;
  display_name: string | null;
  locale: LocaleCode;
  city: string | null;
  transport_mode: string | null;
  reserve_amount: number;
  income_plan: IncomePlanItem[];
  essentials: Essentials;
  ignored_patterns: string[];
  is_demo: boolean;
  consent_at: string | null;
  onboarded_at: string | null;
}

export interface PriceItem {
  id: string;
  item: string;
  mode: string | null;
  city: string | null;
  unit: string;
  price_cents: number | null;
  low_cents: number | null;
  high_cents: number | null;
  as_of: string;
  source_url: string | null;
  confidence: string;
  note: string | null;
}

export interface AppData {
  profile: Profile | null;
  txns: Txn[];
  obligations: Obligation[];
  goals: Goal[];
}

type Table = 'transactions' | 'obligations' | 'goals' | 'profiles';
interface QueuedOp {
  qid: string;
  table: Table;
  kind: 'upsert' | 'delete';
  row?: Record<string, unknown>;
  id?: string;
}

const EMPTY: AppData = { profile: null, txns: [], obligations: [], goals: [] };
const cacheKey = (uid: string) => `zaka:data:${uid}`;
const queueKey = (uid: string) => `zaka:queue:${uid}`;
const PRICE_KEY = 'zaka:price_book';
export const DEMO_RESEED_KEY = 'zaka.demo.reseed';
/** Set when the shared demo account's language is changed on this device only. */
export const LOCALE_OVERRIDE_KEY = 'zaka.locale.override';

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const TXN_COLS = 'id,direction,amount_cents,category,source,note,occurred_on,created_via,confirmed';
const OB_COLS = 'id,name,amount_cents,due_kind,due_date,due_day,due_weekday,category,active';
const GOAL_COLS = 'id,name,target_cents,due_on,kind';
const PROFILE_COLS = 'user_id,display_name,locale,city,transport_mode,reserve_amount,income_plan,essentials,ignored_patterns,is_demo,consent_at,onboarded_at';

interface Ctx {
  session: Session | null;
  authReady: boolean;
  data: AppData;
  dataReady: boolean;
  online: boolean;
  pending: number;
  priceBook: PriceItem[];
  lastSynced: string | null;
  addTxn: (t: Omit<Txn, 'id'> & { id?: string }) => Promise<{ queued: boolean; txn: Txn }>;
  deleteTxn: (id: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  changeLocale: (code: LocaleCode) => Promise<void>;
  saveObligation: (o: Omit<Obligation, 'id'> & { id?: string }) => Promise<void>;
  deleteObligation: (id: string) => Promise<void>;
  saveGoal: (g: Omit<Goal, 'id'> & { id?: string }) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  resetDemo: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY);
  const [dataReady, setDataReady] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [priceBook, setPriceBook] = useState<PriceItem[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const uid = session?.user.id ?? null;
  const dataRef = useRef(data);
  dataRef.current = data;
  const flushing = useRef(false);

  // ---------------------------------------------------------------- auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ---------------------------------------------------------------- local cache + queue
  const writeLocal = useCallback(async (next: AppData) => {
    setData(next);
    if (uid) await set(cacheKey(uid), next).catch(() => undefined);
  }, [uid]);

  const readQueue = useCallback(async (): Promise<QueuedOp[]> => (uid ? ((await get(queueKey(uid)).catch(() => null)) as QueuedOp[] | null) ?? [] : []), [uid]);
  const writeQueue = useCallback(async (q: QueuedOp[]) => {
    if (!uid) return;
    await set(queueKey(uid), q).catch(() => undefined);
    setPending(q.filter((o) => o.table === 'transactions').length);
  }, [uid]);

  const runOp = async (op: QueuedOp) => {
    if (op.kind === 'upsert') {
      const conflict = op.table === 'profiles' ? 'user_id' : 'id';
      const { error } = await supabase.from(op.table).upsert(op.row!, { onConflict: conflict });
      if (error) throw error;
    } else {
      const { error } = await supabase.from(op.table).delete().eq('id', op.id!);
      if (error) throw error;
    }
  };

  const flush = useCallback(async () => {
    if (!uid || flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      let q = await readQueue();
      while (q.length) {
        try {
          await runOp(q[0]);
        } catch (e) {
          const err = e as { code?: string; message?: string };
          // A row the server rejects (validation/RLS) would block the queue forever; drop it, keep network errors.
          if (err.code && /^(22|23|42)/.test(err.code)) console.warn('Dropped invalid queued write', err.code);
          else break;
        }
        q = q.slice(1);
        await writeQueue(q);
      }
    } finally {
      flushing.current = false;
    }
  }, [uid, readQueue, writeQueue]);

  const enqueue = useCallback(async (op: Omit<QueuedOp, 'qid'>) => {
    const q = await readQueue();
    await writeQueue([...q, { ...op, qid: uuid() }]);
    void flush();
  }, [readQueue, writeQueue, flush]);

  // ---------------------------------------------------------------- server fetch
  const refresh = useCallback(async () => {
    if (!uid) return;
    await flush();
    if ((await readQueue()).length) return; // don't overwrite unsynced local writes with server state
    const [p, t, o, g] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLS).eq('user_id', uid).maybeSingle(),
      supabase.from('transactions').select(TXN_COLS).order('occurred_on', { ascending: true }).order('created_at', { ascending: true }).limit(5000),
      supabase.from('obligations').select(OB_COLS),
      supabase.from('goals').select(GOAL_COLS),
    ]);
    if (p.error || t.error || o.error || g.error) throw p.error ?? t.error ?? o.error ?? g.error;
    let profile = p.data as Profile | null;
    if (!profile) {
      const { data: created, error } = await supabase.from('profiles').upsert({ user_id: uid, locale: (localStorage.getItem('zaka.locale') as LocaleCode) || 'en' }, { onConflict: 'user_id' }).select(PROFILE_COLS).single();
      if (error) throw error;
      profile = created as Profile;
    }
    await writeLocal({ profile, txns: (t.data ?? []) as Txn[], obligations: (o.data ?? []) as Obligation[], goals: (g.data ?? []) as Goal[] });
    setLastSynced(new Date().toISOString());
  }, [uid, flush, readQueue, writeLocal]);

  useEffect(() => {
    let cancelled = false;
    setDataReady(false);
    if (!uid) {
      setData(EMPTY);
      setPending(0);
      return;
    }
    (async () => {
      const cached = (await get(cacheKey(uid)).catch(() => null)) as AppData | null;
      if (cached && !cancelled) {
        setData(cached);
        setDataReady(true);
      }
      setPending((await readQueue()).filter((o) => o.table === 'transactions').length);
      try {
        // "Try the demo" always starts from Lerato's fresh history ending today, whatever the judging date.
        if (sessionStorage.getItem(DEMO_RESEED_KEY) === '1') {
          sessionStorage.removeItem(DEMO_RESEED_KEY);
          await Promise.all([del(cacheKey(uid)), del(queueKey(uid))]).catch(() => undefined);
          const { error } = await supabase.rpc('seed_demo', { p_user: uid });
          if (error) console.warn('Demo reset failed', error.code);
        }
        await refresh();
      } catch (e) {
        console.warn('Offline or fetch failed; using cached data', (e as Error).message);
      }
      if (!cancelled) setDataReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, refresh, readQueue]);

  useEffect(() => {
    if (online && uid) void flush().then(() => refresh().catch(() => undefined));
  }, [online, uid, flush, refresh]);

  useEffect(() => {
    (async () => {
      const cached = (await get(PRICE_KEY).catch(() => null)) as PriceItem[] | null;
      if (cached) setPriceBook(cached);
      const { data, error } = await supabase.from('price_book').select('*').order('id');
      if (!error && data) {
        setPriceBook(data as PriceItem[]);
        void set(PRICE_KEY, data).catch(() => undefined);
      }
    })();
  }, []);

  // ---------------------------------------------------------------- actions (optimistic + queued)
  const addTxn: Ctx['addTxn'] = useCallback(async (t) => {
    const txn: Txn = { ...t, id: t.id ?? uuid() } as Txn;
    await writeLocal({ ...dataRef.current, txns: [...dataRef.current.txns, txn] });
    const queued = !navigator.onLine;
    await enqueue({ table: 'transactions', kind: 'upsert', row: { ...txn } });
    return { queued, txn };
  }, [writeLocal, enqueue]);

  const deleteTxn = useCallback(async (id: string) => {
    await writeLocal({ ...dataRef.current, txns: dataRef.current.txns.filter((x) => x.id !== id) });
    await enqueue({ table: 'transactions', kind: 'delete', id });
  }, [writeLocal, enqueue]);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const cur = dataRef.current.profile;
    if (!uid) return;
    const next = { ...(cur ?? ({ user_id: uid } as Profile)), ...patch, user_id: uid };
    await writeLocal({ ...dataRef.current, profile: next });
    const { is_demo: _ignored, ...row } = next; // never sent: server-controlled
    void _ignored;
    await enqueue({ table: 'profiles', kind: 'upsert', row });
  }, [uid, writeLocal, enqueue]);

  const changeLocale = useCallback(async (code: LocaleCode) => {
    setLocale(code);
    // The judge account is shared: keep its language change on this device so the next judge still gets isiXhosa.
    if (dataRef.current.profile?.is_demo) sessionStorage.setItem(LOCALE_OVERRIDE_KEY, '1');
    else await saveProfile({ locale: code });
  }, [saveProfile]);

  const saveObligation = useCallback(async (o: Omit<Obligation, 'id'> & { id?: string }) => {
    const row = { ...o, id: o.id ?? uuid() } as Obligation;
    const rest = dataRef.current.obligations.filter((x) => x.id !== row.id);
    await writeLocal({ ...dataRef.current, obligations: [...rest, row] });
    await enqueue({ table: 'obligations', kind: 'upsert', row: { ...row } });
  }, [writeLocal, enqueue]);

  const deleteObligation = useCallback(async (id: string) => {
    await writeLocal({ ...dataRef.current, obligations: dataRef.current.obligations.filter((x) => x.id !== id) });
    await enqueue({ table: 'obligations', kind: 'delete', id });
  }, [writeLocal, enqueue]);

  const saveGoal = useCallback(async (g: Omit<Goal, 'id'> & { id?: string }) => {
    const row = { ...g, id: g.id ?? uuid() } as Goal;
    const rest = dataRef.current.goals.filter((x) => x.id !== row.id);
    await writeLocal({ ...dataRef.current, goals: [...rest, row] });
    await enqueue({ table: 'goals', kind: 'upsert', row: { ...row } });
  }, [writeLocal, enqueue]);

  const deleteGoal = useCallback(async (id: string) => {
    await writeLocal({ ...dataRef.current, goals: dataRef.current.goals.filter((x) => x.id !== id) });
    await enqueue({ table: 'goals', kind: 'delete', id });
  }, [writeLocal, enqueue]);

  const clearLocal = useCallback(async () => {
    if (!uid) return;
    await Promise.all([del(cacheKey(uid)), del(queueKey(uid))]).catch(() => undefined);
  }, [uid]);

  const resetDemo = useCallback(async () => {
    if (!uid) return;
    await clearLocal();
    const { error } = await supabase.rpc('seed_demo', { p_user: uid });
    if (error) throw error;
    await refresh();
  }, [uid, clearLocal, refresh]);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_data');
    if (error) throw error;
    await clearLocal();
    await supabase.auth.signOut();
  }, [clearLocal]);

  const signOut = useCallback(async () => {
    // Clear this phone's copy so the next person on a shared phone sees nothing.
    await clearLocal();
    await supabase.auth.signOut();
  }, [clearLocal]);

  const value = useMemo<Ctx>(() => ({
    session, authReady, data, dataReady, online, pending, priceBook, lastSynced,
    addTxn, deleteTxn, saveProfile, changeLocale, saveObligation, deleteObligation, saveGoal, deleteGoal, refresh, resetDemo, deleteAccount, signOut,
  }), [session, authReady, data, dataReady, online, pending, priceBook, lastSynced, addTxn, deleteTxn, saveProfile, changeLocale, saveObligation, deleteObligation, saveGoal, deleteGoal, refresh, resetDemo, deleteAccount, signOut]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
