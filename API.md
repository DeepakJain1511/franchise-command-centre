# Backend API contract — Bunty Consulting frontend

This frontend talks to its data through one interface, `DecisionEngine`
([`src/engine/types.ts`](src/engine/types.ts)). Today it is served by a mock
([`src/engine/mockEngine.ts`](src/engine/mockEngine.ts)). To go live, the backend exposes the
endpoints below, a small `realEngine.ts` calls them, and **one import** in
[`src/engine/index.ts`](src/engine/index.ts) is switched. No screen changes.

The shapes below are copied from `src/engine/types.ts`. **That file is the source of truth** — if the
two ever disagree, follow `types.ts`.

---

## Conventions

- Base URL: `${VITE_API_URL}` (e.g. `http://localhost:8000`), all routes under `/api`.
- JSON in and out (`Content-Type: application/json`), except the Excel upload (`multipart/form-data`).
- Dates: `"YYYY-MM-DD"`; date-times: ISO 8601 (`"2026-10-26T09:15:00Z"`).
- Money is in **₹ lakh** as a plain number (`25` = ₹25,00,000). Percentages as numbers (`70` = 70 %),
  except `confidence`, `grossMargin` and `progress`, which are `0..1`.
- IDs: applications `APP-001`, territories `TER-01`, stores `ST-01`, PINs are 6-digit strings (`"560037"`).
- Errors: non-2xx with
  ```json
  { "error": { "code": "VALIDATION", "message": "Territories sheet is missing the \"Open slots\" column.", "details": ["…"] } }
  ```
  `message` is shown to the user as-is, so keep it short and friendly.
- CORS: allow the frontend origin (`http://localhost:5173` in dev, the deployed URL later), or use a
  Vite dev proxy.

---

## Endpoint summary

| # | Method & path | Engine method | Returns |
|---|---|---|---|
| 1 | `POST /api/datasets` | `loadDataset(file)` | `Dataset` |
| 2 | `POST /api/datasets/sample` | `loadDataset('sample')` | `Dataset` |
| 3 | `GET /api/datasets/current` | `getDataset()` | `Dataset` |
| 4 | `GET /api/decisions` | `getDecisions()` | `Decision[]` |
| 5 | `GET /api/decisions/:applicationId/explanation` | `explain(id)` | `Explanation` |
| 6 | `POST /api/ask` | `ask(question)` | `AskResponse` |
| 7 | `POST /api/simulate` | `simulate(change)` | `ScenarioResult` |
| 8 | `GET /api/scenarios/presets` | `getScenarioPresets()` | `ScenarioPreset[]` |
| 9 | `POST /api/scenarios/:scenarioId/apply` | `applyScenario(result)` | `204` |
| 10 | `POST /api/scenarios/:scenarioId/revert` | `revertScenario(id)` | `204` |
| 11 | `GET /api/territories/state` | `getTerritoryState()` | `TerritoryState[]` |
| 12 | `GET /api/pins/state` | `getPinStates()` | `PinState[]` |
| 13 | `GET /api/partners/:applicationId/profile` | `getPartnerProfile(id)` | `PartnerProfile` |
| 14 | `POST /api/partners/:applicationId/messages` | `sendPartnerMessage(id, text)` | `ChatMessage` |
| 15 | `GET /api/partners/:applicationId/staff` | `getStaff(id)` | `StaffRoster` |
| 16 | `POST /api/partners/:applicationId/staff` | `addStaff(id, staff)` | `StaffRoster` |
| 17 | `POST /api/partners/:applicationId/staff/:staffId/modules` | `assignStaffModule(...)` | `StaffRoster` |
| 18 | `POST /api/partners/:applicationId/staff/:staffId/modules/:moduleId/complete` | `completeStaffModule(...)` | `StaffRoster` |
| 19 | `DELETE /api/partners/:applicationId/staff/:staffId` | `removeStaff(...)` | `StaffRoster` |
| 20 | `POST /api/reset` | `reset()` | `204` (demo only) |

**Minimum for the demo:** 1–7, 11, 12. The partner portal (13–19) can stay on the mock until later —
mix both by having `realEngine` delegate those methods to `mockEngine`.

---

## Shared types

