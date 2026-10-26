# Bunty Consulting — Franchise Partner Engine

Takes a franchise partner from **application → decision → onboarding → open store**, built for the
"AI x Ops" hackathon (Case 1: Franchise Partner Acquisition, Geo-Selection & Onboarding).

Every decision comes from a **rule engine that implements the Build Spec** (`Franchise_MVP_Build_Spec.md`):
data-quality flags, gates, a 100-point fit score, cannibalisation penalties, approval bars by territory
priority, slot allocation with local priority and the 15-point gap rule, **one store per PIN**, reservations
and deadlines, explanations with reason codes, improvement tips and a 12-week onboarding plan.
The engine is a pure function — `runPipeline(baseData, overrides, options) → results` — so the same data
always gives the same answer, and every follow-up is a full re-run.

**Gemini is optional and never decides.** With a key it (1) reads free-text follow-ups the rules don't
understand, (2) drafts relationship-manager replies in the partner's language, and (3) independently
recomputes the rubric so the checks agent can flag disagreements. Without a key, or if it is slow or
rate-limited, everything falls back to rules — the link keeps working.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 73 tests: spec scenarios 1–35, parser, checks agent
npm run build      # static bundle in dist/
```

**Gemini (optional):** copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY` — Gemini is reached through
the OpenRouter gateway, Google providers only (optionally `OPENROUTER_MODEL`, default `google/gemini-3.7-flash`). The key is read by the dev server and by the Vercel
function `api/gemini.ts` — it is never in the browser bundle.

**Deploy:** import the repo in Vercel (framework: Vite). Add `OPENROUTER_API_KEY` under Project → Settings →
Environment Variables if you want Gemini. No login, no database. `vercel.json` keeps `/api/*` for the
function and sends every other route to the SPA.

## Demo script (what a judge sees)

1. **Land** on `/` → drop the Excel template (or *Try with sample data*; *Sample data (.xlsx)* downloads the
   same data in the judges' format). Sheets are found by their headers; the grey example row is skipped;
   problems become friendly messages or data-quality flags, never crashes.
2. **Overview / Applicants** — every applicant has one outcome (Approve, Hold — slot reserved,
   Redirect — slot reserved, Hold, Waitlist, Reject, Withdrawn) with the reason, score breakdown,
   warnings and what to do next. Click any badge for the *why*; the drawer has the full trace.
3. **Ask & What-if** — *"Why is APP-012 on hold?"* → one line, why, what next.
   *"APP-012 has now found a ground-floor space"* → "Understood: space → Rented (assumed), floor → Ground,
   size → unknown (assumed)" → 7-day hold to share the size. *"APP-012 space is 450 sq ft"* → Approved,
   and every applicant that moved is listed (slots, queue positions). **Undo** on each update.
4. **Partner portal** (`/partner`) — type an Application ID (no password). Shown in the applicant's language
   (Kannada / Hindi / English toggle): status, why, score, tasks with *Mark as done*, training track,
   buddy store, opening date; reservations show their tracker and deadline. Chat with the brand.
5. **Partner inbox** — the brand side of the chat: partner messages, auto-replies from the engine, updates
   detected in messages (*Apply update & re-run*), *Suggest reply*.
6. **Time slider** (top bar, Day 0 → Week 14) — moves "today": tasks fall due, reservations lapse and the slot
   goes to the next in line, health turns At risk / Delayed. Company actions: verify a task, extend a
   deadline by 7 days (reason required), release a reservation.
7. **Checks** — the checks agent re-audits every decision after each change (one store per PIN, slots,
   score arithmetic, independent re-score, decision lines, money floor, redirects, gap rule, onboarding
   plans, determinism). *Run full audit* adds the Gemini rubric cross-check.

Everything the judge changes stays in **their browser only** (localStorage), and survives a refresh.

## Folder map

```
src/
  config.ts       Every rule number from the spec (§4) — no magic numbers elsewhere
  engine/
    parse.ts      Workbook → typed data (§3)            flags.ts      Data-quality flags (§6)
    score.ts      Fit score, 5 factors (§7)             location.ts   Territories, cannibalisation, redirects (§9)
    allocate.ts   Gates + slot allocation (§8, §10)     onboarding.ts Plan, tasks, training, health (§13, §15)
    explain.ts    Reason text, warnings, tips (§12)     pipeline.ts   runPipeline(baseData, overrides, options)
    diff.ts       Before/after comparison (§16)         followups.ts  Rule-based question / update parser (§16)
    checks.ts     The checks agent                      present.ts    Engine result → UI shapes
    realEngine.ts DecisionEngine: state, overrides, time slider, chat, Gemini fallbacks
    types.ts      UI types + the DecisionEngine interface; hooks.ts — the only way components reach it
  i18n/           en / kn / hi dictionaries (reason templates, tasks, partner UI) — fall back to English
  features/       upload · overview · map · applicants · pipeline · territories · onboarding · whatif (Ask)
                  · partner · inbox · checks · settings
  data/mock/      Sample data (40 applications, 8 territories, the 10 stores), PIN centroids, placeholders
server/gemini.ts  Gemini proxy with server-owned prompts (3 fixed tasks)   api/gemini.ts  Vercel function
scripts/          make-sample-xlsx.mjs (public/sample_data.xlsx) + Playwright helpers
```

## Placeholders (kept on purpose — the data isn't available yet)

See [PLACEHOLDERS.md](PLACEHOLDERS.md): payback estimate (out of the decision, spec §2), relationship
managers' contact details, staff training/quiz scores, training module progress, approximate PIN centroids
and catchment rings on the map. None of them affect a decision.

## Verification

- `npm test` — 39 acceptance tests (spec §18 scenarios 1–35 + worked numbers + follow-ups), 5 parser tests
  (judges' template, header/format variants, friendly errors), 25 checks-agent runs over what-ifs and the
  time slider, plus formatting/hex tests.
- `tsc` strict, production build, browser walkthrough: sample → overview → drawer → Ask (APP-012 flow) →
  partner portal in Hindi/Kannada → partner chat → inbox apply → time slider → checks; 375 px layout.
- Translations (Kannada, Hindi) should be checked by a native speaker before the demo (spec §14).
