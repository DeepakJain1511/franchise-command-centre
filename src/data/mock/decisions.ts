import type {
  DecisionStatus,
  NextStep,
  OnboardingStep,
  ReasonTopic,
  Stage,
  TimelineEvent,
} from '@/engine/types';

/**
 * HARD-CODED DEMO DECISIONS — not computed.
 * PHASE-2: real logic goes here (scoring, ranking, allocation). Every status, reason,
 * confidence and rank below is a fixture chosen to make the demo legible.
 *
 * Reason tuples: [sentiment, label, topic] where '+' helped, '-' hurt, '!' missing / check.
 */
export type ReasonTuple = ['+' | '-' | '!', string, ReasonTopic];
export type StepTuple = [label: string, owner: NextStep['owner'], dueInDays: number, done?: boolean];

export interface DecisionFixture {
  status: DecisionStatus;
  stage: Stage;
  conf: number;
  summary: string;
  reasons: ReasonTuple[];
  attention?: string;
  /** Lower = more urgent in the attention queue. */
  attentionOrder?: number;
  rank: number | null;
  days: number;
  onboarding?: { step: OnboardingStep; start: string; risk?: string };
  next?: StepTuple[];
  extraFlags?: Array<{ field: string; label: string }>;
  extraEvents?: TimelineEvent[];
  /** Ranked "why it drops" bucket used by the funnel drill-in. */
  dropReason?: string;
}

