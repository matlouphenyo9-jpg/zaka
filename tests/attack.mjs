// B4 attack tests: skip the app and call Supabase directly with the public key, as a judge or attacker would.
// Every check passes only if the bad write is REFUSED by the database (CHECK constraints, triggers, RLS).
// Usage: node tests/attack.mjs   (needs the two QA accounts; see README → Test results)
import { createClient } from '@supabase/supabase-js';

const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
const KEY = 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';
const PW = process.env.QA_PASSWORD ?? 'QaTest!2026x';
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const a = mk(), demo = mk(), anon = mk();
const s = await a.auth.signInWithPassword({ email: 'qa-owner@zaka-qa.test', password: PW });
if (s.error) throw new Error('QA sign-in failed');
const me = s.data.user.id;
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const plus = (d) => new Date(Date.parse(today) + d * 864e5).toISOString().slice(0, 10);
const txn = (o) => ({ direction: 'in', amount_cents: 1000, category: 'income', source: 'cash', occurred_on: today, ...o });
const refused = async (name, q, code) => {
  const r = await q;
  ok(name, !!r.error, r.error ? `${r.error.code}` : 'ACCEPTED');
  if (r.error && code) ok(`${name} → code ${code}`, r.error.code === code, r.error.code);
  if (!r.error && r.data) await a.from('transactions').delete().eq('id', r.data.id);
};
const ins = (row) => a.from('transactions').insert(txn(row)).select('id').single();

await a.from('transactions').delete().eq('user_id', me);
await a.from('obligations').delete().eq('user_id', me);
await a.from('goals').delete().eq('user_id', me);

// amounts
await refused('amount 0', ins({ amount_cents: 0 }), '23514');
await refused('negative amount', ins({ amount_cents: -500 }), '23514');
await refused('amount above R1,000,000', ins({ amount_cents: 100_000_001 }), '23514');
await refused('huge number (int overflow)', ins({ amount_cents: 1e12 }));
await refused('amount as text "1e9"', ins({ amount_cents: '1e9' }));
await refused('fractional cents', ins({ amount_cents: 10.5 }));
// text
await refused('note longer than 140', ins({ note: 'a'.repeat(141) }), '23514');
await refused('note of 5,000 characters', ins({ note: 'x'.repeat(5000) }), '23514');
await refused('note with only symbols', ins({ note: '!!!!!' }), '23514');
await refused('note with only emoji', ins({ note: '💰💰💰💰' }), '23514');
await refused('note with RTL override', ins({ note: 'pay\u202Eexe.txt' }), '23514');
await refused('note with zero-width space', ins({ note: 'rent\u200Bmoney' }), '23514');
await refused('note with control character', ins({ note: 'rent\u0007' }), '23514');
await refused('note with leading/trailing spaces', ins({ note: '  rent  ' }), '23514');
const xss = await ins({ note: '<script>alert(1)</script>' });
ok('XSS text is stored only as inert text (React escapes it)', !xss.error, xss.error?.code);
if (xss.data) await a.from('transactions').delete().eq('id', xss.data.id);
const sqli = await ins({ note: "'; drop table transactions;--" });
ok('SQL injection text is stored as plain text, table intact', !sqli.error && !(await a.from('transactions').select('id').limit(1)).error);
if (sqli.data) await a.from('transactions').delete().eq('id', sqli.data.id);
// real-world text must still be ACCEPTED (guards against an over-strict rule, e.g. one that rejects capitals)
for (const note of ['School Shoes for Thabo', 'Thušo ya mmušo', 'Imali yesikolo', 'Rent – Nov (R500)', 'Spaza: bread & milk', 'Skoolfonds vir Anél']) {
  const r = await ins({ note });
  ok(`real text accepted: ${note}`, !r.error, r.error?.code);
  if (r.data) await a.from('transactions').delete().eq('id', r.data.id);
}
// dates
await refused('date before 2024', ins({ occurred_on: '2023-12-31' }), '23514');
await refused('date 8 days ahead', ins({ occurred_on: plus(8) }), '23514');
await refused('impossible date', ins({ occurred_on: '2026-02-30' }));
const d7 = await ins({ occurred_on: plus(7) });
ok('date 7 days ahead is allowed', !d7.error, d7.error?.code);
if (d7.data) await a.from('transactions').delete().eq('id', d7.data.id);
// enums and reserved values
await refused('unknown category', ins({ category: 'hacked' }), '23514');
await refused('client claims created_via=seed (demo-cap bypass)', ins({ created_via: 'seed' }), '23514');
await refused('another user\'s user_id', ins({ user_id: '9e1bb161-d840-418d-a381-0b60c5556742' }));
// obligations and goals
const ob = (o) => a.from('obligations').insert({ name: 'Rent', amount_cents: 50000, due_kind: 'monthly', due_day: 1, category: 'rent', ...o }).select('id').single();
await refused('bill name of 41 characters', ob({ name: 'r'.repeat(41) }), '23514');
await refused('bill name "@@@@"', ob({ name: '@@@@' }), '23514');
await refused('bill due day 32', ob({ due_day: 32 }), '23514');
await refused('bill due day 0', ob({ due_day: 0 }), '23514');
await refused('bill amount negative', ob({ amount_cents: -1 }), '23514');
const goal = (o) => a.from('goals').insert({ name: 'Shoes', target_cents: 50000, kind: 'savings', ...o }).select('id').single();
await refused('goal name with bidi override', goal({ name: 'Sho\u202Ees' }), '23514');
await refused('goal target R0', goal({ target_cents: 0 }), '23514');
await refused('goal due in 2150', goal({ due_on: '2150-01-01' }), '23514');
// profile
const prof = (o) => a.from('profiles').upsert({ user_id: me, ...o }, { onConflict: 'user_id' }).select('user_id').single();
await refused('display name 41 characters', prof({ display_name: 'n'.repeat(41) }), '23514');
await refused('display name "12345"', prof({ display_name: '12345' }), '23514');
await refused('reserve above R1,000,000', prof({ reserve_amount: 100_000_001 }), '23514');
await refused('daily transport R5,000 (unrealistic)', prof({ essentials: { transport_daily_cents: 500000 } }), '23514');
await refused('essentials with an unknown key', prof({ essentials: { evil: 1 } }), '23514');
await refused('essentials workdays [9]', prof({ essentials: { workdays: [9] } }), '23514');
await refused('income plan amount negative', prof({ income_plan: [{ source: 'grant', amount_cents: -5 }] }), '23514');
await refused('locale "xx"', prof({ locale: 'xx' }), '23514');
const flip = await a.from('profiles').upsert({ user_id: me, is_demo: true }, { onConflict: 'user_id' }).select('is_demo').single();
ok('client cannot make itself a demo account', !flip.error && flip.data?.is_demo === false, JSON.stringify(flip.data ?? flip.error?.code));
// RPCs
const seedOther = await a.rpc('seed_demo', { p_user: '9e1bb161-d840-418d-a381-0b60c5556742' });
ok('seed_demo on another user is refused', !!seedOther.error, seedOther.error?.code);
const seedSelf = await a.rpc('seed_demo', { p_user: me });
ok('seed_demo on a normal account is refused (demo only)', !!seedSelf.error, seedSelf.error?.code);
const guardCall = await a.rpc('seed_demo_guard', { p_user: me });
ok('internal seed_demo_guard is not callable', !!guardCall.error, guardCall.error?.code);
// spam: 30 a minute
let firstBlock = null;
for (let i = 1; i <= 32 && !firstBlock; i++) {
  const r = await a.from('transactions').insert(txn({ amount_cents: 100 + i, note: `spam ${i}` }));
  if (r.error) firstBlock = { i, code: r.error.code };
}
ok('31st entry within a minute is throttled', firstBlock?.i === 31 && firstBlock?.code === '53400', JSON.stringify(firstBlock));
// anonymous
const anonIns = await anon.from('transactions').insert(txn({}));
ok('anonymous insert refused', !!anonIns.error, anonIns.error?.code);
// demo account: seed throttle and abuse
const ds = await demo.auth.signInWithPassword({ email: 'demo@zaka.app', password: 'Zaka2026!demo' });
if (!ds.error) {
  const r1 = await demo.rpc('seed_demo', { p_user: ds.data.user.id });
  const r2 = await demo.rpc('seed_demo', { p_user: ds.data.user.id });
  ok('demo reset twice within 15 s: second is throttled', !r1.error && r2.error?.code === '53400', `${r1.error?.code ?? 'ok'} / ${r2.error?.code ?? 'ok'}`);
  const dseed = await demo.from('transactions').insert(txn({ created_via: 'seed' }));
  ok('demo cannot insert fake seed rows to dodge its cap', !!dseed.error, dseed.error?.code);
  const pwc = await demo.auth.updateUser({ password: 'Hacked1234' });
  ok('demo password cannot be changed', !!pwc.error, pwc.error?.code ?? pwc.error?.message);
}