```ts
type City = 'Bengaluru' | 'Mysuru' | 'Mangaluru' | 'Hubballi-Dharwad' | 'Belagavi' | 'Tumakuru' | 'Davanagere';
type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3';
type SpaceAvailable = 'Owned' | 'Rented' | 'Not yet identified';
type Floor = 'Ground' | 'Upper' | 'Mall unit' | 'Not known';
type Language = 'Kannada' | 'English' | 'Hindi';
type Priority = 'High' | 'Medium' | 'Low';

type DecisionStatus = 'Approved' | 'On hold' | 'Waitlisted' | 'Rejected' | 'Needs info';
/** Kanban column / journey position */
type Stage = 'Applied' | 'Screened' | 'Approved' | 'On hold' | 'In onboarding' | 'Open';
type OnboardingStep = 'Agreement' | 'Space ready' | 'Fit-out' | 'Training' | 'Stock & systems' | 'Soft launch' | 'Open';

/** ✓ helped · ✕ hurt · ! missing / needs checking */
type Sentiment = 'helped' | 'hurt' | 'missing';
type ReasonTopic = 'investment' | 'experience' | 'space' | 'floor' | 'size' | 'launch' | 'territory' | 'pin' | 'data' | 'language';

interface Reason {
  id: string;          // stable per applicant+topic, e.g. "APP-012:space:1" (used to show which chips flipped)
  label: string;       // ≤ ~5 words, e.g. "Upper floor", "Capacity ₹70 L"
  sentiment: Sentiment;
  topic: ReasonTopic;
}
```

---

## 1–3 · Datasets

### `POST /api/datasets` — upload the judges' workbook

`multipart/form-data`, field `file` = the `.xlsx`. Sheets: **Applications**, **Territories**
(Existing stores is fixed/built-in). Header row is row 2; row 3 is a grey example row (`APP-001 /
Ravi Kumar`) that must be skipped if present. Column names are listed in
[`src/features/upload/checkWorkbook.ts`](src/features/upload/checkWorkbook.ts) (`EXPECTED`).

**200 → `Dataset`**

```ts
interface Dataset {
  source: 'sample' | 'upload';
  fileName?: string;
  applications: Application[];
  territories: Territory[];
  stores: Store[];
  /** City centre points for state-level map markers. */
  cities: Array<{ city: City; lat: number; lng: number }>;
  loadedAt: string; // ISO date-time
}

interface Application {
  id: string;               // "APP-001"
  name: string;
  city: City;
  state: 'Karnataka';
  pin: string;              // 6 digits
  investmentLakh: number;   // ≥ 0
  experienceYears: number;  // ≥ 0
  business: string;         // may be blank / messy
  space: SpaceAvailable;
  spaceSqft: number | null; // null when blank
  floor: Floor;
  launchMonths: number;     // integer > 0
  language: Language;
  notes: string;
  submittedAt: string;      // "YYYY-MM-DD" (not in the sheet — use upload date if unknown)
}

interface Territory {
  id: string;        // "TER-01"
  name: string;      // display name; derive e.g. "Bengaluru East" if the sheet has none
  city: City;
  state: 'Karnataka';
  pins: string[];    // from "Pin codes covered" (comma-separated)
  tier: Tier;
  openSlots: number;
  priority: Priority;
}

interface Store { id: string; city: City; pin: string; openedYear: number } // "ST-01"
```

**422** on a bad file, with one friendly sentence per problem in `details`, e.g.
`"Territories sheet is missing the \"Open slots\" column."`, `"The \"Applications\" sheet has no rows yet — add data from row 4."`
(The frontend already pre-checks these client-side; the backend should still validate.)

### `POST /api/datasets/sample` → `Dataset`
Loads the built-in sample (for "Try with sample data").

### `GET /api/datasets/current` → `Dataset`
The dataset in use (after upload or sample). `404` if none loaded yet.

---

## 4 · `GET /api/decisions` → `Decision[]`

One entry per application. **This is where the scoring rubric and slot allocation run.**

```ts
interface Decision {
  applicationId: string;
  status: DecisionStatus;
  stage: Stage;
  confidence: number;            // 0..1 (shown as a visual meter only)
  summary: string;               // one short sentence, company voice
  reasons: Reason[];             // 3–5 chips
  territoryId: string | null;    // territory whose pins include app.pin; null if none
  attention: string | null;      // one-line chip if the team should act today, e.g. "No space yet"
  attentionPriority: number | null; // lower = more urgent; null when attention is null
  dropReason: string | null;     // short bucket for the funnel, e.g. "Territory full", "PIN taken", "Missing info"
  nextSteps: NextStep[];
  onboarding: OnboardingPlan | null; // only for Approved
  dataFlags: DataFlag[];         // data-quality problems on the submitted row
  daysInStage: number;           // integer ≥ 0
  timeline: TimelineEvent[];     // newest first
  territoryRank: number | null;  // 1 = first in line in its territory; null if rejected / no territory
}

interface NextStep {
  id: string;
  label: string;
  owner: 'Partner' | 'Expansion team' | 'Legal' | 'Projects' | 'Training';
  dueDate: string; // "YYYY-MM-DD"
  done: boolean;
}

interface TimelineEvent {
  date: string; // "YYYY-MM-DD"
  label: string;
  kind: 'received' | 'screened' | 'decision' | 'info' | 'onboarding' | 'note';
}

interface DataFlag { field: string; label: string } // field = Application key, e.g. "spaceSqft"

interface OnboardingPlan {
  current: OnboardingStep;
  steps: Array<{ step: OnboardingStep; targetDate: string; state: 'done' | 'active' | 'upcoming' }>; // all 7, in order
  atRisk: boolean;
  riskNote?: string;           // e.g. "Space handover slipping to Dec"
  training: Array<{ id: string; title: string; week: number; hours: number; progress: number /* 0..1 */ }>;
  startDate: string;
  targetOpen: string;
}
```

