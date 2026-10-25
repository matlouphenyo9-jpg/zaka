# Zaka: every rand, with a plan

Zaka is a cash-first money planner for South Africans whose income is uneven: SASSA grants, piece jobs, selling and stokvels rather than one salary on the 25th. You tell it what came in and what went out (tap the keypad or just type "got R350 from a piece job"), and it answers the question that matters on a tight budget: **how much can I safely spend until my next money arrives, and which day will be tight?** It also checks suspicious SMS and WhatsApp messages for scam signs, and checks a loan quote against the legal maximums in the National Credit Regulations. All the maths runs in plain code on the phone and every number can be explained; AI is only used to read a typed sentence and to explain scam warning signs in the user's language. Zaka is JustIT Solutions' entry for the FNB App of the Year Hackathon 2026.

## Try it

- **Live app:** https://zaka.pages.dev (installable PWA; open it on a phone and "Add to Home screen")
- **Demo:** tap **Try the demo (Lerato)** on the sign-in screen, or sign in with `demo@zaka.app` / `Zaka2026!demo`
- Lerato is a synthetic person: 10 weeks of made-up grant, piece-job and spending history that is reloaded, ending today, each time "Try the demo" is tapped. The demo keeps the language you picked.

## Screenshots

Captured from a production build at 390×844 with the real demo account and live AI (`npm run screenshots`).

| Language picker | Home | Type it | AI fills the form |
| --- | --- | --- | --- |
| <img src="docs/screenshots/01-language.png" width="200" alt="Language picker"> | <img src="docs/screenshots/02-home.png" width="200" alt="Home: safe to spend and tight-day warning"> | <img src="docs/screenshots/03-add-typed.png" width="200" alt="Typing got R350 from a piece job"> | <img src="docs/screenshots/04-add-filled.png" width="200" alt="Form filled by AI, to check before saving"> |
| **Saved: the tight day moves** | **Plan (14 days)** | **Why this estimate?** | **Scam Shield** |
| <img src="docs/screenshots/05-add-saved.png" width="200" alt="Tight day moved and safe to spend went up"> | <img src="docs/screenshots/06-plan.png" width="200" alt="14-day plan"> | <img src="docs/screenshots/07-why.png" width="200" alt="Why this estimate: every line of the sum"> | <img src="docs/screenshots/08-scam-en.png" width="200" alt="Scam Shield flags the SASSA scam"> |
| **Scam Shield in isiXhosa** | **Loan Check** | **Me / language** | |
| <img src="docs/screenshots/11-scam-xh.png" width="200" alt="Scam Shield in isiXhosa"> | <img src="docs/screenshots/09-loan-above-max.png" width="200" alt="Loan Check: above the legal maximum"> | <img src="docs/screenshots/10-me-language.png" width="200" alt="Me screen with language switch"> | |

## Features

- **Safe to spend until {date}**, plus a daily amount, from a 14-day plan that only counts money you can rely on.
- **Tight-day warning**: the first day the money is expected to run out, and what would cover the gap.
- **Type it**: write an entry in your own words in any of the five languages; AI fills the form and you check it before saving. If AI is unavailable, an on-phone parser fills what it can.
- **Learns patterns** from confirmed history: grant day, recurring weekly money, piece jobs per week, tightest day of the month, biggest spending weekday. Each pattern can be accepted or rejected.
- **Why this estimate?**: every line of the sum, with an honest confidence level (low, medium or high).
- **Bills, stokvels and goals**: amounts are set aside before anything is called safe to spend.
- **Scam Shield**: rules in code flag PIN/OTP requests, upfront fees, urgency, links, impersonation and more; AI then explains the risk and a safe next step in your language. The message itself is never stored, only which warning signs were found. Tap-to-call reporting numbers (SAPS Crime Stop, SASSA, NCR, banking ombud, six banks), each checked on official websites.
- **Loan Check**: totals what a loan really costs in rands and compares the interest rate, initiation fee and monthly service fee with the legal maximums for eight credit types (National Credit Regulations 42 and 44, repo rate 7.25% from 25 Sep 2026). It is not legal advice.
- **Works offline**: the last plan is cached on the phone and new entries queue in IndexedDB until there is a connection.
- **Five languages**: English, isiZulu, isiXhosa, Sepedi and Afrikaans (see below).
- **Your data, your call**: delete everything from the Me screen.

## Architecture

```mermaid
flowchart LR
  subgraph Phone["Phone: installable PWA"]
    UI["React + TypeScript UI<br/>5 languages"]
    ENG["Intelligence engine<br/>(plain code, unit-tested)"]
    IDB[("IndexedDB<br/>cache + offline queue")]
    UI --> ENG
    UI <--> IDB
  end

  CF["Cloudflare Pages<br/>static hosting"] -- serves app --> Phone

  subgraph SB["Supabase"]
    AUTH["Auth"]
    PG[("Postgres<br/>Row Level Security")]
    EF["Edge Functions<br/>parse-entry · explain-scam<br/>auth, rate limits, input checks"]
  end

  UI -- sign in --> AUTH
  UI -- "own rows only (RLS)" --> PG
  UI -- "typed sentence / pasted message" --> EF
  EF -- usage counts --> PG
  EF -- "API key stays server-side" --> CLAUDE["Claude API"]
```

The browser holds only the public Supabase key; every table is protected by Row Level Security. The Claude API key exists only as a Supabase secret, so the phone never talks to Claude directly.

