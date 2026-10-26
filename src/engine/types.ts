import { z } from 'zod';

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
  pin: Pin,
  investmentLakh: z.number().nonnegative(),
  experienceYears: z.number().nonnegative(),
  business: z.string(), // may be blank / messy
  space: SpaceAvailable,
  spaceSqft: z.number().positive().nullable(), // blank if no space
  floor: Floor,
  launchMonths: z.number().int().positive(),
  language: Language,
  notes: z.string(),
  /** ISO date the application was received (demo metadata, not in the sheet). */
  submittedAt: z.string(),
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

export const ONBOARDING_STEPS = [
  'Agreement',
  'Space ready',
  'Fit-out',
  'Training',
  'Stock & systems',
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
  startDate: z.string(),
  targetOpen: z.string(),
});
export type OnboardingPlan = z.infer<typeof OnboardingPlan>;

export const DataFlag = z.object({
  field: z.string(),
  label: z.string(), // short, friendly
});
export type DataFlag = z.infer<typeof DataFlag>;

export const Decision = z.object({
  applicationId: z.string(),
  status: DecisionStatus,
  stage: Stage,
  confidence: z.number().min(0).max(1), // visual only
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
export type Decision = z.infer<typeof Decision>;

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
  kind: 'decision' | 'territory' | 'whatif' | 'fallback';
  applicationId?: string;
  territoryId?: string;
  status?: DecisionStatus;
  reasons: Reason[];
  sentence: string;
  /** For territory answers: ranked competitors. */
  ranked?: Array<{ applicationId: string; name: string; status: DecisionStatus }>;
  suggestions?: string[];
}

export interface ScenarioChange {
  applicationId: string;
  space?: SpaceAvailable;
  floor?: Floor;
  spaceSqft?: number | null;
  launchMonths?: number;
  investmentLakh?: number;
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
  canned: boolean;
  before: { status: DecisionStatus; reasons: Reason[]; confidence: number };
  after: { status: DecisionStatus; reasons: Reason[]; confidence: number };
  /** Reason ids whose sentiment changed between before and after. */
  flipped: string[];
  ripples: Ripple[];
  sentence: string;
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
  reset(): Promise<void>;
}