export const decisionFixtures: Record<string, DecisionFixture> = {
  /* ---------------- TER-01 Bengaluru East (3 slots) ---------------- */
  'APP-001': {
    status: 'Approved', stage: 'In onboarding', conf: 0.88, rank: 1, days: 12,
    summary: 'Ready partner with owned ground-floor space in a high-priority territory.',
    reasons: [['+', 'Capacity ₹85 L', 'investment'], ['+', '9 yrs optical retail', 'experience'], ['+', 'Owned ground floor, 650 sq ft', 'space'], ['+', 'High-priority territory', 'territory']],
    onboarding: { step: 'Fit-out', start: '2026-09-14' },
  },
  'APP-002': {
    status: 'Approved', stage: 'In onboarding', conf: 0.82, rank: 2, days: 7,
    summary: 'Strong pharmacy operator; lease length still to confirm.',
    reasons: [['+', 'Ground floor near metro', 'floor'], ['+', '6 yrs pharmacy retail', 'experience'], ['+', 'Capacity ₹60 L', 'investment'], ['!', 'Lease ≥ 5 yrs to confirm', 'space']],
    onboarding: { step: 'Training', start: '2026-08-31' },
  },
  'APP-009': {
    status: 'Approved', stage: 'Open', conf: 0.91, rank: 3, days: 7,
    summary: 'Opened in a Bellandur mall unit — first store of the programme.',
    reasons: [['+', 'Capacity ₹1.2 Cr', 'investment'], ['+', '12 yrs retail ops', 'experience'], ['+', 'Mall unit, 800 sq ft', 'space'], ['+', 'High-priority territory', 'territory']],
    onboarding: { step: 'Open', start: '2026-07-27' },
  },
  'APP-015': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.5, rank: 5, days: 30, dropReason: 'Territory full',
    summary: 'Viable, but TER-01 slots are taken and space is under 400 sq ft.',
    reasons: [['+', 'Ground-floor shop', 'floor'], ['-', '380 sq ft, below 400', 'size'], ['-', 'TER-01 slots full', 'territory']],
  },
  'APP-018': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.4, rank: 6, days: 26, dropReason: 'Territory full',
    summary: 'No space and no business background; TER-01 is already full.',
    reasons: [['-', 'No space identified', 'space'], ['!', 'Business background blank', 'data'], ['-', 'TER-01 slots full', 'territory']],
  },
  'APP-024': {
    status: 'Rejected', stage: 'Screened', conf: 0.95, rank: null, days: 21, dropReason: 'PIN taken',
    summary: 'PIN 560066 already has store ST-04 — one store per PIN.',
    reasons: [['-', 'PIN has store ST-04', 'pin'], ['+', 'Capacity ₹70 L', 'investment'], ['+', 'Owned ground floor, 900 sq ft', 'space']],
    next: [['Send decline note with reason', 'Expansion team', 1], ['Offer 560087 (Varthur) instead', 'Expansion team', 5]],
  },
  'APP-031': {
    status: 'Needs info', stage: 'Applied', conf: 0.25, rank: 7, days: 10, attention: 'Launch date unrealistic', attentionOrder: 9, dropReason: 'Missing info',
    summary: 'Wants to open in 1 month with no space and no retail experience.',
    reasons: [['-', 'No space identified', 'space'], ['-', 'Launch in 1 month', 'launch'], ['-', 'No retail experience', 'experience'], ['!', 'Capacity proof missing', 'investment']],
    next: [['Confirm realistic launch month', 'Partner', 4], ['Share shortlisted spaces', 'Partner', 10], ['Upload bank statement', 'Partner', 7]],
  },
  'APP-037': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.55, rank: 4, days: 6, dropReason: 'PIN taken',
    summary: 'PIN 560037 is allocated to APP-001; next in line for TER-01.',
    reasons: [['-', 'PIN allocated to APP-001', 'pin'], ['+', 'Ground floor, 450 sq ft', 'space'], ['+', '5 yrs electronics retail', 'experience'], ['-', 'TER-01 slots full', 'territory']],
  },

  /* ---------------- TER-02 Bengaluru South (2 slots) ---------------- */
  'APP-005': {
    status: 'Approved', stage: 'In onboarding', conf: 0.92, rank: 1, days: 4,
    summary: 'Experienced optical operator with owned ground floor — top of TER-02.',
    reasons: [['+', '10 yrs optical retail', 'experience'], ['+', 'Capacity ₹95 L', 'investment'], ['+', 'Owned ground floor, 700 sq ft', 'space'], ['+', 'Launch in 2 months', 'launch']],
    onboarding: { step: 'Stock & systems', start: '2026-08-24' },
  },
  'APP-007': {
    status: 'On hold', stage: 'On hold', conf: 0.58, rank: 4, days: 22, attention: 'Upper-floor space', attentionOrder: 2, dropReason: 'Space not suitable',
    summary: 'Good partner, but the space is upper floor and under 400 sq ft.',
    reasons: [['-', 'Upper floor', 'floor'], ['-', '350 sq ft, below 400', 'size'], ['+', '6 yrs retail', 'experience'], ['+', 'Capacity ₹40 L', 'investment'], ['!', 'TER-02 slots full', 'territory']],
    next: [['Find ground-floor space ≥ 400 sq ft', 'Partner', 21], ['Share new site photos', 'Partner', 24], ['Site visit', 'Projects', 30]],
  },
  'APP-010': {
    status: 'Approved', stage: 'Approved', conf: 0.9, rank: 2, days: 3,
    summary: 'Large-format ready; launch in 6 months fits the plan.',
    reasons: [['+', 'Capacity ₹1.5 Cr', 'investment'], ['+', '14 yrs retail', 'experience'], ['+', 'Owned ground floor, 1,200 sq ft', 'space'], ['!', 'Launch in 6 months', 'launch']],
    onboarding: { step: 'Agreement', start: '2026-10-28' },
    next: [['Sign Letter of Intent', 'Partner', 5], ['Submit KYC', 'Partner', 7, true], ['Pay brand fee', 'Partner', 12], ['Site visit', 'Projects', 10]],
  },
  'APP-013': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.5, rank: 7, days: 35, dropReason: 'Territory full',
    summary: 'Small upper-floor boutique; TER-02 is full.',
    reasons: [['-', 'Upper floor', 'floor'], ['-', '300 sq ft, below 400', 'size'], ['-', 'TER-02 slots full', 'territory'], ['+', '4 yrs retail', 'experience']],
  },
  'APP-016': {
    status: 'On hold', stage: 'On hold', conf: 0.5, rank: 5, days: 18, attention: 'Contradictory space info', attentionOrder: 6, dropReason: 'Space not suitable',
    summary: 'Says "ground floor" but has no space identified yet.',
    reasons: [['+', '7 yrs bakery franchise', 'experience'], ['-', 'No space identified', 'space'], ['!', 'Ground floor, but no space', 'data'], ['!', 'Launch in 2 months tight', 'launch']],
    next: [['Confirm the actual site address', 'Partner', 5], ['Share rent agreement draft', 'Partner', 12]],
  },
  'APP-022': {
    status: 'Rejected', stage: 'Screened', conf: 0.8, rank: null, days: 33, dropReason: 'Low capacity',
    summary: 'Capacity and experience too low for a Tier 1 store.',
    reasons: [['-', 'Capacity ₹20 L', 'investment'], ['-', '1 yr experience', 'experience'], ['-', 'No space identified', 'space']],
  },
  'APP-027': {
    status: 'On hold', stage: 'On hold', conf: 0.6, rank: 3, days: 14, attention: 'PIN conflict', attentionOrder: 3, dropReason: 'PIN conflict',
    summary: 'Strong optician, but competes with APP-007 for PIN 560068 and TER-02 is full.',
    reasons: [['+', 'Optician, 4 yrs at a chain', 'experience'], ['+', 'Ground floor, 520 sq ft', 'space'], ['+', 'Capacity ₹75 L', 'investment'], ['-', 'PIN 560068 contested', 'pin'], ['-', 'TER-02 slots full', 'territory']],
    next: [['Decide 560068 between APP-027 / APP-007', 'Expansion team', 3], ['Offer TER-03 slot as alternative', 'Expansion team', 7]],
  },
  'APP-033': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.55, rank: 6, days: 13, dropReason: 'PIN taken',
    summary: 'PIN 560102 is already allocated to APP-005.',
    reasons: [['-', 'PIN allocated to APP-005', 'pin'], ['+', '7 yrs pharmacy', 'experience'], ['+', 'Ground floor, 480 sq ft', 'space']],
  },

  /* ---------------- TER-03 Bengaluru North (2 slots) ---------------- */
  'APP-004': {
    status: 'Approved', stage: 'In onboarding', conf: 0.86, rank: 1, days: 5,
    summary: 'Seasoned supermarket owner with a large owned ground-floor unit.',
    reasons: [['+', '11 yrs retail', 'experience'], ['+', 'Owned ground floor, 900 sq ft', 'space'], ['+', 'Capacity ₹80 L', 'investment']],
    onboarding: { step: 'Agreement', start: '2026-10-19' },
  },
  'APP-012': {
    status: 'On hold', stage: 'On hold', conf: 0.55, rank: 2, days: 25, attention: 'No space yet', attentionOrder: 1, dropReason: 'Space not suitable',
    summary: 'Strong profile; waiting on a confirmed ground-floor space.',
    reasons: [['+', 'Capacity ₹70 L', 'investment'], ['+', '8 yrs optical & watch retail', 'experience'], ['-', 'No space identified', 'space'], ['!', 'Floor not known', 'floor'], ['!', 'Launch in 3 months tight', 'launch']],
    next: [['Identify ground-floor space ≥ 400 sq ft', 'Partner', 14], ['Share site photos + rent quote', 'Partner', 18], ['Site visit', 'Projects', 24]],
  },
  'APP-021': {
    status: 'On hold', stage: 'On hold', conf: 0.54, rank: 3, days: 20, dropReason: 'Space not suitable',
    summary: 'Behind APP-012 for the last TER-03 slot; space is upper floor.',
    reasons: [['+', '420 sq ft', 'size'], ['-', 'Upper floor', 'floor'], ['+', 'Capacity ₹40 L', 'investment'], ['!', 'Waiting on TER-03 slot', 'territory']],
    next: [['Hold until APP-012 confirms space', 'Expansion team', 14]],
  },
  'APP-025': {
    status: 'Needs info', stage: 'Applied', conf: 0.3, rank: 5, days: 27, attention: 'Investment proof missing', attentionOrder: 8, dropReason: 'Missing info',
    summary: 'Family-funded first-timer; capacity proof and space missing.',
    reasons: [['!', 'Investment proof missing', 'investment'], ['-', 'No retail experience', 'experience'], ['-', 'No space identified', 'space']],
    next: [['Upload proof of funds', 'Partner', 7], ['Name the operating partner', 'Partner', 10]],
  },
  'APP-030': {
    status: 'Needs info', stage: 'Applied', conf: 0.45, rank: 4, days: 19, attention: 'Missing space size', attentionOrder: 5, dropReason: 'Missing info',
    summary: 'Large investor, no retail experience; space size not given.',
    reasons: [['+', 'Capacity ₹1.8 Cr', 'investment'], ['-', 'No retail experience', 'experience'], ['!', 'Space size missing', 'size'], ['!', 'Store manager not named', 'data']],
    next: [['Share space size (sq ft)', 'Partner', 5], ['Name store manager', 'Partner', 10]],
  },
  'APP-035': {
    status: 'Rejected', stage: 'Screened', conf: 0.88, rank: null, days: 10, dropReason: 'Space not suitable',
    summary: '120 sq ft upper-floor unit cannot fit the store format.',
    reasons: [['-', '120 sq ft space', 'size'], ['-', 'Upper floor', 'floor'], ['+', '5 yrs telecom retail', 'experience']],
  },

  /* ---------------- TER-04 Mysuru (2 slots) ---------------- */
  'APP-003': {
    status: 'Approved', stage: 'In onboarding', conf: 0.79, rank: 1, days: 21, attention: 'Onboarding slipping', attentionOrder: 4,
    summary: 'Good fit; owned space frees up only from December.',
    reasons: [['+', 'Owned ground floor, 600 sq ft', 'space'], ['+', '7 yrs textile retail', 'experience'], ['+', 'Capacity ₹60 L', 'investment'], ['!', 'Space free only from Dec', 'launch']],
    onboarding: { step: 'Space ready', start: '2026-09-21', risk: 'Space handover slipping to Dec' },
  },
  'APP-008': {
    status: 'Approved', stage: 'Open', conf: 0.9, rank: 2, days: 14,
    summary: 'Open and trading in Hootagalli since mid-October.',
    reasons: [['+', 'Ground floor, 550 sq ft', 'space'], ['+', '9 yrs retail & banking', 'experience'], ['+', 'Capacity ₹75 L', 'investment']],
    onboarding: { step: 'Open', start: '2026-07-20' },
  },
  'APP-014': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.52, rank: 4, days: 31, dropReason: 'Territory full',
    summary: 'Qualifies, but both Mysuru slots are taken.',
    reasons: [['+', 'Ground floor, 400 sq ft', 'space'], ['+', 'Capacity ₹40 L', 'investment'], ['-', 'TER-04 slots full', 'territory']],
  },
  'APP-019': {
    status: 'Needs info', stage: 'Applied', conf: 0.45, rank: 5, days: 9, attention: 'Missing space size', attentionOrder: 7, dropReason: 'Missing info',
    summary: 'Owns a ground-floor shop but did not give its size.',
    reasons: [['+', 'Owned ground floor', 'space'], ['!', 'Space size missing', 'size'], ['+', '6 yrs mobile retail', 'experience'], ['!', 'Launch in 2 months', 'launch']],
    next: [['Share space size (sq ft)', 'Partner', 3], ['Share building photos', 'Partner', 5]],
  },
  'APP-023': {
    status: 'Rejected', stage: 'Screened', conf: 0.93, rank: null, days: 30, dropReason: 'PIN taken',
    summary: 'PIN 570017 already has store ST-07 — one store per PIN.',
    reasons: [['-', 'PIN has store ST-07', 'pin'], ['+', '5 yrs boutique', 'experience'], ['+', 'Ground floor, 480 sq ft', 'space']],
    next: [['Send decline note with reason', 'Expansion team', 1], ['Suggest 570023 (JP Nagar) instead', 'Expansion team', 5]],
  },
  'APP-029': {
    status: 'Needs info', stage: 'Applied', conf: 0.3, rank: 6, days: 18, attention: 'Possible duplicate', attentionOrder: 10, dropReason: 'Missing info',
    summary: 'Looks like a repeat of APP-003 (Ravi Kumar Gowda).',
    reasons: [['!', 'Possible duplicate of APP-003', 'data'], ['-', 'Upper floor', 'floor'], ['!', 'Business details thin', 'data']],
    extraFlags: [{ field: 'name', label: 'Possible duplicate of APP-003' }],
    next: [['Call to confirm identity', 'Expansion team', 2]],
  },
  'APP-034': {
    status: 'On hold', stage: 'On hold', conf: 0.6, rank: 3, days: 12, dropReason: 'Space not suitable',
    summary: 'Strong capacity; landlord NOC pending and Mysuru slots full.',
    reasons: [['+', 'Capacity ₹90 L', 'investment'], ['+', 'Ground floor, 480 sq ft', 'space'], ['!', 'Landlord NOC pending', 'space'], ['-', 'TER-04 slots full', 'territory']],
    next: [['Upload landlord NOC', 'Partner', 10]],
  },

  /* ---------------- TER-05 Mangaluru (1 slot) ---------------- */
  'APP-006': {
    status: 'Approved', stage: 'Approved', conf: 0.84, rank: 1, days: 2,
    summary: 'Corner ground-floor unit takes the only Mangaluru slot.',
    reasons: [['+', 'Corner ground floor, 750 sq ft', 'space'], ['+', 'Capacity ₹70 L', 'investment'], ['+', '8 yrs retail', 'experience'], ['+', 'Only slot in TER-05', 'territory']],
    onboarding: { step: 'Agreement', start: '2026-10-27' },
    next: [['Sign Letter of Intent', 'Partner', 4], ['Submit KYC', 'Partner', 6], ['Pay brand fee', 'Partner', 12]],
  },
  'APP-017': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.6, rank: 2, days: 28, dropReason: 'Territory full',
    summary: 'Good optical background; Mangaluru has a single slot, taken.',
    reasons: [['+', '6 yrs optical retail', 'experience'], ['+', 'Ground floor, 450 sq ft', 'space'], ['-', 'TER-05 slot taken', 'territory']],
  },
  'APP-028': {
    status: 'On hold', stage: 'On hold', conf: 0.55, rank: 3, days: 16, dropReason: 'Space not suitable',
    summary: 'Mall unit asks for a 9-year lock-in; slot already taken.',
    reasons: [['+', 'Mall unit, 500 sq ft', 'space'], ['!', '9-yr mall lock-in', 'space'], ['+', 'Capacity ₹40 L', 'investment'], ['-', 'TER-05 slot taken', 'territory']],
  },

  /* ---------------- TER-06 Hubballi-Dharwad (2 slots) ---------------- */
  'APP-011': {
    status: 'Approved', stage: 'In onboarding', conf: 0.83, rank: 1, days: 9,
    summary: 'Established local trader with owned ground floor.',
    reasons: [['+', '10 yrs retail', 'experience'], ['+', 'Owned ground floor, 650 sq ft', 'space'], ['+', 'High-priority territory', 'territory']],
    onboarding: { step: 'Training', start: '2026-09-07' },
  },
  'APP-020': {
    status: 'On hold', stage: 'On hold', conf: 0.38, rank: 3, days: 15, attention: 'Launch date unrealistic', attentionOrder: 4.5, dropReason: 'Space not suitable',
    summary: 'Wants to open in 1 month but has not found a space.',
    reasons: [['-', 'No space identified', 'space'], ['-', 'Launch in 1 month', 'launch'], ['+', 'Kannada training ready', 'language'], ['!', 'Ground floor, but no space', 'data']],
    next: [['Agree a realistic launch month', 'Expansion team', 3], ['Shortlist 2 ground-floor spaces', 'Partner', 21]],
  },
  'APP-026': {
    status: 'On hold', stage: 'On hold', conf: 0.5, rank: 2, days: 23, dropReason: 'Space not suitable',
    summary: 'Open slot available, but the space is upper floor.',
    reasons: [['-', 'Upper floor', 'floor'], ['+', '5 yrs wholesale', 'experience'], ['+', 'Capacity ₹45 L', 'investment'], ['+', 'Open slot in TER-06', 'territory']],
    next: [['Find ground-floor space ≥ 400 sq ft', 'Partner', 21]],
  },
  'APP-036': {
    status: 'Needs info', stage: 'Applied', conf: 0.2, rank: 4, days: 7, attention: 'Incomplete application', attentionOrder: 11, dropReason: 'Missing info',
    summary: 'Application mostly blank — only "pls call" in notes.',
    reasons: [['!', 'Business background blank', 'data'], ['-', 'No space identified', 'space'], ['!', 'Floor not known', 'floor']],
    next: [['Call applicant to complete form', 'Expansion team', 2]],
  },

  /* ---------------- TER-08 Tumakuru (2 slots) ---------------- */
  'APP-038': {
    status: 'Approved', stage: 'In onboarding', conf: 0.78, rank: 1, days: 3,
    summary: 'Owned frontage on BH Road; capacity fits a Tier 3 store.',
    reasons: [['+', 'Owned ground floor, 600 sq ft', 'space'], ['+', '6 yrs retail', 'experience'], ['+', '₹40 L fits Tier 3', 'investment']],
    onboarding: { step: 'Agreement', start: '2026-10-23' },
  },

  /* ---------------- Outside any territory ---------------- */
  'APP-032': {
    status: 'Waitlisted', stage: 'Screened', conf: 0.5, rank: null, days: 14, dropReason: 'Outside territory',
    summary: 'PIN 590019 is outside every growth territory.',
    reasons: [['!', 'PIN outside territories', 'territory'], ['+', 'Ground floor, 500 sq ft', 'space'], ['+', 'Capacity ₹50 L', 'investment']],
    next: [['Offer TER-07 PIN (590006)', 'Expansion team', 7]],
  },
  'APP-039': {
    status: 'Rejected', stage: 'Screened', conf: 0.9, rank: null, days: 4, dropReason: 'Low capacity',
    summary: 'Capacity too low and Davanagere has no territory yet.',
    reasons: [['-', 'Capacity ₹10 L', 'investment'], ['-', 'PIN outside territories', 'territory'], ['-', 'No space identified', 'space']],
  },
  'APP-040': {
    status: 'Needs info', stage: 'Applied', conf: 0.3, rank: null, days: 2, attention: 'Contradictory launch date', attentionOrder: 12, dropReason: 'Missing info',
    summary: 'Notes say "before Diwali" but form says 9 months.',
    reasons: [['!', 'Notes contradict launch', 'data'], ['-', '250 sq ft upper floor', 'size'], ['!', 'PIN outside territories', 'territory']],
    extraFlags: [{ field: 'notes', label: 'Notes contradict launch months' }],
    next: [['Confirm launch timing', 'Partner', 4]],
  },
};

