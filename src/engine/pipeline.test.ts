/** Acceptance scenarios 1–35 and the worked numbers from Build Spec §18. */
import { describe, expect, it } from 'vitest';
import { stores as STORES } from '@/data/mock/stores';
import { computeFlags } from './flags';
import type { AppResult, BaseData, Override } from './model';
import { runPipeline } from './pipeline';
import { scoreApplication } from './score';
import type { Application, Territory } from './types';

const D0 = '2026-10-26';

const mk = (o: Partial<Application> & { id: string }): Application => ({
  name: o.id, city: 'Mysuru', state: 'Karnataka', pin: '570050', investmentLakh: 25, experienceYears: 4, business: 'Runs a footwear store',
  space: 'Rented', spaceSqft: 450, floor: 'Ground', launchMonths: 4, language: 'Kannada', notes: '', submittedAt: '2026-10-01', ...o,
});
const ter = (o: Partial<Territory> & { id: string }): Territory => ({
  name: o.id, city: 'Mysuru', state: 'Karnataka', pins: ['570050', '570090'], tier: 'Tier 2', openSlots: 1, priority: 'Medium', ...o,
});
const run = (apps: Application[], terrs: Territory[], opts: { overrides?: Override[]; today?: string } = {}) => {
  const base: BaseData = { applications: apps, territories: terrs, stores: STORES, parseWarnings: [] };
  return runPipeline(base, opts.overrides ?? [], { decisionDate: D0, today: opts.today ?? D0 });
};
const get = (res: ReturnType<typeof run>, id: string): AppResult => res.results.find((r) => r.id === id)!;
const score = (a: Application) => scoreApplication(a, computeFlags(a, D0)).card;

describe('worked numbers', () => {
  it('Ravi — Mysuru 93 fit, −10 for 570009 → 83', () => {
    const a = mk({ id: 'APP-001', pin: '570001', investmentLakh: 25, experienceYears: 4, business: 'Runs a footwear store', spaceSqft: 450, launchMonths: 3 });
    const res = run([a], [ter({ id: 'TER-01', pins: ['570001', '570002'] })]);
    const r = get(res, 'APP-001');
    expect(r.score.factors.money.points).toBe(30);
    expect(r.score.factors.space.points).toBe(22);
    expect(r.score.factors.experience.points).toBe(16);
    expect(r.score.factors.background.points).toBe(15);
    expect(r.score.factors.timeline.points).toBe(10);
    expect(r.score.fitScore).toBe(93);
    expect(r.penalty).toMatchObject({ penalty: 10, nearestPin: '570009' });
    expect(r.adjustedScore).toBe(83);
  });
});

