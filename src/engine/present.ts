/**
 * AppResult (spec engine) → Decision (UI). Pure presentation: status colours, reason chips, next steps,
 * onboarding stepper, attention chips and timeline. No rule decisions are made here.
 */
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { FACTOR_MAX, TRAINING_WEEKS, type FactorKey } from '@/config';
import { t, type Lang } from '@/i18n';
import { outcomeLabel } from './diff';
import { renderReason, renderTip, renderWarning } from './explain';
import type { AppResult, Override, StageKey } from './model';
import { currentStage, isStoreOpen } from './onboarding';
import {
  ONBOARDING_STEPS, type DataFlag, type Decision, type DecisionStatus, type DecisionText, type NextStep, type OnboardingPlan, type Reason,
  type ReasonTopic, type Sentiment, type Stage, type TimelineEvent,
} from './types';

const fmt = (iso: string) => format(parseISO(iso), 'd MMM');
const days = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

/* ---------------- Status + stage ---------------- */

export function statusOf(r: AppResult): DecisionStatus {
  switch (r.outcome) {
    case 'APPROVE':
      return 'Approved';
    case 'WAITLIST':
      return 'Waitlisted';
    case 'REJECT':
    case 'WITHDRAWN':
      return 'Rejected';
    case 'HOLD_RESERVED':
    case 'HOLD':
      // 7-day info holds wait on the applicant's details → "Needs info". Space / strong / lapsed holds → "On hold".
      return r.holdType === 'INFO' ? 'Needs info' : 'On hold';
    case 'REDIRECT_RESERVED':
      return 'On hold';
  }
}

export function stageOf(r: AppResult): Stage {
  const s = statusOf(r);
  if (s === 'Rejected' || s === 'Waitlisted') return 'Screened';
  if (s === 'On hold' || s === 'Needs info') return 'On hold';
  if (!r.onboarding) return 'Approved';
  if (isStoreOpen(r.onboarding)) return 'Open';
  return currentStage(r.onboarding) === 'Approved' ? 'Approved' : 'In onboarding';
}

/* ---------------- Reason chips (≤ 5 words) ---------------- */

const SPACE_FLAG_LABEL: Record<string, [string, Sentiment]> = {
  F_NO_SPACE: ['No space yet', 'missing'],
  F_SPACE_TOO_SMALL: ['Space below minimum', 'hurt'],
  F_SIZE_MISSING: ['Space size not given', 'missing'],
  F_FLOOR_UNKNOWN: ['Floor not known', 'missing'],
};

