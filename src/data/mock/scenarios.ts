import type { Application, Ripple, ScenarioChange } from '@/engine/types';
import type { DecisionFixture } from './decisions';

/**
 * CANNED WHAT-IF OUTCOMES — not computed.
 * PHASE-2: real logic goes here (re-score the applicant, re-run allocation, compute ripples).
 */
export interface CannedScenario {
  key: string;
  applicationId: string;
  title: string;
  /** Preset field values used by the "suggested" chips. */
  preset: Omit<ScenarioChange, 'applicationId'>;
  matches: (c: ScenarioChange, app: Application) => boolean;
  appPatch: (c: ScenarioChange) => Partial<Application>;
  after: Partial<DecisionFixture> & Pick<DecisionFixture, 'status' | 'stage' | 'conf' | 'summary' | 'reasons'>;
  effects: Array<{ applicationId: string; fixture: Partial<DecisionFixture> }>;
  ripples: Ripple[];
  sentence: string;
}

const eff = (c: ScenarioChange, app: Application) => ({
  space: c.space ?? app.space,
  floor: c.floor ?? app.floor,
  size: c.spaceSqft === undefined ? app.spaceSqft : c.spaceSqft,
});

const patch = (c: ScenarioChange): Partial<Application> => {
  const p: Partial<Application> = {};
  if (c.space) p.space = c.space;
  if (c.floor) p.floor = c.floor;
  if (c.spaceSqft !== undefined) p.spaceSqft = c.spaceSqft;
  if (c.launchMonths !== undefined) p.launchMonths = c.launchMonths;
  if (c.investmentLakh !== undefined) p.investmentLakh = c.investmentLakh;
  return p;
};

