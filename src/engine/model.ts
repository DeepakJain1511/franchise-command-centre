/**
 * Types for the pure decision pipeline (Build Spec §5–§16).
 * `runPipeline(baseData, overrides, options) → PipelineResult` has no UI code and no side effects.
 */
import type { FactorKey, PriorityKey, TierNum } from '@/config';
import type { Application, City, Floor, Language, SpaceAvailable, Store, Territory } from './types';

export interface BaseData {
  applications: Application[];
  territories: Territory[];
  stores: Store[];
  /** Parse-time notes for the company view (duplicate pins, skipped rows, guessed values). */
  parseWarnings: string[];
}

/* ---------------- Overrides (follow-ups, §16) ---------------- */

export type AppField =
  | 'space' | 'spaceSqft' | 'floor' | 'pin' | 'city' | 'investmentLakh' | 'experienceYears' | 'launchMonths'
  | 'language' | 'business' | 'notes'
  | 'locationConfirmed' // clears F_PIN_CITY_MISMATCH
  | 'redirect' // 'accepted' | 'declined'
  | 'deadline' // 'met' | 'missed' | 'extend'
  | 'withdrawn' // true
  | 'release' // company releases a reservation → slot to next in queue
  | 'task'; // value = { taskId, status }

export type TerritoryField = 'openSlots' | 'priority';

export type OverrideValue = string | number | boolean | null | { taskId: string; status: TaskStatus; reason?: string };

export interface Override {
  id: string;
  target: 'app' | 'territory';
  targetId: string;
  field: AppField | TerritoryField;
  value: OverrideValue;
  /** Free-text reason (e.g. deadline extension) — shown in the timeline. */
  reason?: string;
  timestamp: string;
  /** Demo "today" (time slider) when the change was made — drives approval / lapse dates. */
  effectiveDate: string;
  source: 'ask' | 'form' | 'partner' | 'company' | 'sandbox';
  /** Human summary, e.g. "APP-012: floor → Ground". */
  label: string;
}

export interface PipelineOptions {
  /** Decision date (Day 0). ISO yyyy-mm-dd. */
  decisionDate: string;
  /** Demo "today" (time slider). ISO yyyy-mm-dd, ≥ decisionDate. */
  today: string;
}

/* ---------------- Flags (§6) ---------------- */

export type FlagCode =
  | 'F_PIN_CITY_MISMATCH' | 'F_INVEST_MISSING' | 'F_SIZE_MISSING' | 'F_FLOOR_UNKNOWN' | 'F_NO_SPACE' | 'F_SPACE_TOO_SMALL'
  | 'F_SPACE_CONTRADICTION' | 'F_EXP_MISSING' | 'F_LAUNCH_MISSING' | 'F_NOTES_CONTRADICTION' | 'F_NOTES_DATE'
  | 'F_BACKGROUND_UNCLEAR';

export interface Flag {
  code: FlagCode;
  blocking: boolean;
  holdDays: number | null;
  excludes: FactorKey | null;
  params: Record<string, string | number>;
}

/* ---------------- Scores (§7) ---------------- */

export type WarningCode =
  | 'W_PAYBACK_RISK' | 'W_TIGHT_TIMELINE' | 'W_UNREALISTIC_TIMELINE' | 'W_NEARBY_STORE_VERY_CLOSE' | 'W_NEARBY_STORE'
  | 'W_NOTES_REVIEW' | 'W_NOTES_DATE' | 'W_BACKGROUND_UNCLEAR';

export interface Warning {
  code: WarningCode;
  params: Record<string, string | number>;
}

export type SizeBand = 'tooSmall' | 'slightlySmall' | 'ideal' | 'larger' | null;
export type BackgroundCategory = 'retail' | 'otherBusiness' | 'unclear';

export interface FactorScore {
  key: FactorKey;
  points: number;
  max: number;
  excluded: boolean;
  /** Short machine-readable note, e.g. "ratio 0.92", "ideal", "Upper". */
  detail: string;
}

export interface ScoreCard {
  tier: TierNum;
  tierMin: number;
  investmentRatio: number | null;
  factors: Record<FactorKey, FactorScore>;
  fitScore: number;
  assessableMax: number;
  qualityPct: number;
  backgroundCategory: BackgroundCategory;
  sizeBand: SizeBand;
  usableSpace: boolean;
  realisticMinMonths: number;
  warnings: Warning[];
}

export interface PenaltyInfo {
  penalty: number;
  blocked: boolean;
  nearestPin: string | null;
  nearestStoreId: string | null;
  diff: number | null;
}

/* ---------------- Outcomes (§11) ---------------- */

export type OutcomeCode = 'APPROVE' | 'HOLD_RESERVED' | 'REDIRECT_RESERVED' | 'HOLD' | 'WAITLIST' | 'REJECT' | 'WITHDRAWN';
export type WaitlistType = 'QUALIFIED' | 'BELOW_BAR' | 'PIN_TAKEN';
export type HoldType = 'INFO' | 'SPACE' | 'STRONG_WAITING' | 'REDIRECT' | 'LAPSED';