**Hard rule (must hold in every response):** no two `Approved` applications share a PIN, and no
`Approved` application is on a PIN that already has a store. Never approve more than
`territory.openSlots` per territory. The frontend tests in
[`src/engine/mockEngine.test.ts`](src/engine/mockEngine.test.ts) check this — point them at the real engine.

**Rubric guidance:** implement scoring and allocation as deterministic code (same input → same
output, traceable reasons). Use Gemini for wording (`summary`, explanation text), Q&A, and reading
messy free text — not for the decision itself. Typical rubric inputs: investment capacity vs city tier,
retail experience, space owned/rented/none, size ≥ 400 sq ft, ground floor, launch realism vs space
status, territory priority and remaining slots, PIN availability.

---

## 5 · `GET /api/decisions/:applicationId/explanation` → `Explanation`

```ts
interface Explanation {
  applicationId: string;
  status: DecisionStatus;
  summary: string;
  reasons: Reason[];
  fullReasoning: string[]; // 4–6 bullet lines for "See full reasoning"
  competitors: Array<{
    applicationId: string;
    name: string;
    status: DecisionStatus;
    rank: number | null;
    investmentLakh: number;
  }>; // others in the same territory, best rank first; [] if no territory
}
```

`404` if the ID is unknown.

---

## 6 · `POST /api/ask` → `AskResponse`

Request:
```json
{ "question": "Why is APP-007 on hold?" }
```

Response — keep it **structured**, not paragraphs (badge + up to 3 chips + one sentence):
```ts
interface AskResponse {
  kind: 'decision' | 'territory' | 'whatif' | 'fallback';
  applicationId?: string;  // for decision / whatif
  territoryId?: string;    // for territory
  status?: DecisionStatus; // for decision (current) or whatif (would become)
  reasons: Reason[];       // ≤ 3; most negative first
  sentence: string;        // one short sentence
  ranked?: Array<{ applicationId: string; name: string; status: DecisionStatus }>; // territory answers
  suggestions?: string[];  // fallback: example questions
}
```

Example:
```json
{
  "kind": "decision",
  "applicationId": "APP-007",
  "status": "On hold",
  "reasons": [
    { "id": "APP-007:floor:1", "label": "Upper floor", "sentiment": "hurt", "topic": "floor" },
    { "id": "APP-007:size:1", "label": "350 sq ft, below 400", "sentiment": "hurt", "topic": "size" },
    { "id": "APP-007:territory:1", "label": "TER-02 slots full", "sentiment": "missing", "topic": "territory" }
  ],
  "sentence": "Good partner, but the space is upper floor and under 400 sq ft."
}
```

---

## 7–10 · What-if

### `POST /api/simulate` → `ScenarioResult`

Request (`ScenarioChange` — only the edited fields are sent):
```ts
interface ScenarioChange {
  applicationId: string;
  space?: SpaceAvailable;
  floor?: Floor;
  spaceSqft?: number | null;
  launchMonths?: number;
  investmentLakh?: number;
}
```

Response:
```ts
interface ScenarioResult {
  id: string;            // scenario id; keep it server-side so apply/revert can use it
  change: ScenarioChange;
  canned: boolean;       // true when the decision actually changes (enables "Apply change")
  before: { status: DecisionStatus; reasons: Reason[]; confidence: number };
  after:  { status: DecisionStatus; reasons: Reason[]; confidence: number };
  flipped: string[];     // Reason ids whose label or sentiment changed (highlighted in the diff)
  ripples: Ripple[];     // knock-on effects
  sentence: string;
}

interface Ripple {
  label: string;          // "TER-03 open slots", "APP-021", "PIN 560024"
  before: string;         // "1" | "On hold" | "Interest"
  after: string;          // "0" | "Waitlisted" | "Allocated"
  applicationId?: string; // makes the row clickable
  territoryId?: string;
}
```