export const cannedScenarios: CannedScenario[] = [
  {
    key: 'app012-ground',
    applicationId: 'APP-012',
    title: 'APP-012 finds a ground-floor space',
    preset: { space: 'Rented', floor: 'Ground', spaceSqft: 450 },
    matches: (c, app) => {
      const e = eff(c, app);
      return e.floor === 'Ground' && e.space !== 'Not yet identified' && (e.size ?? 0) >= 400;
    },
    appPatch: patch,
    after: {
      status: 'Approved', stage: 'Approved', conf: 0.84, attention: undefined, attentionOrder: undefined,
      summary: 'Ground-floor space secured — takes the last TER-03 slot.',
      reasons: [['+', 'Capacity ₹70 L', 'investment'], ['+', '8 yrs optical & watch retail', 'experience'], ['+', 'Ground-floor space secured', 'space'], ['+', 'Ground floor', 'floor'], ['+', 'Launch in 3 months feasible', 'launch']],
      onboarding: { step: 'Agreement', start: '2026-10-30' },
      next: [['Sign Letter of Intent', 'Partner', 5], ['Submit KYC', 'Partner', 7], ['Site visit', 'Projects', 9]],
    },
    effects: [
      {
        applicationId: 'APP-021',
        fixture: {
          status: 'Waitlisted', stage: 'Screened', conf: 0.5, days: 0,
          summary: 'TER-03 filled by APP-012; moved to the waitlist.',
          reasons: [['+', '420 sq ft', 'size'], ['-', 'Upper floor', 'floor'], ['+', 'Capacity ₹40 L', 'investment'], ['-', 'TER-03 slots full', 'territory']],
          next: [['Notify of waitlist + offer TER-06', 'Expansion team', 2]],
        },
      },
    ],
    ripples: [
      { label: 'TER-03 open slots', before: '1', after: '0', territoryId: 'TER-03' },
      { label: 'APP-021', before: 'On hold', after: 'Waitlisted', applicationId: 'APP-021' },
      { label: 'PIN 560024', before: 'Interest', after: 'Allocated' },
    ],
    sentence: 'Space now meets the format, so APP-012 takes the last TER-03 slot and APP-021 moves to the waitlist.',
  },
  {
    key: 'app007-ground',
    applicationId: 'APP-007',
    title: 'APP-007 moves to a ground-floor unit',
    preset: { space: 'Rented', floor: 'Ground', spaceSqft: 450 },
    matches: (c, app) => {
      const e = eff(c, app);
      return e.floor === 'Ground' && (e.size ?? 0) >= 400;
    },
    appPatch: patch,
    after: {
      status: 'Waitlisted', stage: 'Screened', conf: 0.66, attention: undefined, attentionOrder: undefined, rank: 3,
      summary: 'Space now qualifies, but TER-02 is full — first on the waitlist.',
      reasons: [['+', 'Ground floor', 'floor'], ['+', 'Size meets 400 sq ft', 'size'], ['+', '6 yrs retail', 'experience'], ['+', 'Capacity ₹40 L', 'investment'], ['-', 'TER-02 slots full', 'territory']],
      next: [['Notify: first on TER-02 waitlist', 'Expansion team', 2]],
    },
    effects: [],
    ripples: [
      { label: 'TER-02 waitlist position', before: '#4', after: '#1' },
      { label: 'TER-02 open slots', before: '0', after: '0', territoryId: 'TER-02' },
    ],
    sentence: 'Better space flips two reasons, but TER-02 has no slot left, so APP-007 waits at the front of the queue.',
  },
  {
    key: 'app026-ground',
    applicationId: 'APP-026',
    title: 'APP-026 switches to ground floor',
    preset: { floor: 'Ground', spaceSqft: 450 },
    matches: (c, app) => eff(c, app).floor === 'Ground',
    appPatch: patch,
    after: {
      status: 'Approved', stage: 'Approved', conf: 0.8,
      summary: 'Ground-floor space fills the open TER-06 slot.',
      reasons: [['+', 'Ground floor', 'floor'], ['+', '5 yrs wholesale', 'experience'], ['+', 'Capacity ₹45 L', 'investment'], ['+', 'Open slot in TER-06', 'territory']],
      onboarding: { step: 'Agreement', start: '2026-10-30' },
      next: [['Sign Letter of Intent', 'Partner', 5], ['Submit KYC', 'Partner', 7]],
    },
    effects: [
      {
        applicationId: 'APP-020',
        fixture: {
          status: 'Waitlisted', stage: 'Screened', conf: 0.35, days: 0,
          summary: 'TER-06 now full; no space yet — moved to the waitlist.',
          reasons: [['-', 'No space identified', 'space'], ['-', 'Launch in 1 month', 'launch'], ['+', 'Kannada training ready', 'language'], ['-', 'TER-06 slots full', 'territory']],
        },
      },
    ],
    ripples: [
      { label: 'TER-06 open slots', before: '1', after: '0', territoryId: 'TER-06' },
      { label: 'APP-020', before: 'On hold', after: 'Waitlisted', applicationId: 'APP-020' },
      { label: 'PIN 580001', before: 'Interest', after: 'Allocated' },
    ],
    sentence: 'Upper floor was the only blocker, so APP-026 takes the open TER-06 slot; APP-020 drops to the waitlist.',
  },
  {
    key: 'app019-size',
    applicationId: 'APP-019',
    title: 'APP-019 shares its space size',
    preset: { spaceSqft: 520 },
    matches: (c) => c.spaceSqft != null && c.spaceSqft >= 400,
    appPatch: patch,
    after: {
      status: 'Waitlisted', stage: 'Screened', conf: 0.62, attention: undefined, attentionOrder: undefined,
      summary: 'Data now complete and space qualifies, but Mysuru slots are full.',
      reasons: [['+', 'Owned ground floor', 'space'], ['+', 'Size confirmed', 'size'], ['+', '6 yrs mobile retail', 'experience'], ['-', 'TER-04 slots full', 'territory']],
    },
    effects: [],
    ripples: [{ label: 'Needs-info queue', before: '7', after: '6' }],
    sentence: 'Missing size is resolved; the application is complete but waits for a Mysuru slot.',
  },
];
