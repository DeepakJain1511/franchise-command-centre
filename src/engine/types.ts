import { z } from 'zod';
import type { CheckReport } from './checks';
import type { Change } from './followups';
import type { Alert, AppResult, DiffEntry, Override, PipelineResult, TaskStatus } from './model';

/* ------------------------------------------------------------------ */
/* Allowed values (from the judges' template "Allowed values" sheet)  */
/* ------------------------------------------------------------------ */

export const CITIES = [
  'Bengaluru',
  'Mysuru',
  'Mangaluru',
  'Hubballi-Dharwad',
  'Belagavi',
  'Tumakuru',
  'Davanagere',
] as const;
export const City = z.enum(CITIES);
export type City = z.infer<typeof City>;

export const Tier = z.enum(['Tier 1', 'Tier 2', 'Tier 3']);
export type Tier = z.infer<typeof Tier>;

export const SpaceAvailable = z.enum(['Owned', 'Rented', 'Not yet identified']);
export type SpaceAvailable = z.infer<typeof SpaceAvailable>;

export const Floor = z.enum(['Ground', 'Upper', 'Mall unit', 'Not known']);
export type Floor = z.infer<typeof Floor>;

export const Language = z.enum(['Kannada', 'English', 'Hindi']);
export type Language = z.infer<typeof Language>;

export const Priority = z.enum(['High', 'Medium', 'Low']);
export type Priority = z.infer<typeof Priority>;

export const Pin = z.string().regex(/^\d{6}$/, '6-digit PIN');

/* ------------------------------------------------------------------ */
/* Input sheets                                                       */
/* ------------------------------------------------------------------ */

export const Application = z.object({
  id: z.string().regex(/^APP-\d{3}$/),
  name: z.string(),
  city: City,
  state: z.literal('Karnataka'),
  /** As entered — usually 6 digits, but uploads may carry a bad value (flagged, never dropped). */
  pin: z.string(),
  /** Blank cells are null (spec §3.5) and turned into data-quality flags. */
  investmentLakh: z.number().nonnegative().nullable(),
  experienceYears: z.number().nonnegative().nullable(),
  business: z.string(), // may be blank / messy
  space: SpaceAvailable,
  spaceSqft: z.number().nonnegative().nullable(), // blank if no space
  floor: Floor,
  launchMonths: z.number().nonnegative().nullable(),
  language: Language,
  notes: z.string(),
  /** ISO date the application was received (demo metadata, not in the sheet). */
  submittedAt: z.string(),
  /** Original city text when it had to be inferred from the PIN (upload only). */
  cityRaw: z.string().optional(),
});
export type Application = z.infer<typeof Application>;

export const Territory = z.object({
  id: z.string().regex(/^TER-\d{2}$/),
  name: z.string(),
  city: City,
  state: z.literal('Karnataka'),
  pins: z.array(Pin).min(1),
  tier: Tier,
  openSlots: z.number().int().nonnegative(),
  priority: Priority,
});
export type Territory = z.infer<typeof Territory>;

export const Store = z.object({
  id: z.string().regex(/^ST-\d{2}$/),
  city: City,
  pin: Pin,
  openedYear: z.number().int(),
});
export type Store = z.infer<typeof Store>;

export interface Dataset {
  source: 'sample' | 'upload';
  fileName?: string;
  applications: Application[];
  territories: Territory[];
  stores: Store[];
  /** City centre points for state-level map markers. */
  cities: Array<{ city: City; lat: number; lng: number }>;
  loadedAt: string;
}

/* ------------------------------------------------------------------ */
/* Decisions                                                          */
/* ------------------------------------------------------------------ */

export const DECISION_STATUSES = ['Approved', 'On hold', 'Waitlisted', 'Rejected', 'Needs info'] as const;
export const DecisionStatus = z.enum(DECISION_STATUSES);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

/** Where the applicant sits in the journey (kanban columns). */
export const STAGES = ['Applied', 'Screened', 'Approved', 'On hold', 'In onboarding', 'Open'] as const;
export const Stage = z.enum(STAGES);
export type Stage = z.infer<typeof Stage>;

/** Spec §14: Approved → Agreement → Licences → Fit-out → Training → Stock & staff → Soft launch → Open. */
export const ONBOARDING_STEPS = [
  'Agreement',
  'Licences',
  'Fit-out',
  'Training',
  'Stock & staff',
  'Soft launch',
  'Open',
] as const;
export const OnboardingStep = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