Re-score the applicant with the change, re-run allocation for its territory, diff decisions, and
report every other applicant whose status moved as a ripple. Must not persist anything.

### `GET /api/scenarios/presets` → `ScenarioPreset[]`
```ts
interface ScenarioPreset {
  applicationId: string;
  title: string;          // "APP-012 finds a ground-floor space"
  change: ScenarioChange;
}
```
Suggest 3–5 useful what-ifs (e.g. applicants one fix away from approval).

### `POST /api/scenarios/:scenarioId/apply` → `204`
Persist the simulated change (applicant fields + all affected decisions). Afterwards every `GET` above
reflects it. *(The engine method receives the whole `ScenarioResult`; `realEngine` just sends `result.id`.)*

### `POST /api/scenarios/:scenarioId/revert` → `204`
Undo an applied scenario.

---

## 11 · `GET /api/territories/state` → `TerritoryState[]`

```ts
interface TerritoryState {
  territoryId: string;
  openSlots: number;
  filled: number;          // Approved applications in this territory
  applicants: number;      // all applications whose PIN is in the territory
  competingIds: string[];  // application ids ordered by territoryRank
  oversubscribed: boolean; // non-rejected applicants > openSlots
  fillHistory: Array<{ month: string /* "YYYY-MM" */; filled: number }>;
}
```

---

## 12 · `GET /api/pins/state` → `PinState[]`

Every PIN that appears in a territory, a store or an application.

```ts
type PinStatus = 'open' | 'interest' | 'allocated' | 'store' | 'conflict' | 'full' | 'outside';

interface PinState {
  pin: string;
  city: City;
  area: string;            // locality name, e.g. "Marathahalli"
  lat: number;             // locality centroid (see "PIN coordinates" below)
  lng: number;
  territoryId: string | null;
  status: PinStatus;
  storeId: string | null;      // existing store on this PIN
  allocatedTo: string | null;  // Approved applicationId on this PIN
  applicantIds: string[];
  locked: boolean;             // true for 'store' and 'allocated' (one store per PIN)
  note: string | null;         // e.g. "2 applicants, 1 PIN", "No slot left in TER-02"
}
```

Status precedence used by the UI: `store` → `allocated` → `outside` (no territory) → `conflict`
(≥ 2 non-rejected applicants) → `interest` (1 applicant) → `open` (territory has a free slot) →
`full` (territory has no slot left).

---

## 13–14 · Partner portal: profile and chat

### `GET /api/partners/:applicationId/profile` → `PartnerProfile`
```ts
interface PartnerProfile {
  applicationId: string;
  manager: { name: string; role: string; phone: string; email: string; hours: string; languages: string[] };
  economics: {
    investmentLakh: number;
    monthlySalesLakh: number;  // typical for similar stores
    grossMargin: number;       // 0..1
    monthlyCostsLakh: number;  // rent + salaries + utilities
    paybackMonths: number;     // investmentLakh / (sales * margin - costs); use a large number if not positive
    basis: string;             // e.g. "similar Tier 1 stores"
  };
  messages: ChatMessage[];     // oldest first
}

interface ChatMessage {
  id: string;
  from: 'partner' | 'brand';
  text: string;
  at: string; // ISO date-time
}
```
The UI recomputes payback live from these numbers when the partner drags the sales slider, so send
the inputs, not just the result.

### `POST /api/partners/:applicationId/messages` → `ChatMessage`
Request `{ "text": "When will my store open?" }`. Store the partner message, return the brand's reply
(from the manager, or a Gemini-drafted answer). For real two-way chat, add a realtime channel later
(see services); the contract stays the same.

---

## 15–19 · Partner portal: staff training

All five return the full, updated `StaffRoster`.

```ts
type StaffRole = 'Store manager' | 'Optometrist' | 'Sales associate';

interface StaffRoster {
  applicationId: string;
  catalog: StaffModule[];
  passMark: number;        // e.g. 70 (%)
  members: StaffMember[];
}

interface StaffModule {
  id: string;              // "S1"
  title: string;
  hours: number;
  forRoles: StaffRole[];   // auto-assigned to these roles on joining
}

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  language: Language;
  joinedAt: string;        // "YYYY-MM-DD"
  modules: StaffModuleProgress[];
  certifiedAt: string | null; // set when every assigned module is passed
}

interface StaffModuleProgress {
  moduleId: string;
  assignedAt: string;
  progress: number;          // 0..1
  quizScore: number | null;  // % once completed
  completedAt: string | null;
}
```

