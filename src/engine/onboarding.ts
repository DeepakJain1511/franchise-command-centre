/** Step 9 — onboarding plan for approvals, and a preview for reservations (Build Spec §13). */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  AT_RISK_DAYS_BEFORE_DUE, BASE_OPENING_WEEKS, BUDDY_FALLBACK, DELAYED_DAYS_OVERDUE, FUNDING_PROOF_MAX_RATIO, MALL_EXTRA_WEEKS,
  REDIRECT_ACCEPT_DAYS, REDIRECT_SPACE_DAYS, REDIRECT_VERIFY_DAYS, SPACE_SEARCH_EXTRA_WEEKS, TRAINING_START_WEEK, TRAINING_TRACK_YEARS,
  TRAINING_WEEKS, WEEKS_PER_MONTH,
} from '@/config';
import { detectNotesDate } from './flags';
import type { StoreRef } from './location';
import type { Health, OnboardingDetail, PenaltyInfo, PlanTask, ScoreCard, StageKey, TaskStatus, TrainingTrack } from './model';
import type { Application } from './types';

const isoOf = (d: Date) => format(d, 'yyyy-MM-dd');
const addD = (iso: string, n: number) => isoOf(addDays(parseISO(iso), n));
const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

export function trainingTrack(years: number | null): TrainingTrack {
  const y = years ?? 0;
  if (y >= TRAINING_TRACK_YEARS.fastFrom) return 'fast';
  if (y >= TRAINING_TRACK_YEARS.standardFrom) return 'standard';
  return 'extended';
}

export function buddyStore(app: Application, existing: StoreRef[]): string {
  const same = existing.filter((s) => s.city === app.city && s.id.startsWith('ST-'));
  if (same.length) {
    const n = Number(app.pin);
    return [...same].sort((a, b) => Math.abs(Number(a.pin) - n) - Math.abs(Number(b.pin) - n) || a.id.localeCompare(b.id))[0].id;
  }
  return BUDDY_FALLBACK[app.city] ?? existing.find((s) => s.id.startsWith('ST-'))?.id ?? 'ST-01';
}