/** ✓ helped · ✕ hurt · ! missing / needs checking */
export const Sentiment = z.enum(['helped', 'hurt', 'missing']);
export type Sentiment = z.infer<typeof Sentiment>;

export const ReasonTopic = z.enum([
  'investment',
  'experience',
  'space',
  'floor',
  'size',
  'launch',
  'territory',
  'pin',
  'data',
  'language',
  'background',
]);
export type ReasonTopic = z.infer<typeof ReasonTopic>;

export const Reason = z.object({
  id: z.string(),
  label: z.string(), // ≤ ~5 words
  sentiment: Sentiment,
  topic: ReasonTopic,
});
export type Reason = z.infer<typeof Reason>;

export const NextStep = z.object({
  id: z.string(),
  label: z.string(),
  owner: z.enum(['Partner', 'Expansion team', 'Legal', 'Projects', 'Training']),
  dueDate: z.string(),
  done: z.boolean(),
});
export type NextStep = z.infer<typeof NextStep>;

export const TimelineEvent = z.object({
  date: z.string(),
  label: z.string(),
  kind: z.enum(['received', 'screened', 'decision', 'info', 'onboarding', 'note']),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const OnboardingPlan = z.object({
  current: OnboardingStep,
  steps: z.array(
    z.object({
      step: OnboardingStep,
      targetDate: z.string(),
      state: z.enum(['done', 'active', 'upcoming']),
    }),
  ),
  atRisk: z.boolean(),
  riskNote: z.string().optional(),
  /** Training modules with completion 0..1 (in the partner's preferred language). */
  training: z.array(z.object({ id: z.string(), title: z.string(), week: z.number(), hours: z.number(), progress: z.number().min(0).max(1) })),
  startDate: z.string(),
  targetOpen: z.string(),
});
export type OnboardingPlan = z.infer<typeof OnboardingPlan>;

export const DataFlag = z.object({
  field: z.string(),
  label: z.string(), // short, friendly
});
export type DataFlag = z.infer<typeof DataFlag>;

export const DecisionBase = z.object({
  applicationId: z.string(),
  status: DecisionStatus,
  stage: Stage,
  /** Adjusted score as 0..1 (adjustedPct / 100). */
  confidence: z.number().min(0).max(1),
  summary: z.string(), // one short sentence
  reasons: z.array(Reason).min(3).max(5),
  territoryId: z.string().nullable(),
  /** One-line attention chip, if this applicant needs the team today. */
  attention: z.string().nullable(),
  /** Lower = more urgent. Null when no attention is needed. */
  attentionPriority: z.number().nullable(),
  /** Short bucket for "why people drop at this stage" (funnel drill-in). */
  dropReason: z.string().nullable(),
  nextSteps: z.array(NextStep),
  onboarding: OnboardingPlan.nullable(),
  dataFlags: z.array(DataFlag),
  daysInStage: z.number().int().nonnegative(),
  timeline: z.array(TimelineEvent),
  /** Rank inside its territory among competing applicants (1 = first in line). */
  territoryRank: z.number().int().positive().nullable(),
});
/** UI decision + the full rule trace from the pipeline (outcome code, scores, reasons, plan). */
export type Decision = z.infer<typeof DecisionBase> & { result: AppResult; text: DecisionText };

/** Pre-rendered English text for the company view (partner view renders per language). */
export interface DecisionText {
  outcome: string; // "Hold — slot reserved"
  sub: string | null; // "until 2 Nov" / "#2 in line" / "Redirect to 570011"
  main: string;
  others: string[];
  warnings: string[];
  tips: string[];
  nextSteps: string[];
}

export interface Explanation {
  applicationId: string;
  status: DecisionStatus;
  summary: string;
  reasons: Reason[];
  fullReasoning: string[]; // bullet lines for the "See full reasoning" accordion
  competitors: Array<{ applicationId: string; name: string; status: DecisionStatus; rank: number | null; investmentLakh: number }>;
}

/* ------------------------------------------------------------------ */
/* Territory + PIN state                                              */
/* ------------------------------------------------------------------ */

/** 'full' = PIN is free but its territory has no slot left. */
export const PIN_STATES = ['open', 'interest', 'allocated', 'store', 'conflict', 'full', 'outside'] as const;
export type PinStatus = (typeof PIN_STATES)[number];

export interface PinState {
  pin: string;
  city: City;
  /** Neighbourhood name — demo-approximate. */
  area: string;
  /** Approximate centroid — demo-approximate, not a surveyed boundary. */
  lat: number;
  lng: number;
  territoryId: string | null;
  status: PinStatus;
  storeId: string | null;
  allocatedTo: string | null; // applicationId
  applicantIds: string[];
  locked: boolean;
  /** Short reason for conflict state, e.g. "2 applicants, 1 PIN". */
  note: string | null;
}

export interface TerritoryState {
  territoryId: string;
  openSlots: number;
  filled: number; // approved / planned
  applicants: number;
  competingIds: string[]; // ordered by territoryRank
  oversubscribed: boolean;
  fillHistory: Array<{ month: string; filled: number }>;
}

/* ------------------------------------------------------------------ */
/* Ask + What-if                                                      */
/* ------------------------------------------------------------------ */

export interface AskResponse {
  kind: 'decision' | 'territory' | 'whatif' | 'update' | 'next' | 'compare' | 'summary' | 'fallback';
  applicationId?: string;
  territoryId?: string;
  status?: DecisionStatus;
  reasons: Reason[];
  /** One-line answer (spec §16 answer format: one line → Why → What next). */
  sentence: string;
  why?: string[];
  next?: string[];
  /** For territory answers: ranked competitors. */
  ranked?: Array<{ applicationId: string; name: string; status: DecisionStatus; note?: string }>;
  suggestions?: string[];
  /** Updates: what the parser understood, the assumptions it made, and every applicant that moved. */
  understood?: string;
  assumptions?: string[];
  diff?: DiffEntry[];
  overrideIds?: string[];
  compare?: Array<{ applicationId: string; name: string; status: DecisionStatus; outcome: string; score: number; bar: number; factors: string[] }>;
  counts?: Array<{ label: string; value: number }>;
  /** 'gemini' when Gemini helped parse the message (the decision itself is always rule-based). */
  source?: 'rules' | 'gemini';
}

export interface ScenarioChange {
  applicationId: string;
  space?: SpaceAvailable;
  floor?: Floor;
  spaceSqft?: number | null;
  launchMonths?: number | null;
  investmentLakh?: number | null;
  experienceYears?: number | null;
  pin?: string;
}

export interface ScenarioPreset {
  applicationId: string;
  title: string; // "APP-012 finds a ground-floor space"
  change: ScenarioChange;
}

export interface Ripple {
  label: string; // "TER-03 open slots"
  before: string;
  after: string;
  applicationId?: string;
  territoryId?: string;
}

export interface ScenarioResult {
  id: string;
  change: ScenarioChange;
  /** True when the change moved anything (kept for the sandbox UI). */
  canned: boolean;
  diff: DiffEntry[];
  before: { status: DecisionStatus; reasons: Reason[]; confidence: number };
  after: { status: DecisionStatus; reasons: Reason[]; confidence: number };
  /** Reason ids whose sentiment changed between before and after. */
  flipped: string[];
  ripples: Ripple[];
  sentence: string;
}

/* ------------------------------------------------------------------ */
/* Partner portal                                                     */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  /** 'assistant' = instant answer grounded in the engine; 'brand' = the relationship manager. */
  from: 'partner' | 'brand' | 'assistant';
  text: string;
  at: string; // ISO date-time
  /** Partner messages that look like data updates carry what the parser found, for the brand to apply. */
  detected?: { understood: string; changes: Array<Pick<Change, 'field' | 'value' | 'label'>>; applied: boolean };
}

export interface InboxThread {
  applicationId: string;
  name: string;
  status: DecisionStatus;
  last: ChatMessage | null;
  unread: number;
  pendingUpdate: boolean;
}

export interface PartnerProfile {
  applicationId: string;
  manager: { name: string; role: string; phone: string; email: string; hours: string; languages: string[] };
  /** Illustrative store economics (₹ lakh / month) — an estimate, not a forecast. */
  economics: {
    investmentLakh: number;
    monthlySalesLakh: number;
    grossMargin: number;
    monthlyCostsLakh: number;
    paybackMonths: number;
    basis: string; // e.g. "similar Tier 1 stores"
  };
  messages: ChatMessage[];
}

export const STAFF_ROLES = ['Store manager', 'Optometrist', 'Sales associate'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffModule {
  id: string;
  title: string;
  hours: number;
  /** Roles this module is recommended for (auto-assigned on joining). */
  forRoles: StaffRole[];
}

export interface StaffModuleProgress {
  moduleId: string;
  assignedAt: string;
  progress: number; // 0..1
  quizScore: number | null; // % once completed
  completedAt: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  language: Language;
  joinedAt: string;
  modules: StaffModuleProgress[];
  /** Set when every assigned module is passed (quiz ≥ pass mark). */
  certifiedAt: string | null;
}

export interface StaffRoster {
  applicationId: string;
  catalog: StaffModule[];
  passMark: number;
  members: StaffMember[];
}

/* ------------------------------------------------------------------ */
/* The seam                                                           */
/* ------------------------------------------------------------------ */

export interface DecisionEngine {
  loadDataset(source: 'sample' | File): Promise<Dataset>;
  getDataset(): Promise<Dataset>;
  getDecisions(): Promise<Decision[]>;
  explain(applicationId: string): Promise<Explanation>;
  ask(question: string): Promise<AskResponse>;
  simulate(change: ScenarioChange): Promise<ScenarioResult>;
  /** Suggested what-if scenarios to offer as one-click chips. */
  getScenarioPresets(): Promise<ScenarioPreset[]>;
  /** Commit a simulated scenario so every screen reflects it. */
  applyScenario(result: ScenarioResult): Promise<void>;
  revertScenario(scenarioId: string): Promise<void>;
  getTerritoryState(): Promise<TerritoryState[]>;
  getPinStates(): Promise<PinState[]>;
  /** Partner portal: assigned manager, payback estimate and the message thread. */
  getPartnerProfile(applicationId: string): Promise<PartnerProfile>;
  /** Partner sends a message; resolves with the brand's reply. */
  sendPartnerMessage(applicationId: string, text: string): Promise<ChatMessage>;
  /** Partner's own staff and their training. */
  getStaff(applicationId: string): Promise<StaffRoster>;
  addStaff(applicationId: string, staff: { name: string; role: StaffRole; language: Language }): Promise<StaffRoster>;
  assignStaffModule(applicationId: string, staffId: string, moduleId: string): Promise<StaffRoster>;
  /** Record a module as finished (the demo also produces a quiz score). */
  completeStaffModule(applicationId: string, staffId: string, moduleId: string): Promise<StaffRoster>;
  removeStaff(applicationId: string, staffId: string): Promise<StaffRoster>;
  reset(): Promise<void>;

  /* ---- Spec §15–§16: time, actions, follow-ups, inbox, checks ---- */
  /** Days since the decision date (time slider, 0 → 98). */
  getDay(): number;
  setDay(day: number): Promise<void>;
  getPipeline(): Promise<PipelineResult>;
  getAlerts(): Promise<Alert[]>;
  getOverrides(): Override[];
  /** Apply validated changes as overrides; returns the ids (for Undo) and the diff. */
  applyChanges(changes: Change[], source: Override['source'], reason?: string): Promise<{ overrideIds: string[]; diff: DiffEntry[] }>;
  undoLast(): Promise<DiffEntry[]>;
  removeOverrides(ids: string[]): Promise<DiffEntry[]>;
  resetOverrides(): Promise<void>;
  setTaskStatus(applicationId: string, taskId: string, status: TaskStatus, by: 'partner' | 'company'): Promise<void>;
  extendDeadline(applicationId: string, reason: string): Promise<DiffEntry[]>;
  releaseReservation(applicationId: string, reason: string): Promise<DiffEntry[]>;
  getInbox(): Promise<InboxThread[]>;
  sendBrandMessage(applicationId: string, text: string): Promise<ChatMessage>;
  markThreadRead(applicationId: string): Promise<void>;
  suggestReply(applicationId: string): Promise<{ text: string; source: 'rules' | 'gemini' }>;
  applyDetectedUpdate(applicationId: string, messageId: string): Promise<DiffEntry[]>;
  runChecks(withGemini: boolean): Promise<CheckReport>;
}

export type { Alert, DiffEntry, Override, PipelineResult, TaskStatus, Change, CheckReport };