export function chipsOf(r: AppResult): Reason[] {
  const seen: Record<string, number> = {};
  const mk = (label: string, sentiment: Sentiment, topic: ReasonTopic, weight: number) => {
    const n = (seen[topic] = (seen[topic] ?? 0) + 1);
    return { reason: { id: `${r.id}:${topic}:${n}`, label, sentiment, topic }, weight };
  };
  const loc: Array<ReturnType<typeof mk>> = [];
  const code = r.mainReason.code;
  const terr = r.slotTerritoryId ?? r.territoryId ?? '';
  if (r.outcome === 'APPROVE') loc.push(mk(`Won slot · ${terr}`, 'helped', 'territory', 100));
  else if (r.outcome === 'HOLD_RESERVED' && r.reservation) loc.push(mk(`Slot held till ${fmt(r.reservation.deadline)}`, 'missing', 'territory', 100));
  else if (r.outcome === 'REDIRECT_RESERVED') loc.push(mk(`Redirect to ${r.slotPin}`, 'helped', 'pin', 100));
  else if (r.outcome === 'WITHDRAWN') loc.push(mk('Withdrawn', 'hurt', 'data', 100));
  else if (code === 'R_OUTSIDE_TERRITORY') loc.push(mk('Outside our territories', 'hurt', 'territory', 100));
  else if (code === 'R_PIN_HAS_STORE') loc.push(mk('Store already at PIN', 'hurt', 'pin', 100));
  else if (code === 'R_MONEY_BELOW_FLOOR') loc.push(mk('Below money floor', 'hurt', 'investment', 100));
  else if (code === 'R_PIN_TAKEN' || r.waitlistType === 'PIN_TAKEN') loc.push(mk('PIN taken by higher score', 'hurt', 'pin', 100));
  else if (r.waitlistType === 'QUALIFIED') loc.push(mk(`#${r.queuePosition ?? '?'} in line · ${terr}`, 'hurt', 'territory', 100));
  else if (r.waitlistType === 'BELOW_BAR') loc.push(mk(`Below ${r.bar} bar`, 'hurt', 'territory', 100));
  else if (r.holdType === 'STRONG_WAITING') loc.push(mk('No free slot nearby', 'hurt', 'territory', 100));
  else if (r.holdType === 'LAPSED') loc.push(mk('Reservation lapsed', 'hurt', 'territory', 100));
  else if (code === 'R_LOW_SCORE') loc.push(mk(`Score ${Math.round(r.adjustedPct)} < 45`, 'hurt', 'data', 100));

  const f = r.score.factors;
  const lost = (k: FactorKey) => FACTOR_MAX[k] - f[k].points;
  const factors: Array<ReturnType<typeof mk>> = [];
  // Money
  if (f.money.excluded) factors.push(mk('Investment not given', 'missing', 'investment', 30));
  else if (code !== 'R_MONEY_BELOW_FLOOR') {
    factors.push(f.money.points === 30 ? mk(`Investment ${f.money.points}/30`, 'helped', 'investment', 30) : mk(`Investment below ₹${r.score.tierMin}L`, 'hurt', 'investment', lost('money')));
  }
  // Space
  const spaceFlag = r.flags.find((x) => SPACE_FLAG_LABEL[x.code]);
  if (spaceFlag) {
    const [label, s] = SPACE_FLAG_LABEL[spaceFlag.code];
    factors.push(mk(label, s, 'space', 25));
  } else if (f.space.points >= 22) factors.push(mk(`Space ${f.space.points}/25`, 'helped', 'space', f.space.points));
  else factors.push(mk(r.app.floor === 'Upper' ? 'Upper-floor space' : `Space ${f.space.points}/25`, 'hurt', r.app.floor === 'Upper' ? 'floor' : 'size', lost('space')));
  // Experience
  const yrs = r.app.experienceYears;
  if (yrs === null) factors.push(mk('Experience not given', 'missing', 'experience', 16));
  else if (f.experience.points >= 16) factors.push(mk(`${yrs} yrs retail`, 'helped', 'experience', f.experience.points));
  else factors.push(mk(yrs === 0 ? 'First-time store owner' : `Only ${yrs} yr${yrs === 1 ? '' : 's'} retail`, 'hurt', 'experience', lost('experience')));
  // Background
  const bg = r.score.backgroundCategory;
  factors.push(bg === 'retail' ? mk('Retail background', 'helped', 'background', 15) : bg === 'otherBusiness' ? mk('Business background', 'helped', 'background', 8) : mk('Background unclear', 'missing', 'background', 12));
  // Timeline
  const tl = f.timeline.points;
  if (r.app.launchMonths === null) factors.push(mk('Launch date blank', 'missing', 'launch', 4));
  else if (tl === 10) factors.push(mk('Launch plan realistic', 'helped', 'launch', 10));
  else factors.push(mk(tl === 6 ? 'Launch over 9 months' : 'Launch too soon', 'hurt', 'launch', lost('timeline')));
  // Cannibalisation
  if (r.penalty.penalty > 0) factors.push(mk(`Store nearby −${r.penalty.penalty}`, 'hurt', 'pin', r.penalty.penalty));

  const order = (x: ReturnType<typeof mk>) => (x.reason.sentiment === 'helped' ? 1 : 0);
  const sorted = [...factors].sort((a, b) => order(a) - order(b) || b.weight - a.weight);
  // Always ≥ 4 factor chips, so 3–5 chips in total.
  return [...loc, ...sorted].slice(0, 5).map((x) => x.reason);
}