export function buildOnboarding(args: {
  app: Application;
  card: ScoreCard;
  penalty: PenaltyInfo;
  preview: boolean;
  redirect: boolean;
  /** Space still has to be found (redirect, or a no-space hold). */
  spaceSearch: boolean;
  startDate: string;
  decisionDate: string;
  today: string;
  existingStores: StoreRef[];
  taskStatus: Map<string, TaskStatus>;
  reservationDeadline: string | null;
}): OnboardingDetail {
  const { app, card, penalty, preview, redirect, spaceSearch, startDate, decisionDate, today, taskStatus } = args;
  const mall = app.floor === 'Mall unit' && !spaceSearch;
  const upper = app.floor === 'Upper' && !spaceSearch;
  const shift = mall ? MALL_EXTRA_WEEKS : 0;
  const offset = spaceSearch ? SPACE_SEARCH_EXTRA_WEEKS : 0;
  const track = trainingTrack(app.experienceYears);
  const trainingWeeks = TRAINING_WEEKS[track];
  const trainingEnd = TRAINING_START_WEEK + trainingWeeks - 1;

  const earliest = BASE_OPENING_WEEKS + shift + offset;
  const elapsedWeeks = daysBetween(decisionDate, startDate) / 7;
  const targetWeeks = app.launchMonths === null ? null : app.launchMonths * WEEKS_PER_MONTH - elapsedWeeks;
  const targetMet = targetWeeks !== null && targetWeeks >= earliest;
  const openingWeeks = targetMet ? Math.ceil(targetWeeks!) : earliest;
  const buffer = targetMet ? Math.floor(targetWeeks! - earliest) : 0;
  const weekStart = (w: number) => addD(startDate, (w - 1) * 7);
  const weekEnd = (w: number) => addD(startDate, w * 7 - 1);
  const openingDate = targetMet ? addD(startDate, Math.round(targetWeeks! * 7)) : weekEnd(earliest);

  /* Stages (weeks, after the redirect / space-search offset) */
  const o = offset;
  const stageWeeks: Array<[StageKey, number, number]> = [
    ['Agreement', 1 + o, 2 + o],
    ['Licences', 2 + o, 4 + o],
    ['Fit-out', 3 + o, 8 + shift + o],
    ['Training', TRAINING_START_WEEK + o, trainingEnd + o],
    ['Stock & staff', 9 + shift + o + buffer, 11 + shift + o + buffer],
    ['Soft launch', 12 + shift + o + buffer, 12 + shift + o + buffer],
    ['Open', openingWeeks, openingWeeks],
  ];
  const stages = stageWeeks.map(([stage, s, e]) => ({ stage, startWeek: s, endWeek: e, startDate: weekStart(s), endDate: stage === 'Open' ? openingDate : weekEnd(e) }));

  /* Tasks (§13.2) */
  type Def = { code: string; stage: StageKey; week: number; day?: number };
  const defs: Def[] = [];
  if (redirect) {
    defs.push({ code: 'TASK_REDIRECT_ACCEPT', stage: 'Agreement', week: 1, day: REDIRECT_ACCEPT_DAYS });
    defs.push({ code: 'TASK_REDIRECT_SPACE', stage: 'Agreement', week: 5, day: REDIRECT_SPACE_DAYS });
    defs.push({ code: 'TASK_REDIRECT_VERIFY', stage: 'Agreement', week: 5, day: REDIRECT_SPACE_DAYS + REDIRECT_VERIFY_DAYS });
  }
  const ratio = card.investmentRatio ?? 0;
  const paybackRisk = card.warnings.some((w) => w.code === 'W_PAYBACK_RISK');
  if (paybackRisk || (ratio >= 1 && ratio <= FUNDING_PROOF_MAX_RATIO)) defs.push({ code: 'TASK_FUNDING_PROOF', stage: 'Agreement', week: 1 + o });
  defs.push({ code: 'TASK_SIGN_AGREEMENT', stage: 'Agreement', week: 2 + o });
  if (!spaceSearch && app.space === 'Owned') defs.push({ code: 'TASK_PROPERTY_DOCS', stage: 'Agreement', week: 2 + o });
  if (!spaceSearch && app.space === 'Rented') defs.push({ code: 'TASK_RENT_AGREEMENT', stage: 'Agreement', week: 2 + o });
  defs.push({ code: 'TASK_LICENCES', stage: 'Licences', week: 4 + o });
  if (mall) defs.push({ code: 'TASK_MALL_APPROVAL', stage: 'Fit-out', week: 3 + o });
  defs.push({ code: 'TASK_FITOUT_START', stage: 'Fit-out', week: 3 + o });
  defs.push({ code: 'TASK_FITOUT_DONE', stage: 'Fit-out', week: 8 + shift + o });
  if (upper) defs.push({ code: 'TASK_SIGNAGE', stage: 'Fit-out', week: 8 + shift + o });
  if (upper || penalty.penalty > 0) defs.push({ code: 'TASK_LOCAL_MARKETING', stage: 'Fit-out', week: 8 + shift + o });
  defs.push({ code: 'TASK_TRAINING_DONE', stage: 'Training', week: trainingEnd + o });
  defs.push({ code: 'TASK_STOCK_BILLING', stage: 'Stock & staff', week: 11 + shift + o + buffer });
  defs.push({ code: 'TASK_STAFF_HIRED', stage: 'Stock & staff', week: 11 + shift + o + buffer });
  defs.push({ code: 'TASK_SOFT_LAUNCH', stage: 'Soft launch', week: 12 + shift + o + buffer });
  defs.push({ code: 'TASK_GRAND_OPENING', stage: 'Open', week: openingWeeks });

  const tasks: PlanTask[] = defs.map((d) => {
    const id = `${app.id}:${d.code}`;
    const dueDate = d.code === 'TASK_GRAND_OPENING' ? openingDate : d.day !== undefined ? addD(startDate, d.day) : weekEnd(d.week);
    const status = taskStatus.get(id) ?? 'Not started';
    const overdue = status === 'Not started' ? Math.max(0, daysBetween(dueDate, today)) : 0;
    return { id, code: d.code, stage: d.stage, dueWeek: d.week, dueDate, status, overdueDays: overdue };
  });

  /* Training (§13.3) */
  const modules: OnboardingDetail['modules'] = ['MOD_BRAND', 'MOD_BILLING', 'MOD_SERVICE', 'MOD_STAFF', 'MOD_FINANCE', 'MOD_BUDDY'].map((code, i) => ({
    code, week: TRAINING_START_WEEK + o + Math.min(trainingWeeks - 1, Math.floor((i * trainingWeeks) / 6)), extra: false,
  }));
  const lastWeek = trainingEnd + o;
  if (card.backgroundCategory !== 'retail') modules.push({ code: 'MOD_EXTRA_SERVICE', week: lastWeek, extra: true });
  if (paybackRisk) modules.push({ code: 'MOD_COST_CONTROL', week: lastWeek, extra: true });
  if (upper || penalty.penalty > 0) modules.push({ code: 'MOD_LOCAL_MARKETING', week: lastWeek, extra: true });

  /* Occasion in notes */
  const occ = detectNotesDate(app.notes, decisionDate);
  const occasion = occ ? { label: occ.label, phrase: occ.phrase, date: occ.date, met: openingDate <= occ.date } : null;

  /* Health (§15) */
  let health: Health = 'On track';
  let healthReason: string | null = null;
  if (!preview) {
    const due = tasks.filter((t) => t.status === 'Not started');
    const worst = Math.max(0, ...due.map((t) => t.overdueDays));
    const soon = due.find((t) => {
      const d = daysBetween(today, t.dueDate);
      return d >= 0 && d <= AT_RISK_DAYS_BEFORE_DUE;
    });
    if (worst > DELAYED_DAYS_OVERDUE) {
      health = 'Delayed';
      healthReason = `A task is ${worst} days overdue`;
    } else if (worst > 0) {
      health = 'At risk';
      healthReason = `A task is ${worst} day${worst === 1 ? '' : 's'} overdue`;
    } else if (soon) {
      health = 'At risk';
      healthReason = `A task is due ${isoOf(parseISO(soon.dueDate)) === today ? 'today' : `in ${daysBetween(today, soon.dueDate)} days`}`;
    }
  } else if (args.reservationDeadline) {
    const left = daysBetween(today, args.reservationDeadline);
    if (left >= 0 && left <= AT_RISK_DAYS_BEFORE_DUE) {
      health = 'At risk';
      healthReason = `Reservation ends in ${left} day${left === 1 ? '' : 's'}`;
    }
  }

  const done = tasks.filter((t) => t.status !== 'Not started').length;

  return {
    preview, startDate, offsetWeeks: offset, mall, earliestOpeningWeeks: earliest, targetWeeks, openingWeeks, openingDate, bufferWeeks: buffer,
    openingNote: targetWeeks === null ? 'TARGET_BLANK' : targetMet ? 'TARGET_MET' : 'EARLIEST_ONLY',
    occasion, stages, tasks, track, trainingWeeks, trainingStartWeek: TRAINING_START_WEEK + o, modules,
    firstTimeOwner: (app.experienceYears ?? 0) === 0, language: app.language, buddyStoreId: buddyStore(app, args.existingStores),
    health, healthReason, tasksDonePct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}

/** The stage the partner is in: the first whose tasks are not all verified. */
export function currentStage(plan: OnboardingDetail): StageKey | 'Approved' {
  const order: StageKey[] = ['Agreement', 'Licences', 'Fit-out', 'Training', 'Stock & staff', 'Soft launch', 'Open'];
  const anyMoved = plan.tasks.some((t) => t.status !== 'Not started');
  for (const s of order) {
    const ts = plan.tasks.filter((t) => t.stage === s);
    if (ts.some((t) => t.status !== 'Verified')) return s === 'Agreement' && !anyMoved ? 'Approved' : s;
  }
  return 'Open';
}

export const isStoreOpen = (plan: OnboardingDetail) => plan.tasks.find((t) => t.code === 'TASK_GRAND_OPENING')?.status === 'Verified';
