// RLS + API abuse tests against the live Supabase project (owner / other user / anonymous).
// Usage: node tests/rls.mjs   (uses the two QA accounts and the public publishable key; no secrets needed)
import { createClient } from '@supabase/supabase-js';

const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
const KEY = 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';
const PW = process.env.QA_PASSWORD ?? 'QaTest!2026x';
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const owner = mk(), other = mk(), anon = mk();
const a = await owner.auth.signInWithPassword({ email: 'qa-owner@zaka-qa.test', password: PW });
const b = await other.auth.signInWithPassword({ email: 'qa-other@zaka-qa.test', password: PW });
if (a.error || b.error) throw new Error('QA sign-in failed');
const ownerId = a.data.user.id, otherId = b.data.user.id;

// owner writes a row
const id = crypto.randomUUID();
const ins = await owner.from('transactions').insert({ id, direction: 'in', amount_cents: 12345, category: 'piece_job', source: 'piece_job', occurred_on: '2026-10-24' });
ok('owner can insert own transaction', !ins.error, ins.error?.message);
const own = await owner.from('transactions').select('id').eq('id', id);
ok('owner can read own transaction', own.data?.length === 1);

// other user
const r1 = await other.from('transactions').select('id,user_id').eq('id', id);
ok('other user cannot read it', r1.data?.length === 0);
const r1b = await other.from('transactions').select('user_id');
ok('other user sees only own rows', (r1b.data ?? []).every((r) => r.user_id === otherId));
const u1 = await other.from('transactions').update({ amount_cents: 1 }).eq('id', id).select();
ok('other user cannot update it', (u1.data ?? []).length === 0);
const d1 = await other.from('transactions').delete().eq('id', id).select();
ok('other user cannot delete it', (d1.data ?? []).length === 0);
const i1 = await other.from('transactions').insert({ user_id: ownerId, direction: 'out', amount_cents: 100, category: 'food', source: 'cash', occurred_on: '2026-10-24' });
ok('other user cannot insert rows as the owner', !!i1.error, i1.error?.code);
const steal = await other.from('transactions').update({ user_id: otherId }).eq('id', id).select();
ok('other user cannot take over the row', (steal.data ?? []).length === 0);
const p1 = await other.from('profiles').select('*').eq('user_id', ownerId);
ok('other user cannot read owner profile', p1.data?.length === 0);
const p2 = await other.from('profiles').update({ display_name: 'hacked' }).eq('user_id', ownerId).select();
ok('other user cannot edit owner profile', (p2.data ?? []).length === 0);
for (const t of ['obligations', 'goals', 'scam_checks']) {
  const r = await other.from(t).select('user_id');
  ok(`other user sees only own ${t}`, (r.data ?? []).every((x) => x.user_id === otherId), r.error?.message);
}
const seedOther = await other.rpc('seed_demo', { p_user: ownerId });
ok('other user cannot run seed_demo on the owner (would wipe their data)', !!seedOther.error, seedOther.error?.code);
const usage = await other.from('ai_usage').select('*');
ok('ai_usage is not readable through the API', !!usage.error || (usage.data ?? []).length === 0, usage.error?.code);
const pb = await other.from('price_book').insert({ id: 'evil', item: 'x', unit: 'x', as_of: '2026-01-01', confidence: 'low' });
ok('price_book cannot be written by users', !!pb.error, pb.error?.code);
const flag = await owner.from('profiles').update({ is_demo: true }).eq('user_id', ownerId).select('is_demo');
ok('users cannot mark themselves as the demo account', flag.data?.[0]?.is_demo === false, JSON.stringify(flag.data));

// validation
const bad = await owner.from('transactions').insert({ direction: 'in', amount_cents: -5, category: 'food', source: 'cash', occurred_on: '2026-10-24' });
ok('negative amounts are rejected', !!bad.error, bad.error?.code);
const bad2 = await owner.from('transactions').insert({ direction: 'in', amount_cents: 5, category: 'bitcoin', source: 'cash', occurred_on: '2026-10-24' });
ok('unknown categories are rejected', !!bad2.error, bad2.error?.code);
const bad3 = await owner.from('transactions').insert({ direction: 'in', amount_cents: 5, category: 'food', source: 'cash', occurred_on: '2026-10-24', note: 'x'.repeat(500) });
ok('oversized notes are rejected', !!bad3.error, bad3.error?.code);

// anonymous
for (const t of ['transactions', 'profiles', 'obligations', 'goals', 'scam_checks', 'ai_usage']) {
  const r = await anon.from(t).select('*').limit(1);
  ok(`anonymous cannot read ${t}`, !!r.error || (r.data ?? []).length === 0, r.error?.code);
}
const ai = await anon.from('transactions').insert({ user_id: ownerId, direction: 'in', amount_cents: 1, category: 'food', source: 'cash', occurred_on: '2026-10-24' });
ok('anonymous cannot insert', !!ai.error, ai.error?.code);
const pbr = await anon.from('price_book').select('id').limit(1);
ok('anonymous can read the public price book', (pbr.data ?? []).length === 1);
const as = await anon.rpc('seed_demo', { p_user: ownerId });
ok('anonymous cannot run seed_demo', !!as.error, as.error?.code);
const ad = await anon.rpc('delete_my_data');
ok('anonymous cannot run delete_my_data', !!ad.error, ad.error?.code);

// demo account protection
const demo = mk();
await demo.auth.signInWithPassword({ email: 'demo@zaka.app', password: 'Zaka2026!demo' });
const dd = await demo.rpc('delete_my_data');
ok('the shared demo account cannot be deleted', !!dd.error, dd.error?.message);

// clean up
await owner.from('transactions').delete().eq('id', id);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