/* ---------------- Text ---------------- */

const FLAG_SHORT = (code: string) => t('en', `FS_${code.replace(/^F_/, '')}`);

export function subOf(r: AppResult): string | null {
  switch (r.outcome) {
    case 'APPROVE':
      return r.onboarding ? `Opens ${fmt(r.onboarding.openingDate)} · ${r.onboarding.health}` : null;
    case 'HOLD_RESERVED':
      return r.reservation ? `Slot reserved until ${fmt(r.reservation.deadline)}` : null;
    case 'REDIRECT_RESERVED':
      return r.reservation ? `PIN ${r.slotPin} reserved until ${fmt(r.reservation.deadline)}` : null;
    case 'WAITLIST':
      if (r.waitlistType === 'QUALIFIED') return `#${r.queuePosition ?? '?'} in line`;
      if (r.waitlistType === 'BELOW_BAR') return `Score ${Math.round(r.adjustedPct)} vs bar ${r.bar}`;
      if (r.waitlistType === 'PIN_TAKEN') return `PIN ${r.app.pin} taken`;
      return r.holdType === 'LAPSED' ? 'Reservation lapsed' : null;
    case 'HOLD':
      if (r.holdType === 'STRONG_WAITING') return r.queuePosition ? `Strong · #${r.queuePosition} for next slot` : 'Strong · waiting for a slot';
      if (r.holdType === 'LAPSED') return 'Reservation lapsed';
      return `Needs: ${r.flags.filter((x) => x.blocking).map((x) => FLAG_SHORT(x.code).toLowerCase()).join(', ')}`;
    case 'REJECT':
      return r.futureLead ? 'Future-territory lead' : null;
    case 'WITHDRAWN':
      return null;
  }
}

function gapDateOf(r: AppResult) {
  const ref = [r.mainReason, ...r.otherReasons].find((x) => x.code === 'R_LOST_GAP_RULE');
  return ref ? String(ref.params.date ?? '') || null : null;
}

export function nextStepTexts(r: AppResult, lang: Lang): Array<{ label: string; owner: NextStep['owner']; due: string | null; done: boolean; id: string }> {
  const steps: Array<{ label: string; owner: NextStep['owner']; due: string | null; done: boolean; id: string }> = [];
  const fixes = r.flags.filter((f) => f.blocking);
  switch (r.outcome) {
    case 'APPROVE':
      r.onboarding?.tasks.filter((x) => x.status !== 'Verified').slice(0, 4).forEach((x) =>
        steps.push({ id: x.id, label: t(lang, x.code), owner: x.code === 'TASK_REDIRECT_VERIFY' ? 'Expansion team' : 'Partner', due: x.dueDate, done: x.status !== 'Not started' }),
      );
      break;
    case 'HOLD_RESERVED':
    case 'HOLD':
      fixes.forEach((f, i) => steps.push({ id: `${r.id}-fix${i}`, label: t(lang, f.code, f.params), owner: 'Partner', due: r.reservation?.deadline ?? null, done: false }));
      if (r.holdType === 'STRONG_WAITING') steps.push({ id: `${r.id}-wait`, label: 'Wait — offered the nearest pin when a slot opens', owner: 'Expansion team', due: null, done: false });
      if (r.holdType === 'LAPSED') steps.push({ id: `${r.id}-lapsed`, label: renderReason(r.mainReason, lang, { flags: r.flags }), owner: 'Partner', due: null, done: false });
      break;
    case 'REDIRECT_RESERVED':
      r.reservation?.milestones?.forEach((m) =>
        steps.push({ id: `${r.id}-${m.key}`, label: t(lang, m.key === 'accept' ? 'TASK_REDIRECT_ACCEPT' : m.key === 'space' ? 'TASK_REDIRECT_SPACE' : 'TASK_REDIRECT_VERIFY'), owner: m.key === 'verify' ? 'Expansion team' : 'Partner', due: m.due, done: m.done }),
      );
      fixes.forEach((f, i) => steps.push({ id: `${r.id}-fix${i}`, label: t(lang, f.code, f.params), owner: 'Partner', due: r.reservation?.deadline ?? null, done: false }));
      break;
    case 'WAITLIST':
      if (r.waitlistType === 'QUALIFIED') steps.push({ id: `${r.id}-queue`, label: `Wait for a released slot — #${r.queuePosition ?? '?'} in line`, owner: 'Expansion team', due: gapDateOf(r), done: false });
      r.tips.forEach((tip, i) => steps.push({ id: `${r.id}-tip${i}`, label: renderTip(tip, lang), owner: 'Partner', due: null, done: false }));
      break;
    case 'REJECT':
      if (r.mainReason.code === 'R_MONEY_BELOW_FLOOR') steps.push({ id: `${r.id}-reapply`, label: `Reapply with at least ₹${r.mainReason.params.floor}L`, owner: 'Partner', due: null, done: false });
      else if (r.futureLead) steps.push({ id: `${r.id}-lead`, label: 'Logged as a future-territory lead', owner: 'Expansion team', due: null, done: true });
      else if (r.mainReason.code === 'R_PIN_HAS_STORE') steps.push({ id: `${r.id}-pin`, label: 'Reapply for a different PIN', owner: 'Partner', due: null, done: false });
      r.tips.forEach((tip, i) => steps.push({ id: `${r.id}-tip${i}`, label: renderTip(tip, lang), owner: 'Partner', due: null, done: false }));
      break;
    case 'WITHDRAWN':
      break;
  }
  return steps;
}

