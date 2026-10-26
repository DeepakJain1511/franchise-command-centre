# Bunty Consulting — Franchise Expansion (Phase 1 UI/UX)

The front end of a tool that takes a franchise partner from **application → approved → onboarded → open store**,
built for the "AI x Ops" hackathon (Case 1: Franchise Partner Acquisition, Geo-Selection & Onboarding).

> **Phase 1 is UI only.** Every decision comes from hand-written fixtures behind a swappable
> `DecisionEngine`. There is no backend, no login and no secrets. See [PHASE2_TODO.md](PHASE2_TODO.md),
> and [API.md](API.md) for the backend endpoints and request/response shapes.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine guarantees + upload checks (16 tests)
npm run build      # static bundle in dist/
```

**Deploy:** push to Vercel or Netlify with no settings — `vercel.json` and `public/_redirects` handle
SPA routes. No environment variables.

## Demo script (what a judge sees)

1. **Land** on `/` → *Try with sample data* (or drop the Excel template). Staged progress, then a
   data-quality summary; each chip previews the rows behind it. *Open dashboard*. (~5 s end to end.)
2. **Overview** — click any KPI, funnel stage, donut slice, territory bar: the whole page cross-filters,
   filters show as removable chips and sync to the URL. Double-click (or ⋯ → drill) to list the applicants.
3. **Territory map** — Karnataka → city → territory → PIN hexes. Locks on PINs with a store or a planned
   store, applicant counts, conflicts, catchment rings with cannibalisation hatching, area select, table view.
4. **Any decision badge → "why"**: reason chips (✓ helped, ✕ hurt, ! missing) and a link to the full drawer.
5. **Ask & What-if** — *"Why is APP-007 on hold?"*, then *"What if APP-012 finds a ground-floor space?"* →
   *See the diff*: On hold → Approved, 3 reasons flip, TER-03 slots 1 → 0, APP-021 → Waitlisted.
   *Apply change* updates every screen; *Revert* undoes it.

**Things to play with**
- **Applications received** (Overview): drag the handles under the chart to pick dates — every widget
  filters to that range and the numbers roll to their new values; click a week to zoom to it.
- **Time-lapse** (Map): press ▶ to replay how applications arrived and stores got planned, week by week,
  or drag the scrubber.
- **Live what-if**: change space, floor or size in the sandbox and the outcome re-runs as you drag.
- **Keyboard**: `G` then `O`/`M`/`A`/`P`/`T`/`N`/`W` jumps between screens, `/` searches, `?` lists shortcuts.
- Cards follow the cursor with a soft spotlight; screens fade in with a gentle blur-in.

Useful deep links: `/map?pin=560068`, `/map?territory=TER-02`, `/applicants?view=attention`,
`/overview?status=On+hold`, `/applicants?app=APP-007`, `/dev/components` (component gallery).
Press **Ctrl/⌘ K** anywhere to jump to an applicant, territory or screen.

## Folder map

```
src/
  app/            App router, shell (sidebar, top bar), nav, page header, route errors
  components/     Shared UI: chips & badges, KPI/chart cards, gauge, states, filter bar,
                  side drawer, command palette, toaster; ui/ = Radix-based primitives
  features/
    upload/       Start screen + client-side workbook check (SheetJS, preview only)
    overview/     KPI strip, funnel, decision donut, territory fill, attention queue, more insights
    map/          Leaflet map, hex PIN layout, panels, coverage table
    applicants/   TanStack table + the applicant drawer (decision / profile / next steps / onboarding / timeline)
    pipeline/     Board (visual-only drag) / table / timeline
    territories/  Card grid + territory detail
    onboarding/   Partner steppers, training plan, cohort Gantt
    whatif/       Ask chat + what-if sandbox (diff, ripples, apply/revert)
    settings/     Theme, density, language preview, demo controls
    dev/          /dev/components gallery
  engine/
    types.ts      Domain types (zod) + the DecisionEngine interface
    mockEngine.ts The only implementation in Phase 1 (fixtures + fake latency)
    index.ts      Exports the active engine — the one-line swap
    hooks.ts      The only way components reach the engine
  data/mock/      applications, territories, stores, pincodes (approximate), decisions, scenarios
  store/          Zustand: filters (URL-synced), ui (theme/density/toasts), data (version, what-if history)
  lib/            Formatters (₹ L / Cr, en-IN), tokens, hex layout, filtering, aggregation, hooks
