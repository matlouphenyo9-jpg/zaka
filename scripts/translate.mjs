// Drafts ui.<locale>.json translations through the Anthropic API (B2: zu, nso, af in full; xh for keys it lacks).
// Only keys missing from the target file are sent, so a re-run retries just what failed or is new.
// The API key is read from the ANTHROPIC_API_KEY environment variable and never written anywhere.
//
//   ANTHROPIC_API_KEY=... node scripts/translate.mjs --locales zu,nso,af,xh [--max-usd 5] [--effort low] [--dry-run]
//   node scripts/translate.mjs --via-function ...   (temporary translate-draft Edge Function, QA owner only)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.4, output: 20 }; // USD per million tokens
const BATCH = 40;
const MAX_ROUNDS = 3;
const NAMES = { zu: 'isiZulu', xh: 'isiXhosa', nso: 'Sepedi (Sesotho sa Leboa)', af: 'Afrikaans' };

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const locales = String(args.locales ?? 'zu,nso,af,xh').split(',').filter((l) => NAMES[l]);
const maxUsd = Number(args['max-usd'] ?? 5);
const effort = String(args.effort ?? 'low');
const dryRun = !!args['dry-run'];
const reportPath = String(args.report ?? 'translate-report.json');

const path = (f) => new URL(`../src/i18n/${f}`, import.meta.url);
const load = (f) => JSON.parse(readFileSync(path(f), 'utf8'));
const uiEn = load('ui.en.json');
const uiXh = load('ui.xh.json');
const d4En = load('en.json');
const sourceKeys = Object.keys(uiEn).filter((k) => !k.startsWith('_'));