describe('acceptance scenarios', () => {
  it('1 — complete strong applicant gets approved with an onboarding plan', () => {
    const r = get(run([mk({ id: 'APP-001' })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('APPROVE');
    expect(r.mainReason.code).toBe('R_WON_SLOT');
    expect(r.onboarding?.preview).toBe(false);
    expect(r.onboarding?.tasks.length).toBeGreaterThan(5);
  });

  it('2 — same pin: higher score wins; strong loser is redirected, weaker loser waitlisted (PIN_TAKEN)', () => {
    const t = ter({ id: 'TER-01', openSlots: 2 });
    const strong = run([mk({ id: 'APP-001' }), mk({ id: 'APP-002', experienceYears: 2 })], [t]);
    expect(get(strong, 'APP-001').outcome).toBe('APPROVE');
    expect(get(strong, 'APP-002').outcome).toBe('REDIRECT_RESERVED');
    expect(get(strong, 'APP-002').slotPin).toBe('570090');
    // Weaker loser: 30 + 18 + 4 + 3 + 10 = 65 — above the bar (60) but below the strong line (70).
    const weakApp = mk({ id: 'APP-002', floor: 'Upper', experienceYears: 0, business: 'job' });
    expect(score(weakApp).fitScore).toBe(65);
    const weak = run([mk({ id: 'APP-001' }), weakApp], [t]);
    expect(get(weak, 'APP-002').outcome).toBe('WAITLIST');
    expect(get(weak, 'APP-002').waitlistType).toBe('PIN_TAKEN');
  });

  it('3 — pin with an existing store, score < 70 → reject', () => {
    const r = get(run([mk({ id: 'APP-001', city: 'Bengaluru', pin: '560001', investmentLakh: 30, business: 'job' })], [ter({ id: 'TER-01', city: 'Bengaluru', tier: 'Tier 1', pins: ['560001', '560200'] })]), 'APP-001');
    expect(r.outcome).toBe('REJECT');
    expect(r.mainReason.code).toBe('R_PIN_HAS_STORE');
  });

  it('4 — pin with an existing store, score ≥ 70 → redirect to the nearest free same-city pin, or hold if none', () => {
    const app = mk({ id: 'APP-001', city: 'Bengaluru', pin: '560001', investmentLakh: 40, spaceSqft: 300, experienceYears: 5 });
    const t = ter({ id: 'TER-01', city: 'Bengaluru', tier: 'Tier 1', pins: ['560001', '560100', '560200'] });
    const r = get(run([app], [t]), 'APP-001');
    expect(r.outcome).toBe('REDIRECT_RESERVED');
    expect(r.slotPin).toBe('560100');
    const none = get(run([app], [{ ...t, openSlots: 0 }]), 'APP-001');
    expect(none.outcome).toBe('HOLD');
    expect(none.mainReason.code).toBe('R_STRONG_NO_SLOT');
  });

  it('5 — outside all territories, score ≥ 70 → redirect or hold', () => {
    const r = get(run([mk({ id: 'APP-001', pin: '570150' })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('REDIRECT_RESERVED');
    expect(r.mainReason.params.why).toBe('outside');
  });

  it('6 — outside all territories, score < 70 → reject and record as a future lead', () => {
    const r = get(run([mk({ id: 'APP-001', pin: '570150', investmentLakh: 18, experienceYears: 0, business: '' })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('REJECT');
    expect(r.mainReason.code).toBe('R_OUTSIDE_TERRITORY');
    expect(r.futureLead).toBe(true);
  });

  it('7 — more qualified applicants than slots → top N approved, rest waitlisted with positions', () => {
    const t = ter({ id: 'TER-01', pins: ['570050', '570090', '570130', '570170'], openSlots: 2 });
    const res = run(
      [
        mk({ id: 'APP-001', pin: '570050', experienceYears: 6 }),
        mk({ id: 'APP-002', pin: '570090', experienceYears: 5 }),
        mk({ id: 'APP-003', pin: '570130', experienceYears: 3 }),
        mk({ id: 'APP-004', pin: '570170', experienceYears: 2 }),
      ],
      [t],
    );
    expect(get(res, 'APP-001').outcome).toBe('APPROVE');
    expect(get(res, 'APP-002').outcome).toBe('APPROVE');
    expect(get(res, 'APP-003')).toMatchObject({ outcome: 'WAITLIST', waitlistType: 'QUALIFIED', queuePosition: 1 });
    expect(get(res, 'APP-004')).toMatchObject({ outcome: 'WAITLIST', waitlistType: 'QUALIFIED', queuePosition: 2 });
    expect(get(res, 'APP-003').mainReason.code).toBe('R_SLOTS_FULL');
  });

  // Outsider 82 = 30 + 22 + 12 + 8 + 10. Local 78 = 30 + 18 + 12 + 8 + 10.
  const outsider82 = mk({ id: 'APP-002', pin: '570150', experienceYears: 2, business: 'Restaurant owner' });
  it('8 — outsider 82 vs local 78 → local wins (gap 4 < 15)', () => {
    const local = mk({ id: 'APP-001', floor: 'Upper', experienceYears: 2, business: 'Restaurant owner' });
    expect(score(outsider82).fitScore).toBe(82);
    expect(score(local).fitScore).toBe(78);
    const res = run([local, outsider82], [ter({ id: 'TER-01' })]);
    expect(get(res, 'APP-001').outcome).toBe('APPROVE');
    expect(get(res, 'APP-002').outcome).toBe('HOLD');
    expect(get(res, 'APP-002').mainReason.code).toBe('R_STRONG_NO_SLOT');
  });

  it('9 — outsider 82 vs local 55 (below bar 60) → local below bar before allocation; outsider gets the slot', () => {
    const local = mk({ id: 'APP-001', investmentLakh: 20, floor: 'Upper', experienceYears: 0, business: 'Restaurant owner' });
    expect(score(local).fitScore).toBe(55);
    const res = run([local, outsider82], [ter({ id: 'TER-01' })]);
    expect(get(res, 'APP-001')).toMatchObject({ outcome: 'WAITLIST', waitlistType: 'BELOW_BAR' });
    expect(get(res, 'APP-002').outcome).toBe('REDIRECT_RESERVED');
  });

  it('10 — outsider 85 vs local 65 → outsider wins (gap 20 ≥ 15); local waitlisted with R_LOST_GAP_RULE', () => {
    const out85 = mk({ id: 'APP-002', pin: '570150', space: 'Owned', experienceYears: 2, business: 'Restaurant owner' });
    const local65 = mk({ id: 'APP-001', floor: 'Upper', experienceYears: 0, business: 'job' });
    expect(score(out85).fitScore).toBe(85);
    expect(score(local65).fitScore).toBe(65);
    const res = run([local65, out85], [ter({ id: 'TER-01' })]);
    expect(get(res, 'APP-002').outcome).toBe('REDIRECT_RESERVED');
    expect(get(res, 'APP-001').outcome).toBe('WAITLIST');
    expect(get(res, 'APP-001').mainReason.code).toBe('R_LOST_GAP_RULE');
    expect(get(res, 'APP-001').mainReason.params.gap).toBe(20);
  });

  it('11 — local below bar with a slot still empty → not approved, slot stays open', () => {
    const res = run([mk({ id: 'APP-001', investmentLakh: 20, floor: 'Upper', experienceYears: 0, business: 'Restaurant owner' })], [ter({ id: 'TER-01' })]);
    expect(get(res, 'APP-001').outcome).toBe('WAITLIST');
    expect(res.territories[0].remaining).toBe(1);
  });

  it('12 — same score 58 in High vs Low priority territories', () => {
    const a = mk({ id: 'APP-001', pin: '570050', investmentLakh: 20, floor: 'Upper', experienceYears: 2, business: 'job' });
    const b = mk({ id: 'APP-002', pin: '570090', investmentLakh: 20, floor: 'Upper', experienceYears: 2, business: 'job' });
    expect(score(a).fitScore).toBe(58);
    const res = run([a, b], [ter({ id: 'TER-01', pins: ['570050'], priority: 'High' }), ter({ id: 'TER-02', pins: ['570090'], priority: 'Low' })]);
    expect(get(res, 'APP-001').outcome).toBe('APPROVE');
    expect(get(res, 'APP-002')).toMatchObject({ outcome: 'WAITLIST', waitlistType: 'BELOW_BAR', bar: 65 });
  });

  it('13 — no space, rest ≥ bar, would win → HOLD_RESERVED for 30 days', () => {
    const r = get(run([mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: null, floor: 'Not known', experienceYears: 5 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('HOLD_RESERVED');
    expect(r.reservation).toMatchObject({ kind: 'SPACE', deadline: '2026-11-25' });
  });

  it('14 — no space, rest < bar → reject (R_FLAGGED_WEAK)', () => {
    const r = get(run([mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: null, floor: 'Not known', investmentLakh: 18, experienceYears: 0, business: '', launchMonths: 1 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('REJECT');
    expect(r.mainReason.code).toBe('R_FLAGGED_WEAK');
  });

  it('15 — space below the tier minimum (Tier 1, 150 sq ft), rest strong → space 0, HOLD_RESERVED 30 days', () => {
    const r = get(run([mk({ id: 'APP-001', city: 'Bengaluru', pin: '560200', investmentLakh: 45, spaceSqft: 150, experienceYears: 5 })], [ter({ id: 'TER-01', city: 'Bengaluru', tier: 'Tier 1', pins: ['560200'] })]), 'APP-001');
    expect(r.score.factors.space).toMatchObject({ points: 0, excluded: true });
    expect(r.flags.map((f) => f.code)).toContain('F_SPACE_TOO_SMALL');
    expect(r.outcome).toBe('HOLD_RESERVED');
    expect(r.reservation?.kind).toBe('SPACE');
  });

  it('16 — Tumakuru ₹12L, 180 sq ft, 1 yr, kirana, 1 month, Medium → 38/75 = 51% → reject', () => {
    const a = mk({ id: 'APP-001', city: 'Tumakuru', pin: '572101', investmentLakh: 12, spaceSqft: 180, experienceYears: 1, business: 'Kirana store', launchMonths: 1 });
    const r = get(run([a], [ter({ id: 'TER-01', city: 'Tumakuru', tier: 'Tier 3', pins: ['572101'] })]), 'APP-001');
    expect(r.score.factors.money.points).toBe(15);
    expect(r.score.factors.experience.points).toBe(8);
    expect(r.score.factors.background.points).toBe(15);
    expect(r.score.factors.timeline.points).toBe(0);
    expect(r.score.fitScore).toBe(38);
    expect(r.score.assessableMax).toBe(75);
    expect(Math.round(r.score.qualityPct)).toBe(51);
    expect(r.mainReason.code).toBe('R_FLAGGED_WEAK');
  });

  it('17 — size blank with Owned space → hold 7 days (reserved because it would win)', () => {
    const r = get(run([mk({ id: 'APP-001', space: 'Owned', spaceSqft: null })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('HOLD_RESERVED');
    expect(r.reservation).toMatchObject({ kind: 'INFO', deadline: '2026-11-02' });
    const floor = get(run([mk({ id: 'APP-001', floor: 'Not known' })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(floor.flags.map((f) => f.code)).toContain('F_FLOOR_UNKNOWN');
    expect(floor.outcome).toBe('HOLD_RESERVED');
  });

  it('18 — pin prefix does not match city → hold 7 days, no factor excluded', () => {
    const r = get(run([mk({ id: 'APP-001', city: 'Mysuru', pin: '560200' })], [ter({ id: 'TER-01', city: 'Bengaluru', tier: 'Tier 1', pins: ['560200'] })]), 'APP-001');
    expect(r.flags.map((f) => f.code)).toContain('F_PIN_CITY_MISMATCH');
    expect(r.score.assessableMax).toBe(100);
    expect(r.outcome).toBe('HOLD_RESERVED');
    expect(r.reservation?.kind).toBe('INFO');
  });

  it('19 — investment below 70% of the tier minimum → reject with reapply amount', () => {
    const r = get(run([mk({ id: 'APP-001', investmentLakh: 15 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('REJECT');
    expect(r.mainReason).toMatchObject({ code: 'R_MONEY_BELOW_FLOOR', params: { inv: 15, min: 25, floor: 17.5 } });
  });

  it('20 — investment 90–100% of the minimum → 22/30, payback warning, funding-proof task', () => {
    const r = get(run([mk({ id: 'APP-001', investmentLakh: 23 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.score.factors.money.points).toBe(22);
    expect(r.warnings.map((w) => w.code)).toContain('W_PAYBACK_RISK');
    expect(r.onboarding?.tasks.map((t) => t.code)).toContain('TASK_FUNDING_PROOF');
  });

  it('21 — investment at or above the minimum → 30/30 (no extra for more)', () => {
    expect(score(mk({ id: 'APP-001', investmentLakh: 25 })).factors.money.points).toBe(30);
    expect(score(mk({ id: 'APP-001', investmentLakh: 200 })).factors.money.points).toBe(30);
  });

  it('22 — upper floor → floor 3/7; approved → local marketing module + signage task', () => {
    const a = mk({ id: 'APP-001', floor: 'Upper' });
    expect(score(a).factors.space.points).toBe(7 + 8 + 3);
    const r = get(run([a], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('APPROVE');
    expect(r.onboarding?.modules.map((m) => m.code)).toContain('MOD_LOCAL_MARKETING');
    expect(r.onboarding?.tasks.map((t) => t.code)).toContain('TASK_SIGNAGE');
  });

  it('23 — target launch 1 month with space → timeline 0, unrealistic warning, plan uses the earliest date', () => {
    const r = get(run([mk({ id: 'APP-001', launchMonths: 1 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.score.factors.timeline.points).toBe(0);
    expect(r.warnings.find((w) => w.code === 'W_UNREALISTIC_TIMELINE')?.params.n).toBe(3);
    expect(r.onboarding?.openingNote).toBe('EARLIEST_ONLY');
    expect(r.onboarding?.openingWeeks).toBe(12);
  });

  it('24 — pin 1–10 from an existing same-city store → −10, warning, local marketing module', () => {
    const r = get(run([mk({ id: 'APP-001', pin: '570012' })], [ter({ id: 'TER-01', pins: ['570012'] })]), 'APP-001');
    expect(r.penalty.penalty).toBe(10);
    expect(r.warnings.map((w) => w.code)).toContain('W_NEARBY_STORE_VERY_CLOSE');
    expect(r.onboarding?.modules.map((m) => m.code)).toContain('MOD_LOCAL_MARKETING');
  });

  it('25 — two approvals in one run with pins 5 apart → the second gets −10', () => {
    const res = run([mk({ id: 'APP-001', pin: '570050', experienceYears: 6 }), mk({ id: 'APP-002', pin: '570055' })], [ter({ id: 'TER-01', pins: ['570050', '570055'], openSlots: 2 })]);
    expect(get(res, 'APP-001').penalty.penalty).toBe(0);
    expect(get(res, 'APP-002').penalty).toMatchObject({ penalty: 10, nearestPin: '570050' });
    expect(get(res, 'APP-002').outcome).toBe('APPROVE');
  });

  it('26 — 0 years experience → 4/20; approved → extended training', () => {
    const r = get(run([mk({ id: 'APP-001', experienceYears: 0 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.score.factors.experience.points).toBe(4);
    expect(r.onboarding).toMatchObject({ track: 'extended', trainingWeeks: 6, firstTimeOwner: true });
  });

  it('27 — Tumakuru / Davanagere approvals → buddy store ST-01 / ST-09', () => {
    const tum = get(run([mk({ id: 'APP-001', city: 'Tumakuru', pin: '572101', investmentLakh: 15, spaceSqft: 400 })], [ter({ id: 'TER-01', city: 'Tumakuru', tier: 'Tier 3', pins: ['572101'] })]), 'APP-001');
    expect(tum.onboarding?.buddyStoreId).toBe('ST-01');
    const dav = get(run([mk({ id: 'APP-001', city: 'Davanagere', pin: '577001', investmentLakh: 15, spaceSqft: 400 })], [ter({ id: 'TER-01', city: 'Davanagere', tier: 'Tier 3', pins: ['577001'] })]), 'APP-001');
    expect(dav.onboarding?.buddyStoreId).toBe('ST-09');
  });

  it('28 — "Not yet identified" but size filled → treated as no space + F_SPACE_CONTRADICTION', () => {
    const r = get(run([mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: 400 })], [ter({ id: 'TER-01' })]), 'APP-001');
    const codes = r.flags.map((f) => f.code);
    expect(codes).toContain('F_NO_SPACE');
    expect(codes).toContain('F_SPACE_CONTRADICTION');
    expect(r.score.factors.space.excluded).toBe(true);
  });

  it('29 — notes "I own a shop" with no space → human review; decision unchanged', () => {
    const base = mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: null, floor: 'Not known' });
    const plain = get(run([base], [ter({ id: 'TER-01' })]), 'APP-001');
    const noted = get(run([{ ...base, notes: 'I own a shop on the main road' }], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(noted.flags.map((f) => f.code)).toContain('F_NOTES_CONTRADICTION');
    expect(noted.humanReview).toBe(true);
    expect(noted.outcome).toBe(plain.outcome);
    expect(noted.adjustedScore).toBe(plain.adjustedScore);
  });

  it('30 — notes "open before Diwali" → timeline check says whether it is achievable', () => {
    const r = get(run([mk({ id: 'APP-001', notes: 'Wants to open before Diwali' })], [ter({ id: 'TER-01' })]), 'APP-001');
    const w = r.warnings.find((x) => x.code === 'W_NOTES_DATE');
    expect(w?.params).toMatchObject({ label: 'Diwali', met: 0 });
    expect(r.onboarding?.occasion).toMatchObject({ label: 'Diwali', met: false });
  });

  it('31 — blank experience / blank launch → 4 pts / 6 pts with info flags', () => {
    const r = get(run([mk({ id: 'APP-001', experienceYears: null, launchMonths: null })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.score.factors.experience.points).toBe(4);
    expect(r.score.factors.timeline.points).toBe(6);
    const codes = r.flags.map((f) => f.code);
    expect(codes).toContain('F_EXP_MISSING');
    expect(codes).toContain('F_LAUNCH_MISSING');
    expect(r.blocking).toBe(false);
  });

  it('32 — exact score tie → investment ratio, then experience, then lower ID', () => {
    const t = ter({ id: 'TER-01', pins: ['570050', '570090'] });
    // Same 30-point money band, but APP-002 has a bigger buffer.
    const byMoney = run([mk({ id: 'APP-001', pin: '570050', investmentLakh: 26 }), mk({ id: 'APP-002', pin: '570090', investmentLakh: 40 })], [t]);
    expect(get(byMoney, 'APP-002').outcome).toBe('APPROVE');
    // Same band, same money: 4.5 vs 4 years.
    const byExp = run([mk({ id: 'APP-001', pin: '570050', experienceYears: 4 }), mk({ id: 'APP-002', pin: '570090', experienceYears: 4.5 })], [t]);
    expect(get(byExp, 'APP-002').outcome).toBe('APPROVE');
    const byId = run([mk({ id: 'APP-002', pin: '570090' }), mk({ id: 'APP-001', pin: '570050' })], [t]);
    expect(get(byId, 'APP-001').outcome).toBe('APPROVE');
  });

  it('33 — 2+ strong applicants outside territories with pins within 10 → demand signal', () => {
    const res = run([mk({ id: 'APP-001', pin: '570150' }), mk({ id: 'APP-002', pin: '570155' })], [ter({ id: 'TER-01', openSlots: 0 })]);
    expect(res.alerts.some((a) => a.kind === 'DEMAND_SIGNAL')).toBe(true);
  });

  it('34 — mall unit approval → +2 weeks to fit-out and opening, mall approval task', () => {
    const r = get(run([mk({ id: 'APP-001', floor: 'Mall unit', launchMonths: 3 })], [ter({ id: 'TER-01' })]), 'APP-001');
    expect(r.outcome).toBe('APPROVE');
    expect(r.onboarding?.earliestOpeningWeeks).toBe(14);
    expect(r.onboarding?.stages.find((s) => s.stage === 'Fit-out')?.endWeek).toBe(10);
    expect(r.onboarding?.tasks.map((t) => t.code)).toContain('TASK_MALL_APPROVAL');
  });

  it('35 — reservation deadline passed (time slider) → slot goes to the next in queue', () => {
    // A: no space, fit 75 (ranks first) → HOLD_RESERVED 30 days. B: complete, fit 70 → queue #1.
    const a = mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: null, floor: 'Not known', experienceYears: 5 });
    const b = mk({ id: 'APP-002', floor: 'Upper', experienceYears: 0, business: 'Restaurant owner' });
    const t = ter({ id: 'TER-01', pins: ['570050', '570090'] });
    const day0 = run([a, { ...b, pin: '570090' }], [t]);
    expect(get(day0, 'APP-001').outcome).toBe('HOLD_RESERVED');
    expect(get(day0, 'APP-002')).toMatchObject({ outcome: 'WAITLIST', queuePosition: 1 });
    const day31 = run([a, { ...b, pin: '570090' }], [t], { today: '2026-11-26' });
    expect(get(day31, 'APP-001')).toMatchObject({ outcome: 'WAITLIST', holdType: 'LAPSED' });
    expect(get(day31, 'APP-002').outcome).toBe('APPROVE');
    expect(get(day31, 'APP-002').onboarding?.startDate).toBe('2026-11-26');
  });
});

describe('follow-up overrides', () => {
  const ov = (targetId: string, field: Override['field'], value: Override['value']): Override => ({
    id: `o-${field}`, target: 'app', targetId, field, value, timestamp: '', effectiveDate: D0, source: 'form', label: '',
  });
  it('vague "found a ground-floor space" → assume Rented, size unknown → 7-day hold', () => {
    const a = mk({ id: 'APP-001', space: 'Not yet identified', spaceSqft: null, floor: 'Not known' });
    const res = run([a], [ter({ id: 'TER-01' })], { overrides: [ov('APP-001', 'space', 'Rented'), ov('APP-001', 'floor', 'Ground')] });
    expect(get(res, 'APP-001').flags.map((f) => f.code)).toContain('F_SIZE_MISSING');
    expect(get(res, 'APP-001').reservation?.kind).toBe('INFO');
  });
  it('withdrawal frees the slot for the next in line', () => {
    const t = ter({ id: 'TER-01', pins: ['570050', '570090'] });
    const res = run([mk({ id: 'APP-001', experienceYears: 6 }), mk({ id: 'APP-002', pin: '570090' })], [t], { overrides: [ov('APP-001', 'withdrawn', true)] });
    expect(get(res, 'APP-001').outcome).toBe('WITHDRAWN');
    expect(get(res, 'APP-002').outcome).toBe('APPROVE');
  });
  it('is deterministic and never mutates the base data', () => {
    const apps = [mk({ id: 'APP-001' }), mk({ id: 'APP-002', pin: '570090' })];
    const snapshot = JSON.stringify(apps);
    const a = run(apps, [ter({ id: 'TER-01' })], { overrides: [ov('APP-002', 'investmentLakh', 60)] });
    const b = run(apps, [ter({ id: 'TER-01' })], { overrides: [ov('APP-002', 'investmentLakh', 60)] });
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
    expect(JSON.stringify(apps)).toBe(snapshot);
  });
});