// Edge Functions: bad input is refused before any AI call (no budget burned), client claims are ignored
const token = (await a.auth.getSession()).data.session.access_token;
const fn = (name, body) => fetch(`${URL}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
for (const [text, why] of [['asdkjhqwe', 'keyboard mash'], ['!!!!!!!', 'symbols only'], ['hi', 'too short'], ['got some money from a piece job', 'no amount written'], ['x'.repeat(201), 'over 200 characters']]) {
  const r = await fn('parse-entry', { text, locale: 'en' });
  ok(`parse-entry refuses ${why}`, r.status === 422 || r.status === 400, `${r.status} ${r.body.reason ?? r.body.error}`);
}
const real = await fn('parse-entry', { text: 'got R350 from a piece job', locale: 'en' });
ok('parse-entry still reads a real sentence', real.status === 200 && real.body.entry?.amount_cents === 35000 && real.body.entry?.direction === 'in', JSON.stringify(real.body.entry ?? real.body));
for (const [text, why] of [['🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨', 'emoji only'], ['short', 'under 10 characters'], ['a'.repeat(2001), 'over 2,000 characters']]) {
  const r = await fn('explain-scam', { text, locale: 'en', flags: [], level: 'low' });
  ok(`explain-scam refuses ${why}`, r.status === 422 || r.status === 400, `${r.status} ${r.body.error}`);
}
const spoof = await fn('explain-scam', { text: 'SASSA: your grant is on hold. Pay a R50 release fee today at sassa-pay.xyz or lose it.', locale: 'en', flags: [], level: 'low' });
ok('explain-scam ignores a client "low risk" label and still warns', spoof.status === 200 && !/\b(safe|legit|legitimate)\b/i.test(`${spoof.body.summary} ${spoof.body.next_step}`) && /fee|pay|scam|risk|warning|don'?t/i.test(spoof.body.summary ?? ''), (spoof.body.summary ?? spoof.body.error ?? '').slice(0, 90));
const noAuth = await fetch(`${URL}/functions/v1/parse-entry`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{"text":"got R50 from a job"}' });
ok('Edge Function without a user token is refused', noAuth.status === 401, String(noAuth.status));
const evilOrigin = await fetch(`${URL}/functions/v1/parse-entry`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY, Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{"text":"got R50 from a job"}' });
ok('Edge Function call from a foreign website origin is refused', evilOrigin.status === 403, String(evilOrigin.status));

await a.from('transactions').delete().eq('user_id', me);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