export type ReasonCode =
  | 'R_WON_SLOT' | 'R_HOLD_FIX' | 'R_HOLD_NO_RESERVATION' | 'R_REDIRECT_OFFERED' | 'R_STRONG_NO_SLOT' | 'R_SLOTS_FULL'
  | 'R_LOST_GAP_RULE' | 'R_BELOW_BAR' | 'R_PIN_TAKEN' | 'R_OUTSIDE_TERRITORY' | 'R_PIN_HAS_STORE' | 'R_MONEY_BELOW_FLOOR'
  | 'R_LOW_SCORE' | 'R_FLAGGED_WEAK' | 'R_WITHDRAWN' | 'R_RESERVATION_LAPSED' | 'R_REDIRECT_DECLINED' | 'R_NEARBY_STORE_LOWERED';

export interface ReasonRef {
  code: ReasonCode;
  params: Record<string, string | number>;
}

export interface Tip {
  factor: FactorKey;
  points: number;
  /** i18n key + params, rendered per language. */
  code: 'TIP_GROUND_FLOOR' | 'TIP_INVEST' | 'TIP_SIZE' | 'TIP_SPACE' | 'TIP_EXPERIENCE' | 'TIP_BACKGROUND' | 'TIP_TIMELINE' | 'TIP_OWN';
  params: Record<string, string | number>;
}

export interface Reservation {
  kind: 'INFO' | 'SPACE' | 'REDIRECT';
  pin: string;
  territoryId: string;
  awardedOn: string;
  deadline: string;
  /** Redirect milestones (days from award). */
  milestones?: Array<{ key: 'accept' | 'space' | 'verify'; due: string; done: boolean }>;
  extendedDays: number;
}

/* ---------------- Onboarding (§13) ---------------- */

export type TaskStatus = 'Not started' | 'Done — awaiting check' | 'Verified';
export type StageKey = 'Agreement' | 'Licences' | 'Fit-out' | 'Training' | 'Stock & staff' | 'Soft launch' | 'Open';

export interface PlanTask {
  id: string;
  /** i18n key, e.g. TASK_SIGN_AGREEMENT. */
  code: string;
  stage: StageKey;
  dueWeek: number;
  dueDate: string;
  status: TaskStatus;
  overdueDays: number;
}

export type TrainingTrack = 'extended' | 'standard' | 'fast';
export type Health = 'On track' | 'At risk' | 'Delayed';

export interface OnboardingDetail {
  preview: boolean; // true for reserved (not yet approved)
  startDate: string;
  offsetWeeks: number; // redirect / space search shift before base tasks
  mall: boolean;
  earliestOpeningWeeks: number;
  targetWeeks: number | null;
  openingWeeks: number;
  openingDate: string;
  bufferWeeks: number;
  openingNote: 'TARGET_MET' | 'EARLIEST_ONLY' | 'TARGET_BLANK';
  occasion: { label: string; phrase: string; date: string; met: boolean } | null;
  stages: Array<{ stage: StageKey; startWeek: number; endWeek: number; startDate: string; endDate: string }>;
  tasks: PlanTask[];
  track: TrainingTrack;
  trainingWeeks: number;
  trainingStartWeek: number;
  modules: Array<{ code: string; week: number; extra: boolean }>;
  firstTimeOwner: boolean;
  language: Language;
  buddyStoreId: string;
  health: Health;
  healthReason: string | null;
  tasksDonePct: number;
}

/* ---------------- Final result per applicant ---------------- */

export interface AppResult {
  id: string;
  app: Application;
  tier: TierNum;
  territoryId: string | null;
  /** Approval bar for the applicant's territory (or the strong line when the location fails). */
  bar: number;
  priority: PriorityKey | null;
  flags: Flag[];
  blocking: boolean;
  holdDays: number | null;
  score: ScoreCard;
  penalty: PenaltyInfo;
  adjustedScore: number;
  adjustedPct: number;
  outcome: OutcomeCode;
  waitlistType: WaitlistType | null;
  holdType: HoldType | null;
  mainReason: ReasonRef;
  otherReasons: ReasonRef[];
  warnings: Warning[];
  tips: Tip[];
  /** Pin the slot is held for (own pin, or redirect pin). */
  slotPin: string | null;
  slotTerritoryId: string | null;
  slotRank: number | null;
  /** Position in the territory's queue for released slots. */
  queuePosition: number | null;
  competitors: string[];
  /** Rule that decided the slot, for explanations. */
  decidedBy: string | null;
  reservation: Reservation | null;
  onboarding: OnboardingDetail | null;
  futureLead: boolean;
  /** True when notes need a human to read them (company view). */
  humanReview: boolean;
}

export interface TerritoryResult {
  id: string;
  city: City;
  priority: PriorityKey;
  openSlots: number;
  approved: string[];
  reserved: string[];
  remaining: number;
  queue: string[];
  belowBar: string[];
  pinsClaimed: string[];
  applicants: string[];
}

export interface Alert {
  kind: 'RESERVATION_EXPIRING' | 'TASK_OVERDUE' | 'TASK_AWAITING' | 'NOTES_REVIEW' | 'DEMAND_SIGNAL' | 'DUPLICATE_PIN' | 'PARSE';
  applicationId?: string;
  territoryId?: string;
  pin?: string;
  text: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PipelineResult {
  results: AppResult[];
  territories: TerritoryResult[];
  alerts: Alert[];
  options: PipelineOptions;
  /** The effective inputs after overrides (for display and diffing). */
  applications: Application[];
  territoryInputs: Territory[];
  stores: Store[];
}

/* ---------------- Diff ---------------- */

export interface DiffEntry {
  id: string;
  name: string;
  changes: Array<{ what: 'outcome' | 'score' | 'slot' | 'queue'; before: string; after: string }>;
  reason: string;
}

export type { City, Floor, Language, SpaceAvailable };
