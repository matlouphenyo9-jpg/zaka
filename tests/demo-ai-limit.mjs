// The shared demo account has a small AI allowance per person (network), so one judge can't use up everyone's.
// parse-entry on the demo account: 30 an hour / 80 a day per network (account: 400 a day); normal accounts keep 30 an hour.
// Usage: node tests/demo-ai-limit.mjs   (uses the cheap parse model; needs qa-owner@zaka-qa.test)
import { createClient } from '@supabase/supabase-js';
const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
const KEY = 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const login = async (email, password) => (await createClient(URL, KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password })).data.session.access_token;
const parse = (token) => fetch(`${URL}/functions/v1/parse-entry`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'got R350 from a piece job', locale: 'en' }) }).then((r) => r.status);

const demo = await login('demo@zaka.app', 'Zaka2026!demo');
// Some networks (like this test machine's) leave through 2 addresses, so allow up to 2 × 30 before the block.
const statuses = [];
for (let i = 0; i < 70 && !statuses.includes(429); i++) statuses.push(await parse(demo));
ok('demo account: one person is limited per network (blocked before 70 calls)', statuses.includes(429), `${statuses.filter((s) => s === 200).length} allowed, then ${statuses.at(-1)}`);
const qa = await login('qa-owner@zaka-qa.test', process.env.QA_PASSWORD ?? 'QaTest!2026x');
const qaStatuses = [];
for (let i = 0; i < 5; i++) qaStatuses.push(await parse(qa));
ok('a normal account is not affected by the demo limit', qaStatuses.every((s) => s === 200), qaStatuses.join(','));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
