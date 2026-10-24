# Zaka — every rand, with a plan

Cash-first money planner PWA for people with uneven income (grants, piece jobs, trading).
JustIT Solutions' entry for the FNB App of the Year Hackathon 2026.

- **Safe to spend until {date}** + daily pace, from a deterministic 14-day low-path ledger
- **Learns patterns** from confirmed history: grant day, piece-job frequency, tight days
- **Scam Shield** (rules in code + AI explanation in your language) and **Loan Check** (National Credit Regulations reg. 42)
- **Five languages** (English source; isiZulu, isiXhosa, Sepedi, Afrikaans marked *beta* until native review)
- **Works offline**: entries queue in IndexedDB and sync later

## Stack
React + Vite + TypeScript + Tailwind · vite-plugin-pwa · i18next · Supabase (Auth, Postgres + RLS, Edge Functions) · Claude (Edge Functions only).

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests
npm run build      # static dist/ for Cloudflare Pages (SPA fallback in public/_redirects)
```
Supabase project ref `dalhthsxuyttsgyigwgd`. SQL lives in `supabase/migrations`, Edge Functions in `supabase/functions`.

## Layout
- `src/engine/` — pure, unit-tested intelligence (patterns, forecast, insights, scam rules, loan maths)
- `src/i18n/` — D4 resource JSON per locale (copied verbatim) + `ui.en.json` (English-only extra UI strings)
- `src/lib/store.tsx` — Supabase sync + IndexedDB cache + offline queue
- `scripts/lerato.csv` — synthetic demo history (verbatim from Notion); `node scripts/gen-seed.mjs` regenerates the seed

All demo data is synthetic.