export function textOf(r: AppResult, lang: Lang = 'en'): DecisionText {
  const ctx = { flags: r.flags, deadline: r.reservation?.deadline ?? null, gapDate: gapDateOf(r) };
  return {
    outcome: lang === 'en' ? outcomeLabel(r) : t(lang, `O_${r.outcome}`),
    sub: subOf(r),
    main: renderReason(r.mainReason, lang, ctx),
    others: r.otherReasons.map((x) => renderReason(x, lang, ctx)),
    warnings: r.warnings.map((w) => renderWarning(w, lang)),
    tips: r.tips.map((x) => renderTip(x, lang)),
    nextSteps: nextStepTexts(r, lang).map((s) => s.label),
  };
}

export function scoreLine(r: AppResult, lang: Lang = 'en'): string {
  const f = r.score.factors;
  const part = (k: FactorKey) => `${t(lang, `FACTOR_${k}`)} ${f[k].excluded ? `— (${t(lang, 'EXCLUDED')})` : `${f[k].points}/${f[k].max}`}`;
  const pen = r.penalty.penalty ? ` · ${t(lang, 'PENALTY')} −${r.penalty.penalty}` : '';
  const pct = r.score.assessableMax < 100 ? ` (${r.score.fitScore}/${r.score.assessableMax} = ${Math.round(r.score.qualityPct)}%)` : '';
  return `${(['money', 'space', 'experience', 'background', 'timeline'] as FactorKey[]).map(part).join(' · ')}${pen} → ${t(lang, 'TOTAL')} ${Math.round(r.adjustedPct)}${pct} · ${t(lang, 'BAR')} ${r.bar}`;
}

/* ---------------- Onboarding stepper ---------------- */

const HOURS_PER_MODULE = { extended: 6, standard: 4, fast: 2 } as const;