## The intelligence engine, simply

Zaka's forecast is deterministic code in `src/engine/`, not AI. It walks forward day by day on a **low path**: the cautious version of the next two weeks.

1. **Start with the money you have now.**
2. **Subtract what is coming out**: bills and stokvel contributions on their due days, and daily essentials (transport, food, electricity, data), using your own amounts or what it learned from your last four weeks.
3. **Add expected money, weighted by how sure it is**: confirmed counts in full, *likely* counts half, *possible* counts nothing.
4. **Stop at your next reliable money** (for example grant day or payday), or after 14 days if none is due.
5. **What is left, after your reserve and set-asides, is safe to spend**, shared across the days until that money arrives. The first day the running balance would go below zero is the **tight day**.

**Worked example** (an actual unit test in `src/engine/forecast.test.ts`): you have **R1,200**. Electricity of **R300** is due tomorrow. Essentials cost about **R100 a day**. A salary is expected in **5 days**, so Zaka plans 5 days, not 14. A piece job of about **R400** usually comes every few days, but it is only *likely*, so Zaka counts half: **R200**.

> R1,200 − R300 − (5 × R100) + R200 = **R600 safe to spend**, which is **R120 a day** until payday.

The salary itself is not counted: it is where the plan ends. A second test checks the opposite case: with R350, R300 due tomorrow and R100 a day of essentials, Zaka flags tomorrow as the tight day and shows R0 safe to spend.

Patterns (grant day, piece-job frequency and so on) come from confirmed history only and are shown with how often they were seen. Confidence is high only with enough history and a pattern seen three or more times.

## Security

- **Row Level Security on every table.** Users can read and change only their own rows; reference prices are read-only; rate-limit counters are service-role only. **31/31** live checks pass across owner, another user and anonymous access (`npm run test:rls`).
- **Prompt injection.** Pasted messages are fenced as untrusted data, outputs are schema-checked, and unsafe claims (such as "this message is safe") are blocked. **26/26** live checks pass (`npm run test:injection`).
- **Edge Functions** require a signed-in user, check the origin against an allow-list, validate input size and shape, and apply per-user limits (parse: 30 an hour / 200 a day; explain: 20 an hour / 100 a day) plus a project-wide daily AI budget. Logs contain no message text or personal data.
- **Demo lock-down.** The shared demo account's email and password can't be changed and the account can't be deleted. Its data is capped (60 entries, 15 bills, 15 goals, 100 scam checks), and its language change stays on the device. **9/9** checks pass (`node tests/demo-guard.mjs`). Sign-ups are throttled to 60 an hour.
- **Secrets** (`ANTHROPIC_API_KEY`) live only in Supabase, never in this repository.

## Test results

| Check | Result | How |
| --- | --- | --- |
| Engine unit tests (forecast, patterns, loan, dates…) | 37/37 pass | `npm test` |
| Translation key and placeholder parity | OK | `npm run check:i18n` |
| Row Level Security and API abuse (live) | 31/31 | `npm run test:rls` |
| Prompt injection and input validation (live) | 26/26 | `npm run test:injection` |
| Demo account protections (live) | 9/9 | `node tests/demo-guard.mjs` |
| AI in all 5 languages (live) | parse 8/8, explain 5/5 | `npm run test:ai` |
| Small-phone layout, 320 px | 9 screens × 5 languages, no overflow | Playwright |
| Lighthouse 11, local production build | PWA 100 · Accessibility 100 · Best Practices 100 · SEO 100 · Performance 94 | Lighthouse |

The live checks were last run on 24 Oct 2026 using two QA accounts that were deleted afterwards; re-running them needs QA accounts (`qa-owner@zaka-qa.test`, `qa-other@zaka-qa.test`) to be created first.

## Languages

| Language | Status |
| --- | --- |
| English | Source |
| isiZulu | Beta: machine draft, native review pending |
| isiXhosa | Beta: machine draft, native review pending |
| Sepedi | Beta: machine draft, native review pending |
| Afrikaans | Beta: machine draft, native review pending |

Core strings (the D4 set) were provided by the team; the remaining UI strings were machine-drafted with key and placeholder checks, and every non-English language stays labelled **beta** until a native speaker signs it off. Dates use the device's language data, falling back to bundled CLDR names for isiZulu, isiXhosa and Sepedi when the browser has none.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173, uses the hosted Supabase project and its public key
npm test             # engine unit tests
npm run build        # static dist/ for Cloudflare Pages (SPA fallback in public/_redirects)
npx vite preview     # serve the build on http://localhost:4173
```

To use another Supabase project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, apply `supabase/migrations`, deploy `supabase/functions` (run `npm run sync:functions` first) and set the `ANTHROPIC_API_KEY` secret. Local origins `localhost:5173` and `localhost:4173` are allowed by the Edge Functions.

## Repository layout

- `src/engine/`: pure, unit-tested intelligence (patterns, forecast, insights, scam rules, loan maths, legal limits)
- `src/screens/`, `src/components/`: the UI
- `src/lib/store.tsx`: Supabase sync, IndexedDB cache and offline queue
- `src/i18n/`: language files
- `supabase/migrations/`, `supabase/functions/`: database schema, RLS, guards and Edge Functions
- `tests/`: live security and AI tests
- `scripts/`: demo seed, translation, screenshot and i18n tools

All demo data is synthetic. Zaka never moves money and does not decide whether anyone qualifies for credit.