scripts/          Playwright helpers: screenshots, contact sheets, scripted flows, cognitive-load audit
```

## The DecisionEngine seam

```ts
// src/engine/index.ts
import { mockEngine } from './mockEngine';
export const engine: DecisionEngine = mockEngine;   // ← swap this one import in Phase 2
```

Components never import fixtures; they call hooks such as `useDecisions`, `useExplanation`,
`usePinStates`, `useTerritoryStates`, `useAsk`, `useSimulate` and `useScenarioCommit`. Hooks cache per data
version, so applying a what-if bumps the version and every screen refetches.

## What is mocked

Everything that decides: statuses, reasons, confidence, ranks, next steps, onboarding dates, canned
Q&A and what-if outcomes, and the approximate PIN centroids. Uploading a file runs a real **check**
(sheets, headers, row counts, missing columns, friendly errors) but results still come from the sample
set. Full list with file pointers: [PHASE2_TODO.md](PHASE2_TODO.md).

**The one hard rule is enforced and tested:** no two approved/planned applicants share a PIN, and none
share a PIN with an existing store — including after every canned what-if is applied
(`src/engine/mockEngine.test.ts`). Locked PINs show a lock and "one store per PIN".

## Design notes

- **3-level disclosure:** glance (numbers, colour) → click (cross-filter, compact panel) → drawer/detail.
- **Soft, warm palette:** ivory background, steel-blue accent, muted semantic colours — Approved green ·
  On hold amber · Rejected rose · Waitlisted blue-grey · In onboarding indigo · Open teal · Needs info
  violet. Priority is a steel-blue scale with bar glyphs. Colour is always paired with an icon or label;
  avatars are neutral so colour only means something.
- Light by default (dark only if picked in the top bar or Settings); dark is a calm slate, not black.
  Inter with tabular numbers, 150–250 ms motion, `prefers-reduced-motion` respected.
- **Map geography:** the Karnataka boundary is a simplified outline from the geohacker/india (GADM-derived)
  state boundaries (`src/data/geo/karnataka.ts`, regenerate with `scripts/extract-karnataka.mjs`).
  City markers sit on true city centres. PIN tiles are drawn at their locality's approximate centre
  (checked against public PIN directories) — a test keeps every tile within ~2 tile widths of it.
- Basemap: Esri Light/Dark Gray Canvas (no key). CARTO tiles, named in the brief, now return an
  "API key required" watermark.

## Verification done

- `tsc` strict (no `any`), 16 unit tests, production build.
- Playwright screenshots of every screen at 1440 px and 390 px, light and dark, reviewed and fixed.
- Scripted flows (dev and production build): first run in ~5 s, blank-template error message, filled
  workbook accepted, ask → diff → apply → APP-012 approved everywhere, cross-filter + URL sync,
  Ctrl+K → drawer, catchment overlay, pipeline drag toast. No console errors.
- Cognitive-load audit (`node scripts/audit.mjs`) — see below.

### Cognitive-load audit (1440 × 900, above the fold)

| Screen | Widgets | Words | Accent hues |
|---|---|---|---|
| Start | 1 | 49 | 2 |
| Overview | 5 (KPI strip, funnel, donut, territory fill, attention) | 167 | 7 |
| Map | 1 map + side panels | 142 | 7 |
| Applicants | 1 table | 386 (data rows) | 3 |
| Pipeline | 1 board | 289 (cards) | 6 |
| Territories | 1 card grid | 89 | 6 |
| Onboarding | 1 list + summary | 242 | 3 |
| Ask & What-if | 2 | 109 | 1 |
| Settings | 2 | 68 | 1 |

Cut or simplified along the way: random-hue avatars → neutral (Applicants 13 → 3 hues, Overview 11 → 7);
Experience and Language columns hidden by default; funnel conversion labels moved off the bars; the
"oversubscribed" flame only where a territory is full *and* still in demand; store icons hidden at
state zoom; "stuck" indicator raised from 14 to 21 days (it was on almost every card); "More insights"
charts collapsed below the fold.