| Route | Body |
|---|---|
| `GET /api/partners/:applicationId/staff` | — |
| `POST /api/partners/:applicationId/staff` | `{ "name": "Divya N", "role": "Sales associate", "language": "Kannada" }` — auto-assign the role's modules |
| `POST /api/partners/:applicationId/staff/:staffId/modules` | `{ "moduleId": "S5" }` |
| `POST /api/partners/:applicationId/staff/:staffId/modules/:moduleId/complete` | — (or `{ "quizScore": 84 }` from a real quiz) |
| `DELETE /api/partners/:applicationId/staff/:staffId` | — |

Recompute `certifiedAt` after every change: set it when all assigned modules have
`progress = 1` and `quizScore ≥ passMark`; clear it if a new module is assigned.

---

## 20 · `POST /api/reset` → `204`
Demo only: restore the sample data and drop applied scenarios, chats and staff changes.

---

## Wiring it into the frontend

1. Add `VITE_API_URL=http://localhost:8000` to `.env.local` (frontend root).
2. Create `src/engine/realEngine.ts`:

```ts
import type { DecisionEngine } from './types';
import { mockEngine } from './mockEngine';

const API = import.meta.env.VITE_API_URL ?? '';
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });

export const realEngine: DecisionEngine = {
  loadDataset: (src) => {
    if (src === 'sample') return post('/datasets/sample');
    const fd = new FormData();
    fd.append('file', src);
    return post('/datasets', fd);
  },
  getDataset: () => call('/datasets/current'),
  getDecisions: () => call('/decisions'),
  explain: (id) => call(`/decisions/${id}/explanation`),
  ask: (question) => post('/ask', { question }),
  simulate: (change) => post('/simulate', change),
  getScenarioPresets: () => call('/scenarios/presets'),
  applyScenario: (r) => post(`/scenarios/${r.id}/apply`),
  revertScenario: (id) => post(`/scenarios/${id}/revert`),
  getTerritoryState: () => call('/territories/state'),
  getPinStates: () => call('/pins/state'),
  // Partner portal — switch from mockEngine to the API when those routes exist
  getPartnerProfile: (id) => mockEngine.getPartnerProfile(id),
  sendPartnerMessage: (id, text) => mockEngine.sendPartnerMessage(id, text),
  getStaff: (id) => mockEngine.getStaff(id),
  addStaff: (id, s) => mockEngine.addStaff(id, s),
  assignStaffModule: (id, sid, mid) => mockEngine.assignStaffModule(id, sid, mid),
  completeStaffModule: (id, sid, mid) => mockEngine.completeStaffModule(id, sid, mid),
  removeStaff: (id, sid) => mockEngine.removeStaff(id, sid),
  reset: () => post('/reset'),
};
```

3. In `src/engine/index.ts` change `mockEngine` to `realEngine`.
4. Dev without CORS: add to `vite.config.ts` →
   `server: { proxy: { '/api': 'http://localhost:8000' } }` and leave `VITE_API_URL` empty.

---

## External services (apart from Gemini)

| Need | Required? | Options |
|---|---|---|
| PIN → lat/lng (map, distances) | **Yes** | Free: data.gov.in *All India Pincode Directory* (load once into the DB). Live: Google Geocoding, OpenCage, Nominatim. (India Post API gives office names, not coordinates.) |
| Database | Yes | Postgres (Supabase / Neon) |
| Catchment / cannibalisation | No API | Haversine distance on the server; drive-time isochrones later via OpenRouteService or Mapbox |
| Real-time partner ↔ brand chat | For live chat | Supabase Realtime, Firebase, Pusher |
| WhatsApp / SMS / email alerts | Nice to have | WhatsApp: Meta Cloud API or Twilio · SMS (India): MSG91 (DLT registration) · Email: Resend or SendGrid |
| Calls to the relationship manager | Optional | `tel:` links, or Exotel / Knowlarity for tracked calls |
| Partner login | For a real portal | Supabase Auth, Firebase Auth, Clerk (phone OTP via MSG91) |
| Document uploads (KYC, rent agreement) | Optional | S3, Supabase Storage, Cloudinary |
| Staff training videos / quizzes | Optional | Own tables + unlisted YouTube or Mux; or TalentLMS / Moodle API |
| Certificate PDFs | Optional | Server-side generation (pdf-lib, Puppeteer) |
| E-sign agreement / KYC checks | Later | Digio, Leegality, Signzy |
| Brand fee payments | Later | Razorpay |

Map tiles (Esri grey canvas) need no key and are already wired.