export function onboardingPlanOf(r: AppResult): OnboardingPlan | null {
  const p = r.onboarding;
  if (!p || r.outcome !== 'APPROVE') return null;
  const cur = currentStage(p);
  const current: StageKey = cur === 'Approved' ? 'Agreement' : cur;
  const curIdx = ONBOARDING_STEPS.indexOf(current);
  const open = isStoreOpen(p);
  const trainingDone = p.tasks.find((x) => x.code === 'TASK_TRAINING_DONE')?.status !== 'Not started';
  return {
    current,
    steps: ONBOARDING_STEPS.map((s, i) => ({
      step: s,
      targetDate: p.stages.find((x) => x.stage === s)?.endDate ?? p.openingDate,
      state: open || i < curIdx ? 'done' : i === curIdx ? 'active' : 'upcoming',
    })),
    atRisk: p.health !== 'On track',
    riskNote: p.healthReason ?? undefined,
    training: p.modules.map((m) => ({
      id: m.code, title: t('en', m.code), week: m.week, hours: m.extra ? 2 : HOURS_PER_MODULE[p.track], progress: trainingDone ? 1 : 0,
    })),
    startDate: p.startDate,
    targetOpen: p.openingDate,
  };
}

/* ---------------- Attention, drop reasons, flags ---------------- */

export function attentionOf(r: AppResult, today: string): { attention: string | null; priority: number | null } {
  const res = r.reservation;
  if (res) {
    const left = days(today, res.deadline);
    if (left >= 0 && left <= 3) return { attention: `Reservation ends in ${left}d`, priority: 1 };
  }
  const p = r.onboarding;
  if (r.outcome === 'APPROVE' && p?.health === 'Delayed') return { attention: 'Onboarding delayed', priority: 2 };
  const waiting = p?.tasks.filter((x) => x.status === 'Done — awaiting check').length ?? 0;
  if (r.outcome === 'APPROVE' && waiting) return { attention: `${waiting} task${waiting > 1 ? 's' : ''} to verify`, priority: 3 };
  if (r.outcome === 'REDIRECT_RESERVED' && !res?.milestones?.[0].done) return { attention: `Redirect offered · ${r.slotPin}`, priority: 4 };
  if (r.outcome === 'HOLD_RESERVED' && res) {
    const first = r.flags.find((x) => x.blocking);
    return { attention: `${first ? FLAG_SHORT(first.code) : 'Fix'} · by ${fmt(res.deadline)}`, priority: 5 };
  }
  if (r.humanReview) return { attention: 'Notes need review', priority: 6 };
  if (r.outcome === 'APPROVE' && p?.health === 'At risk') return { attention: 'Onboarding at risk', priority: 7 };
  if (r.outcome === 'HOLD' && r.holdType !== 'STRONG_WAITING') {
    const first = r.flags.find((x) => x.blocking);
    return { attention: first ? FLAG_SHORT(first.code) : 'Needs an update', priority: 8 };
  }
  if (r.holdType === 'STRONG_WAITING') return { attention: 'Strong · no slot', priority: 9 };
  return { attention: null, priority: null };
}

export function dropReasonOf(r: AppResult): string | null {
  if (r.outcome === 'APPROVE') return null;
  if (r.outcome === 'WITHDRAWN') return 'Withdrawn';
  const m: Partial<Record<string, string>> = {
    R_MONEY_BELOW_FLOOR: 'Investment too low', R_OUTSIDE_TERRITORY: 'Outside territories', R_PIN_HAS_STORE: 'Store already at PIN',
    R_LOW_SCORE: 'Score below 45', R_FLAGGED_WEAK: 'Missing info + weak', R_BELOW_BAR: 'Below territory bar', R_SLOTS_FULL: 'Slots full',
    R_LOST_GAP_RULE: 'Slots full', R_PIN_TAKEN: 'PIN taken',
  };
  if (m[r.mainReason.code]) return m[r.mainReason.code]!;
  if (r.holdType === 'SPACE') return 'No usable space';
  if (r.holdType === 'INFO') return 'Missing details';
  if (r.holdType === 'STRONG_WAITING') return 'No slot nearby';
  if (r.holdType === 'LAPSED') return 'Reservation lapsed';
  if (r.outcome === 'REDIRECT_RESERVED') return 'Redirected';
  return 'Other';
}