// Same placeholder rule as check-i18n, plus numbers and rand amounts, which must survive unchanged.
const placeholders = (s) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');
const numbers = (s) => (s.replace(/\{[a-zA-Z]+\}/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join(',');
const rands = (s) => (s.match(/R\s?(?=\d|\{)/g) ?? []).length;

function problems(en, out) {
  const p = [];
  if (typeof out !== 'string' || !out.trim()) return ['empty'];
  if (placeholders(en) !== placeholders(out)) p.push(`placeholders ${placeholders(en)} vs ${placeholders(out)}`);
  if (numbers(en) !== numbers(out)) p.push(`numbers ${numbers(en)} vs ${numbers(out)}`);
  if (rands(out) < rands(en)) p.push('rand sign R lost');
  return p;
}

// Not failures, but worth a native speaker's eye.
function reviewReasons(key, en, out) {
  const r = [];
  if (out.length > Math.max(en.length * 1.8, en.length + 25)) r.push('much longer than English');
  if (en.split(/\s+/).length > 2 && out.trim() === en.trim()) r.push('identical to English');
  if (/^(consent_|scam_|flag_|loan_|help_)/.test(key)) r.push('safety, legal or consent wording');
  return r;
}

const pairs = (a, b, keys) => keys.filter((k) => typeof b[k] === 'string').map((k) => `${k}\n  en: ${a[k]}\n  ->: ${b[k]}`).join('\n');

function systemFor(locale) {
  const d4 = load(`${locale}.json`);
  const d4Keys = Object.keys(d4En).filter((k) => k !== 'language' && k !== 'status');
  const xhKeys = sourceKeys.filter((k) => k in uiXh);
  return [
    {
      type: 'text',
      text: `You translate the UI of Zaka, a cash-first money planner app for South Africans who earn irregular cash income (piece jobs, SASSA grants, stokvels, spaza shops). Users read on cheap phones with small screens.

Rules:
- Natural, everyday wording that people actually speak, not formal or literary language. Short enough for a phone button or line.
- Keep every key exactly as given.
- Keep every {placeholder} exactly as written, untranslated, and keep each one.
- Keep all numbers, the rand sign "R", "%" and phone numbers unchanged.
- Keep names unchanged: Zaka, SASSA, SAPS, NCR, OBS, NCA, FNB, Capitec, Absa, Standard Bank, Nedbank, TymeBank, Crime Stop.
- Match the tone of the examples below: warm, plain, direct.
- Output JSON only: one string per key.

Style reference: English UI strings with an isiXhosa draft (keep the same register; for other languages translate from the English, never from the isiXhosa).
${pairs(uiEn, uiXh, xhKeys)}`,
    },
    {
      type: 'text',
      text: `Glossary: these core app strings are already approved in ${NAMES[locale]}. Reuse their terms (for example for "safe to spend", grant, stokvel, income, plan) so the app stays consistent.
${pairs(d4En, d4, d4Keys)}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

let spent = 0;
const cost = (u) =>
  ((u.input_tokens ?? 0) * PRICE.input +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (u.output_tokens ?? 0) * PRICE.output) / 1e6;

async function callBatch(client, locale, keys, done) {
  if (spent + 0.3 >= maxUsd) throw new Error(`cost cap reached ($${spent.toFixed(2)} of $${maxUsd})`);
  const schema = {
    type: 'object',
    properties: Object.fromEntries(keys.map((k) => [k, { type: 'string' }])),
    required: keys,
    additionalProperties: false,
  };
  const already = Object.keys(done).length ? `\nAlready translated in this run (stay consistent with these):\n${pairs(uiEn, done, Object.keys(done))}\n` : '';
  const source = JSON.stringify(Object.fromEntries(keys.map((k) => [k, uiEn[k]])), null, 1);
  const res = await client({ system: systemFor(locale), user: `${already}\nTranslate these English strings into ${NAMES[locale]}:\n${source}`, schema, effort });
  spent += cost(res.usage ?? {});
  if (res.stop_reason !== 'end_turn') throw new Error(`stop_reason ${res.stop_reason}`);
  return JSON.parse(res.text);
}

async function translate(client, locale) {
  const file = `ui.${locale}.json`;
  const existing = existsSync(path(file)) ? load(file) : {};
  const todo = sourceKeys.filter((k) => !(k in existing));
  const done = {};
  const failed = {};
  let pending = todo;
  for (let round = 1; round <= MAX_ROUNDS && pending.length; round++) {
    const next = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const keys = pending.slice(i, i + BATCH);
      let out = {};
      try {
        out = await callBatch(client, locale, keys, { ...done });
      } catch (e) {
        console.log(`${locale}: batch failed (${e.message})`);
        if (String(e.message).startsWith('cost cap')) return finish(locale, existing, done, { ...failed, ...Object.fromEntries(pending.slice(i).map((k) => [k, ['not attempted: cost cap']])) });
      }
      for (const k of keys) {
        const p = problems(uiEn[k], out[k]);
        if (p.length) { failed[k] = p; next.push(k); }
        else { done[k] = out[k]; delete failed[k]; }
      }
      console.log(`${locale}: round ${round}, ${Object.keys(done).length}/${todo.length} ok, $${spent.toFixed(2)} so far`);
    }
    pending = next;
  }
  return finish(locale, existing, done, failed);
}

function finish(locale, existing, done, failed) {
  const merged = {
    _comment: existing._comment
      ? `${existing._comment} Keys added later are an API draft generated through the Anthropic API (${new Date().toISOString().slice(0, 10)}).`
      : `${NAMES[locale]} API draft generated through the Anthropic API (${new Date().toISOString().slice(0, 10)}) from ui.en.json, with the D4 strings as glossary. Native-speaker review required; the language stays labelled beta.`,
  };
  for (const k of sourceKeys) {
    if (k in existing) merged[k] = existing[k];
    else if (k in done) merged[k] = done[k];
  }
  writeFileSync(path(`ui.${locale}.json`), JSON.stringify(merged, null, 2) + '\n');
  const review = Object.fromEntries(
    Object.entries(done).map(([k, v]) => [k, reviewReasons(k, uiEn[k], v)]).filter(([, r]) => r.length),
  );
  return { locale, added: Object.keys(done).length, failed, review, strings: done };
}

// Direct: the caller's own ANTHROPIC_API_KEY. Via function: a temporary Edge Function that holds the key
// server-side and only accepts the QA owner account (QA_PASSWORD env var).
async function direct() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY in your shell (never in a committed file), or use --via-function.');
    process.exit(1);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const sdk = new Anthropic({ timeout: 180_000, maxRetries: 2 });
  return async ({ system, user, schema, effort }) => {
    const res = await sdk.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system,
      output_config: { format: { type: 'json_schema', schema }, effort },
      messages: [{ role: 'user', content: user }],
    });
    return { text: res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), stop_reason: res.stop_reason, usage: res.usage };
  };
}

async function viaFunction() {
  const { createClient } = await import('@supabase/supabase-js');
  const URL = 'https://dalhthsxuyttsgyigwgd.supabase.co';
  const sb = createClient(URL, 'sb_publishable_3gDDWCLElWvPr_9TYTD81A_DKSKG4Mr', { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: 'qa-owner@zaka-qa.test', password: process.env.QA_PASSWORD ?? 'QaTest!2026x' });
  if (error) throw new Error('QA sign-in failed');
  return async (body) => {
    for (let attempt = 1; ; attempt++) {
      const r = await fetch(`${URL}/functions/v1/translate-draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', ...(process.env.TRANSLATE_TOKEN ? { 'x-zaka-token': process.env.TRANSLATE_TOKEN } : {}) },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (r.status === 402) throw new Error('cost cap reached (server budget exhausted)');
      if (attempt >= 2 || r.status < 500) throw new Error(`function ${r.status} ${j.error ?? ''}`);
    }
  };
}

const todoCounts = Object.fromEntries(locales.map((l) => [l, sourceKeys.filter((k) => !(k in (existsSync(path(`ui.${l}.json`)) ? load(`ui.${l}.json`) : {}))).length]));
console.log('keys to translate:', todoCounts);
if (dryRun) {
  for (const l of locales) console.log(`${l}: ~${Math.round(JSON.stringify(systemFor(l)).length / 3.5)} system tokens, ${Math.ceil(todoCounts[l] / BATCH)} batch(es)`);
  process.exit(0);
}
const client = args['via-function'] ? await viaFunction() : await direct();
const results = await Promise.all(locales.map((l) => translate(client, l)));
writeFileSync(reportPath, JSON.stringify({ model: MODEL, usd: Number(spent.toFixed(3)), results }, null, 2) + '\n');
for (const r of results) console.log(`${r.locale}: +${r.added}, failed ${Object.keys(r.failed).length}, flagged for review ${Object.keys(r.review).length}`);
console.log(`total cost ~$${spent.toFixed(2)}; report written to ${reportPath}`);