/** Who owns each onboarding step (for next-step checklists). */
export const STEP_OWNER: Record<OnboardingStep, NextStep['owner']> = {
  Agreement: 'Legal',
  'Space ready': 'Partner',
  'Fit-out': 'Projects',
  Training: 'Training',
  'Stock & systems': 'Expansion team',
  'Soft launch': 'Expansion team',
  Open: 'Expansion team',
};

/** Days from onboarding start to each step's target date. */
export const STEP_OFFSETS: Record<OnboardingStep, number> = {
  Agreement: 0,
  'Space ready': 14,
  'Fit-out': 35,
  Training: 49,
  'Stock & systems': 63,
  'Soft launch': 77,
  Open: 84,
};

/** Training modules (fixture). Completion depends on onboarding step. */
export const TRAINING_MODULES = [
  { id: 'M1', title: 'Brand & product basics', week: 1, hours: 4 },
  { id: 'M2', title: 'Eye test & frame fitting', week: 1, hours: 6 },
  { id: 'M3', title: 'POS & inventory system', week: 2, hours: 3 },
  { id: 'M4', title: 'Store ops & hygiene', week: 2, hours: 2 },
  { id: 'M5', title: 'Customer service', week: 3, hours: 3 },
  { id: 'M6', title: 'Soft-launch playbook', week: 3, hours: 2 },
] as const;