const FIELD_OF: Record<string, string> = {
  F_PIN_CITY_MISMATCH: 'pin', F_INVEST_MISSING: 'investmentLakh', F_SIZE_MISSING: 'spaceSqft', F_FLOOR_UNKNOWN: 'floor', F_NO_SPACE: 'space',
  F_SPACE_TOO_SMALL: 'spaceSqft', F_SPACE_CONTRADICTION: 'space', F_EXP_MISSING: 'experienceYears', F_LAUNCH_MISSING: 'launchMonths',
  F_NOTES_CONTRADICTION: 'notes', F_NOTES_DATE: 'notes', F_BACKGROUND_UNCLEAR: 'business',
};
export const dataFlagsOf = (r: AppResult): DataFlag[] => r.flags.map((f) => ({ field: FIELD_OF[f.code] ?? 'notes', label: FLAG_SHORT(f.code) }));

/* ---------------- Timeline ---------------- */

export function timelineOf(r: AppResult, overrides: Override[], decisionDate: string, today: string): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ date: r.app.submittedAt <= decisionDate ? r.app.submittedAt : decisionDate, label: 'Application received', kind: 'received' }];
  ev.push({ date: decisionDate, label: `Scored ${Math.round(r.adjustedPct)} (bar ${r.bar})`, kind: 'screened' });
  if (r.flags.some((f) => f.blocking)) ev.push({ date: decisionDate, label: `Info requested: ${r.flags.filter((f) => f.blocking).map((f) => FLAG_SHORT(f.code).toLowerCase()).join(', ')}`, kind: 'info' });
  ev.push({ date: r.reservation?.awardedOn ?? decisionDate, label: `Decision: ${outcomeLabel(r)}`, kind: 'decision' });
  for (const o of overrides) {
    if (o.targetId !== r.id && !(o.target === 'territory' && o.targetId === (r.slotTerritoryId ?? r.territoryId))) continue;
    ev.push({ date: o.effectiveDate, label: o.label + (o.reason ? ` — “${o.reason}”` : ''), kind: o.field === 'task' ? 'onboarding' : 'note' });
  }
  if (r.onboarding && r.outcome === 'APPROVE') ev.push({ date: r.onboarding.startDate, label: 'Onboarding started (week 1)', kind: 'onboarding' });
  if (r.holdType === 'LAPSED' && typeof r.mainReason.params.date === 'string') ev.push({ date: r.mainReason.params.date, label: 'Reservation lapsed', kind: 'decision' });
  return ev.filter((e) => e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------------- Decision ---------------- */

export function toDecision(r: AppResult, overrides: Override[], decisionDate: string, today: string): Decision {
  const { attention, priority } = attentionOf(r, today);
  const plan = onboardingPlanOf(r);
  const steps = nextStepTexts(r, 'en');
  const since = r.onboarding && r.outcome === 'APPROVE' ? r.onboarding.startDate : r.reservation?.awardedOn ?? decisionDate;
  return {
    applicationId: r.id,
    status: statusOf(r),
    stage: stageOf(r),
    confidence: Math.max(0, Math.min(1, r.adjustedPct / 100)),
    summary: textOf(r).main,
    reasons: chipsOf(r),
    territoryId: r.slotTerritoryId ?? r.territoryId,
    attention,
    attentionPriority: priority,
    dropReason: dropReasonOf(r),
    nextSteps: steps.map((s) => ({ id: s.id, label: s.label, owner: s.owner, dueDate: s.due ?? today, done: s.done })),
    onboarding: plan,
    dataFlags: dataFlagsOf(r),
    daysInStage: Math.max(0, days(since, today)),
    timeline: timelineOf(r, overrides, decisionDate, today),
    territoryRank: r.slotRank ?? r.queuePosition,
    result: r,
    text: textOf(r),
  };
}

export const TRAINING_LABEL = (track: keyof typeof TRAINING_WEEKS, lang: Lang = 'en') => t(lang, `TRACK_${track}`);
