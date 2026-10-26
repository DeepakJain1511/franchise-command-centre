# Phase 2 — seams to wire the real engine

Phase 1 has **no business logic**. Every decision, reason, rank and what-if outcome is a
hand-written fixture served by `src/engine/mockEngine.ts`. To go live:

1. Implement `DecisionEngine` (`src/engine/types.ts`) in a new file, e.g. `src/engine/realEngine.ts`.
2. Change the one import in `src/engine/index.ts`.
3. Work through the seams below (each is marked `// PHASE-2: real logic goes here` in code).

No UI component needs to change: screens only use the hooks in `src/engine/hooks.ts`.

## Engine methods

| Method | Phase 1 behaviour | Phase 2 work | Code |
|---|---|---|---|
| `loadDataset(file)` | Ignores the file; always returns the sample fixtures | Parse rows into `Application` / `Territory` (zod schemas already exist), validate, keep the built-in stores | `mockEngine.ts` → `loadDataset`; `features/upload/checkWorkbook.ts` already finds sheets, headers and data rows |
| `getDecisions()` | Fixture per application (`data/mock/decisions.ts`) | Scoring, ranking and slot allocation per territory. **Keep the one-store-per-PIN rule** (see tests) | `data/mock/decisions.ts` |
| `explain(id)` | Long-form bullets assembled from the fixture's reason chips | Real explanation (rule trace and/or LLM summary). Keep the shape: 3–5 short chips + bullets | `mockEngine.ts` → `explain` |
| `ask(q)` | Regex on `APP-xxx` / `TER-xx`, canned answers | Natural-language Q&A over engine state. Keep the structured `AskResponse` (badge + 3 chips + 1 sentence) | `mockEngine.ts` → `ask` |
| `simulate(change)` | Only 4 canned scenarios match; anything else returns "no change" | Re-score the edited applicant, re-run allocation, diff before/after, compute ripples | `data/mock/scenarios.ts`, `mockEngine.ts` → `simulate` |
| `getScenarioPresets()` | The 4 canned scenarios | Suggest the most useful what-ifs (e.g. applicants one fix away from approval) | `mockEngine.ts` |
| `applyScenario` / `revertScenario` | Swap fixtures in memory | Persist the change (backend) and recompute | `mockEngine.ts` |
| `getTerritoryState()` | Counts of fixture statuses per territory | Fill from real allocation; oversubscription rule | `mockEngine.ts` → `territoryStatesSync` |
| `getPinStates()` | Derived from fixtures: store → allocated → outside → conflict (≥2 live applicants) → interest → open/full | Add "too close to an existing store" conflicts and real catchment analysis | `mockEngine.ts` → `pinStatesSync` |

| `getPartnerProfile(id)` | Manager by territory/city, payback from tier assumptions, seeded chat | Real CRM assignment, real P&L model per store, message history | `data/mock/partner.ts`, `mockEngine.ts` → `getPartnerProfile` |
| `sendPartnerMessage(id, text)` | Keyword-matched canned replies after a short delay | Real two-way messaging (backend + notifications) | `mockEngine.ts` → `sendPartnerMessage` |

## Data that is demo-only

- **PIN centroids** (`data/mock/pincodes.ts`) are approximate points, not surveyed boundaries.
  Swap in a real PIN geometry source; `lib/hex.ts` can stay as the visual layer or be replaced by polygons.
- **Catchment / cannibalisation overlay** is geometry only (hex overlaps a ring of N km). No sales analysis.
- **Attention queue order** comes from `attentionOrder` in the fixtures.
- **Next steps** use fixture checklists or status templates (`buildNextSteps`).
- **Training progress** is derived from the onboarding step (`buildOnboarding`), not from an LMS.
- **Onboarding dates** use fixed offsets per step (`STEP_OFFSETS`).
- **Demo "today"** is fixed at 26 Oct 2026 (`lib/time.ts` → `DEMO_TODAY`) so the demo is deterministic.
  Switch to `new Date()` when data is live.
- **Confidence** is a fixture number, shown as "visual only".

## Kept on purpose (not business logic)

- `lib/dataQuality.ts` — data-quality *validation* flags (blank size with "Owned", PIN/city mismatch, …).
- `lib/filtering.ts`, `lib/aggregate.ts` — presentation filters, counts and trends.
- The **one-store-per-PIN** lock — a hard, visible constraint. Tests in `src/engine/mockEngine.test.ts`
  check it for the base data and after every canned what-if; keep them green against the real engine.
