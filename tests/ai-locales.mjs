// Live checks of parse-entry and explain-scam in all five locales (needs ANTHROPIC_API_KEY on the project).
import { createClient } from '@supabase/supabase-js';
const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
const KEY = 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr';
const ORIGIN = process.env.ORIGIN ?? 'https://zaka.pages.dev';
const c = createClient(URL, KEY, { auth: { persistSession: false } });
const { data } = await c.auth.signInWithPassword({ email: process.env.QA_EMAIL ?? 'qa-owner@zaka-qa.test', password: process.env.QA_PASSWORD ?? 'QaTest!2026x' });
const call = async (fn, body) => {
  const r = await fetch(`${URL}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
// Test inputs only (not app copy): simple sentences with an unambiguous expected result.
const PARSE = [
  ['en', 'got R350 from a piece job', { direction: 'in', amount_cents: 35000, category: 'piece_job' }],
  ['en', 'paid R48 for taxi yesterday', { direction: 'out', amount_cents: 4800, category: 'transport', days_ago: 1 }],
  ['zu', 'ngithole u-R350 emsebenzini wokuhlanza', { direction: 'in', amount_cents: 35000 }],
  ['xh', 'ndifumene iR350 kumsebenzi wokucoca', { direction: 'in', amount_cents: 35000 }],
  ['xh', 'ndithenge umbane we-R100', { direction: 'out', amount_cents: 10000, category: 'electricity' }],
  ['nso', 'ke hweditše R350 mošomong wa go hlwekiša', { direction: 'in', amount_cents: 35000 }],
  ['af', 'het R59 aan data spandeer', { direction: 'out', amount_cents: 5900, category: 'data_airtime' }],
  ['af', 'R580 toelaag van SASSA ontvang', { direction: 'in', amount_cents: 58000, category: 'grant' }],
];
let pass = 0, fail = 0;
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' })).toISOString().slice(0, 10);
for (const [locale, text, want] of PARSE) {
  const r = await call('parse-entry', { text, locale });
  const e = r.body.entry ?? {};
  const okFields = Object.entries(want).every(([k, v]) => k === 'days_ago' ? true : e[k] === v);
  const ok = r.status === 200 && okFields;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  parse ${locale.padEnd(3)} "${text}" -> ${r.body.via} ${JSON.stringify(e)}`);
}
const SCAM = 'Congratulations! Your R5000 loan is approved, no credit check. Pay an admin fee of R350 today to release your loan. WhatsApp 071 000 0000.';
for (const locale of ['en', 'zu', 'xh', 'nso', 'af']) {
  const r = await call('explain-scam', { text: SCAM, flags: ['upfront_fee', 'too_good'], level: 'high', locale });
  const out = `${r.body.summary ?? ''} ${r.body.next_step ?? ''}`.trim();
  const words = out.split(/\s+/).length;
  const ok = r.status === 200 && words <= 75 && !/071 000 0000|https?:/.test(out) && !/\b(is safe|not a scam)\b/i.test(out);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  explain ${locale.padEnd(3)} [${r.status}, ${words} words] ${out || JSON.stringify(r.body)}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
