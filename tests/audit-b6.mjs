// B6 audit checks (live): concurrent AI bursts can't beat the hourly limit, the shared demo can't be renamed,
// trigger-only database functions can't be called through the API, and a crafted PDF can't make the page check crawl.
// Needs qa-race@zaka-qa.test (no scans this hour) and qa-other@zaka-qa.test. Costs about 10 cheap vision calls.
//   node tests/audit-b6.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
const KEY = 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';
const PW = process.env.QA_PASSWORD ?? 'QaTest!2026x';
const client = () => createClient(URL, KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`); };

// 1. 25 simultaneous scans against the 10-an-hour limit: exactly 10 may run.
const race = client();
const { data: rs } = await race.auth.signInWithPassword({ email: process.env.RACE_EMAIL ?? 'qa-race@zaka-qa.test', password: PW });
const file = readFileSync('public/samples/slip-airtime.png').toString('base64');
const scan = () => fetch(`${URL}/functions/v1/scan-receipt`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${rs.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ file }) }).then((r) => r.status);
const statuses = await Promise.all(Array.from({ length: 25 }, scan));
const okCount = statuses.filter((s) => s === 200).length;
ok('25 simultaneous scans: no more than the 10-an-hour limit get through', okCount <= 10 && statuses.every((s) => s === 200 || s === 429), JSON.stringify(statuses.reduce((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {})));

// 2. The shared demo can't be renamed (everyone would be greeted with it); a normal account can rename itself.
const demo = client();
const { data: ds } = await demo.auth.signInWithPassword({ email: 'demo@zaka.app', password: 'Zaka2026!demo' });
const dn = await demo.from('profiles').update({ display_name: 'Vandal' }).eq('user_id', ds.user.id).select('display_name');
ok('demo profile name can’t be changed by a client', !dn.error && dn.data?.[0]?.display_name === 'Lerato', JSON.stringify(dn.data ?? dn.error));
const other = client();
const { data: os } = await other.auth.signInWithPassword({ email: 'qa-other@zaka-qa.test', password: PW });
const on = await other.from('profiles').update({ display_name: 'Thandi' }).eq('user_id', os.user.id).select('display_name');
ok('a normal account can still change its own name', on.data?.[0]?.display_name === 'Thandi', JSON.stringify(on.data ?? on.error));

// 3. Trigger-only functions aren't part of the API.
for (const fn of ['throttle_user_writes', 'limit_feedback']) {
  const r = await other.rpc(fn);
  ok(`${fn} can’t be called through the API`, !!r.error, r.error?.code);
}
// 4. ai_take (the limit counter) can't be called by users to burn someone's allowance or skip a limit.
const take = await other.rpc('ai_take', { p_user: ds.user.id, p_fn: 'scan-receipt', p_client: null, p_per_hour: 999, p_per_day: 999, p_account_per_day: 999, p_global_per_day: 999 });
ok('ai_take can’t be called by users', !!take.error, take.error?.code);

// 5. A crafted 3 MB "PDF" full of /Type /Pages is refused quickly, not after minutes of pattern matching.
const evil = Buffer.from('%PDF-1.7\n' + '/Type /Pages '.repeat(223_000)).toString('base64');
const t0 = Date.now();
const r = await fetch(`${URL}/functions/v1/scan-receipt`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${os.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ file: evil }) });
const ms = Date.now() - t0;
ok('crafted 3 MB PDF answered quickly with no AI call', [422, 429].includes(r.status) && ms < 15_000, `${r.status} in ${ms} ms`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
