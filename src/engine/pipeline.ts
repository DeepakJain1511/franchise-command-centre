/**
 * runPipeline(baseData, overrides, options) → results. Pure: same inputs, same outputs; never mutates baseData.
 * Any change in data is a full re-run (Build Spec §11.2, §16).
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  DEADLINE_EXTENSION_DAYS, HOLD_INFO_DAYS, HOLD_SPACE_DAYS, REDIRECT_ACCEPT_DAYS, REDIRECT_SPACE_DAYS, REDIRECT_VERIFY_DAYS, AT_RISK_DAYS_BEFORE_DUE,
  BASE_OPENING_WEEKS, MALL_EXTRA_WEEKS, SPACE_SEARCH_EXTRA_WEEKS, WEEKS_PER_MONTH, type PriorityKey,
} from '@/config';
import { allocate, type Allocated, type Forced, type Prepared } from './allocate';
import { collectWarnings, improvementTips, plusDaysIso, weakestFactors } from './explain';
import { computeFlags, holdDaysOf, tierOf } from './flags';
import { buildPinToTerritory, demandSignals, type StoreRef } from './location';
import type { Alert, AppField, AppResult, BaseData, Override, PipelineOptions, PipelineResult, ReasonRef, Reservation, TaskStatus, TerritoryResult } from './model';
import { buildOnboarding } from './onboarding';
import { scoreApplication } from './score';
import type { Application, Floor, Language, SpaceAvailable, Territory } from './types';

const DATA_FIELDS: AppField[] = ['space', 'spaceSqft', 'floor', 'pin', 'city', 'investmentLakh', 'experienceYears', 'launchMonths', 'language', 'business', 'notes'];

interface Meta {
  locationConfirmed: boolean;
  redirect: { state: 'accepted' | 'declined'; pin: string } | null;
  deadline: { state: 'met' | 'missed'; date: string } | null;
  extendDays: number;
  withdrawn: boolean;
  releasedOn: string | null;
  lastDataChange: string | null;
  taskStatus: Map<string, TaskStatus>;
}

const emptyMeta = (): Meta => ({
  locationConfirmed: false, redirect: null, deadline: null, extendDays: 0, withdrawn: false, releasedOn: null, lastDataChange: null, taskStatus: new Map(),
});

/** Apply overrides in order to a copy of the base data. */
export function applyOverrides(base: BaseData, overrides: Override[]) {
  const apps = new Map(base.applications.map((a) => [a.id, { ...a }]));
  const terrs = new Map(base.territories.map((t) => [t.id, { ...t, pins: [...t.pins] }]));
  const meta = new Map<string, Meta>(base.applications.map((a) => [a.id, emptyMeta()]));
  for (const o of overrides) {
    if (o.target === 'territory') {
      const t = terrs.get(o.targetId);
      if (!t) continue;
      if (o.field === 'openSlots' && typeof o.value === 'number') t.openSlots = Math.max(0, Math.round(o.value));
      if (o.field === 'priority' && typeof o.value === 'string') t.priority = o.value as PriorityKey;
      continue;
    }
    const a = apps.get(o.targetId);
    const m = meta.get(o.targetId);
    if (!a || !m) continue;
    const v = o.value;
    switch (o.field as AppField) {
      case 'space': a.space = v as SpaceAvailable; break;
      case 'spaceSqft': a.spaceSqft = v === null ? null : Number(v); break;
      case 'floor': a.floor = v as Floor; break;
      case 'pin': a.pin = String(v); break;
      case 'city': a.city = v as Application['city']; break;
      case 'investmentLakh': a.investmentLakh = v === null ? null : Number(v); break;
      case 'experienceYears': a.experienceYears = v === null ? null : Number(v); break;
      case 'launchMonths': a.launchMonths = v === null ? null : Number(v); break;
      case 'language': a.language = v as Language; break;
      case 'business': a.business = String(v ?? ''); break;
      case 'notes': a.notes = String(v ?? ''); break;
      case 'locationConfirmed': m.locationConfirmed = !!v; break;
      case 'redirect': {
        const [state, pin] = String(v).split(':');
        m.redirect = { state: state as 'accepted' | 'declined', pin: pin ?? '' };
        break;
      }
      case 'deadline':
        if (v === 'extend') m.extendDays += DEADLINE_EXTENSION_DAYS;
        else m.deadline = { state: v as 'met' | 'missed', date: o.effectiveDate };
        break;
      case 'withdrawn': m.withdrawn = !!v; break;
      case 'release': m.releasedOn = o.effectiveDate; break;
      case 'task':
        if (v && typeof v === 'object' && 'taskId' in v) m.taskStatus.set(v.taskId, v.status);
        break;
    }
    if (DATA_FIELDS.includes(o.field as AppField)) m.lastDataChange = o.effectiveDate;
  }
  return { applications: [...apps.values()], territories: [...terrs.values()], meta };
}

const r = (code: ReasonRef['code'], params: ReasonRef['params'] = {}): ReasonRef => ({ code, params });
const days = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

function prepare(a: Application, decisionDate: string, m: Meta): Prepared {
  const flags = computeFlags(a, decisionDate, { locationConfirmed: m.locationConfirmed });
  const { card, extraFlags } = scoreApplication(a, flags);
  const all = [...flags, ...extraFlags];
  return { id: a.id, app: a, tier: tierOf(a.city), flags: all, blocking: all.some((f) => f.blocking), holdDays: holdDaysOf(all), card };
}

function reservationFor(al: Allocated, p: Prepared, awardedOn: string, m: Meta): Reservation | null {
  if (!al.slotPin || !al.slotTerritoryId) return null;
  if (al.outcome === 'HOLD_RESERVED') {
    const base = (p.holdDays ?? HOLD_INFO_DAYS) >= HOLD_SPACE_DAYS ? HOLD_SPACE_DAYS : HOLD_INFO_DAYS;
    return {
      kind: base === HOLD_SPACE_DAYS ? 'SPACE' : 'INFO', pin: al.slotPin, territoryId: al.slotTerritoryId, awardedOn,
      deadline: plusDaysIso(awardedOn, base + m.extendDays), extendedDays: m.extendDays,
    };
  }
  if (al.outcome === 'REDIRECT_RESERVED') {
    const accepted = m.redirect?.state === 'accepted';
    const met = m.deadline?.state === 'met';
    const ext = m.extendDays;
    return {
      kind: 'REDIRECT', pin: al.slotPin, territoryId: al.slotTerritoryId, awardedOn,
      deadline: plusDaysIso(awardedOn, REDIRECT_SPACE_DAYS + REDIRECT_VERIFY_DAYS + ext),
      milestones: [
        { key: 'accept', due: plusDaysIso(awardedOn, REDIRECT_ACCEPT_DAYS + ext), done: accepted },
        { key: 'space', due: plusDaysIso(awardedOn, REDIRECT_SPACE_DAYS + ext), done: accepted && met },
        { key: 'verify', due: plusDaysIso(awardedOn, REDIRECT_SPACE_DAYS + REDIRECT_VERIFY_DAYS + ext), done: accepted && met },
      ],
      extendedDays: ext,
    };
  }
  return null;
}

/** Earliest realistic opening if this applicant were approved today (for the notes date check of non-approvals). */
function hypotheticalOpening(a: Application, decisionDate: string, usableSpace: boolean): string {
  const earliest = BASE_OPENING_WEEKS + (a.floor === 'Mall unit' && usableSpace ? MALL_EXTRA_WEEKS : 0) + (usableSpace ? 0 : SPACE_SEARCH_EXTRA_WEEKS);
  const target = a.launchMonths === null ? 0 : a.launchMonths * WEEKS_PER_MONTH;
  return plusDaysIso(decisionDate, Math.round(Math.max(earliest, target) * 7) - 1);
}

export function runPipeline(base: BaseData, overrides: Override[], options: PipelineOptions): PipelineResult {
  const { decisionDate, today } = options;
  const eff = applyOverrides(base, overrides);
  const territories: Territory[] = eff.territories;
  const { map: pinToTerritory, duplicates } = buildPinToTerritory(territories);
  const existing: StoreRef[] = base.stores.map((s) => ({ city: s.city, pin: s.pin, id: s.id }));
  const prepared = eff.applications.map((a) => prepare(a, decisionDate, eff.meta.get(a.id)!));
  const prepById = new Map(prepared.map((p) => [p.id, p]));

  /* -------- Allocation, re-run while reservations lapse (time slider / release / missed) -------- */
  const forced = new Map<string, Forced>();
  const awardDate = new Map<string, string>();
  for (const [id, m] of eff.meta) {
    if (m.withdrawn) forced.set(id, { outcome: 'WITHDRAWN', waitlistType: null, holdType: null, main: r('R_WITHDRAWN') });
    else if (m.redirect?.state === 'declined') forced.set(id, { outcome: 'HOLD', waitlistType: null, holdType: 'STRONG_WAITING', main: r('R_REDIRECT_DECLINED', { newPin: m.redirect.pin }) });
  }
  let alloc = allocate({ prepared, territories, existingStores: existing, pinToTerritory, forced });
  // Slots freed by a lapse are awarded on the lapse date, so the next reservation's clock starts then.
  let lapseDayPrev: string | null = null;
  for (let iter = 0; iter < 25; iter++) {
    let lapseDay: string | null = null;
    for (const al of alloc.byId.values()) {
      if (!awardDate.has(al.id) && al.slotPin) awardDate.set(al.id, lapseDayPrev ?? decisionDate);
    }
    for (const al of alloc.byId.values()) {
      if (al.outcome !== 'HOLD_RESERVED' && al.outcome !== 'REDIRECT_RESERVED') continue;
      const m = eff.meta.get(al.id)!;
      const res = reservationFor(al, prepById.get(al.id)!, awardDate.get(al.id) ?? decisionDate, m);
      if (!res) continue;
      const approvedRedirect = al.outcome === 'REDIRECT_RESERVED' && m.redirect?.state === 'accepted' && m.deadline?.state === 'met';
      if (approvedRedirect) continue;
      let lapsedOn: string | null = null;
      if (m.releasedOn) lapsedOn = m.releasedOn;
      else if (m.deadline?.state === 'missed') lapsedOn = m.deadline.date;
      else if (today > res.deadline && m.deadline?.state !== 'met') lapsedOn = plusDaysIso(res.deadline, 1);
      if (!lapsedOn) continue;
      const kind = res.kind;
      forced.set(al.id, kind === 'SPACE'
        ? { outcome: 'WAITLIST', waitlistType: null, holdType: 'LAPSED', main: r('R_RESERVATION_LAPSED', { date: lapsedOn, kind }) }
        : { outcome: 'HOLD', waitlistType: null, holdType: 'LAPSED', main: r('R_RESERVATION_LAPSED', { date: lapsedOn, kind }) });
      if (!lapseDay || lapsedOn > lapseDay) lapseDay = lapsedOn;
    }
    if (!lapseDay) break;
    lapseDayPrev = lapseDay;
    alloc = allocate({ prepared, territories, existingStores: existing, pinToTerritory, forced });
  }
  for (const al of alloc.byId.values()) if (!awardDate.has(al.id) && al.slotPin) awardDate.set(al.id, lapseDayPrev ?? decisionDate);

  /* -------- Build results -------- */
  const results: AppResult[] = prepared.map((p) => {
    const al = alloc.byId.get(p.id)!;
    const m = eff.meta.get(p.id)!;
    const awardedOn = awardDate.get(p.id) ?? decisionDate;
    let outcome = al.outcome;
    let mainReason = al.mainReason;
    const otherReasons = [...al.otherReasons];
    // Redirect accepted + space secured and verified → Approve (§11.2).
    if (outcome === 'REDIRECT_RESERVED' && m.redirect?.state === 'accepted' && m.deadline?.state === 'met') {
      outcome = 'APPROVE';
      otherReasons.unshift(mainReason);
      mainReason = r('R_WON_SLOT', { score: Math.round(al.adjustedPct), rank: al.slotRank ?? 1, n: al.competitors.length + 1, territory: al.slotTerritoryId ?? '', slots: territories.find((t) => t.id === al.slotTerritoryId)?.openSlots ?? 0 });
    }
    if (mainReason.code === 'R_LOW_SCORE') mainReason = { ...mainReason, params: { ...mainReason.params, weakest: weakestFactors({ score: p.card }) } };

    const reservation = outcome === 'APPROVE' ? null : reservationFor({ ...al, outcome }, p, awardedOn, m);
    const approvedOn = outcome === 'APPROVE' ? [awardedOn, m.lastDataChange ?? awardedOn].sort().pop()! : awardedOn;
    const redirect = al.outcome === 'REDIRECT_RESERVED';
    const hasPlan = outcome === 'APPROVE' || outcome === 'HOLD_RESERVED' || outcome === 'REDIRECT_RESERVED';
    const onboarding = hasPlan
      ? buildOnboarding({
          app: redirect ? { ...p.app, pin: al.slotPin ?? p.app.pin } : p.app,
          card: p.card,
          penalty: al.penalty,
          preview: outcome !== 'APPROVE',
          redirect: redirect && !(m.deadline?.state === 'met'),
          spaceSearch: (redirect && !(m.deadline?.state === 'met')) || (outcome === 'HOLD_RESERVED' && reservation?.kind === 'SPACE'),
          startDate: approvedOn,
          decisionDate,
          today,
          existingStores: existing,
          taskStatus: m.taskStatus,
          reservationDeadline: reservation?.deadline ?? null,
        })
      : null;

    const opening = onboarding?.openingDate ?? hypotheticalOpening(p.app, decisionDate, p.card.usableSpace);
    const warnings = collectWarnings({ score: p.card, penalty: al.penalty, flags: p.flags }, opening);
    const tips = outcome === 'APPROVE' || outcome === 'WITHDRAWN' || mainReason.code === 'R_OUTSIDE_TERRITORY' || mainReason.code === 'R_PIN_HAS_STORE'
      ? []
      : improvementTips({ app: p.app, score: p.card, flags: p.flags });

    return {
      id: p.id, app: p.app, tier: p.tier, territoryId: al.territoryId, bar: al.bar, priority: al.priority, flags: p.flags, blocking: p.blocking,
      holdDays: p.holdDays, score: p.card, penalty: al.penalty, adjustedScore: al.adjustedScore, adjustedPct: al.adjustedPct, outcome,
      waitlistType: al.waitlistType, holdType: outcome === 'APPROVE' ? null : al.holdType, mainReason, otherReasons, warnings, tips,
      slotPin: al.slotPin, slotTerritoryId: al.slotTerritoryId, slotRank: al.slotRank, queuePosition: al.queuePosition, competitors: al.competitors,
      decidedBy: al.decidedBy, reservation, onboarding, futureLead: al.futureLead, humanReview: p.flags.some((f) => f.code === 'F_NOTES_CONTRADICTION'),
    };
  });

  // Gap-rule losers: the date their slot comes back is the winner's space deadline.
  for (const res of results) {
    if (res.mainReason.code !== 'R_LOST_GAP_RULE' && !res.otherReasons.some((x) => x.code === 'R_LOST_GAP_RULE')) continue;
    const ref = [res.mainReason, ...res.otherReasons].find((x) => x.code === 'R_LOST_GAP_RULE')!;
    const winner = results.find((x) => x.id === ref.params.to);
    ref.params.date = winner?.reservation?.milestones?.find((x) => x.key === 'space')?.due ?? winner?.reservation?.deadline ?? '';
  }

  /* -------- Territory view -------- */
  const terrResults: TerritoryResult[] = territories.map((t) => {
    const inSlot = results.filter((x) => x.slotTerritoryId === t.id);
    const approved = inSlot.filter((x) => x.outcome === 'APPROVE').map((x) => x.id);
    const reserved = inSlot.filter((x) => x.outcome === 'HOLD_RESERVED' || x.outcome === 'REDIRECT_RESERVED').map((x) => x.id);
    return {
      id: t.id, city: t.city, priority: t.priority, openSlots: t.openSlots, approved, reserved,
      remaining: Math.max(0, t.openSlots - approved.length - reserved.length),
      queue: alloc.queues.get(t.id) ?? [],
      belowBar: results.filter((x) => x.territoryId === t.id && x.waitlistType === 'BELOW_BAR').map((x) => x.id),
      pinsClaimed: inSlot.filter((x) => x.slotPin && (x.outcome === 'APPROVE' || reserved.includes(x.id))).map((x) => x.slotPin!),
      applicants: results.filter((x) => x.territoryId === t.id || x.slotTerritoryId === t.id).map((x) => x.id),
    };
  });

  /* -------- Alerts (§15.2) -------- */
  const alerts: Alert[] = [];
  for (const x of results) {
    if (x.reservation) {
      const left = days(today, x.reservation.deadline);
      if (left >= 0 && left <= AT_RISK_DAYS_BEFORE_DUE) {
        alerts.push({ kind: 'RESERVATION_EXPIRING', applicationId: x.id, severity: 'high', text: `${x.id} reservation ends in ${left} day${left === 1 ? '' : 's'}` });
      }
    }
    if (x.outcome === 'APPROVE' && x.onboarding) {
      const overdue = x.onboarding.tasks.filter((tk) => tk.overdueDays > 0);
      if (overdue.length) alerts.push({ kind: 'TASK_OVERDUE', applicationId: x.id, severity: overdue.some((o) => o.overdueDays > 7) ? 'high' : 'medium', text: `${x.id}: ${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue` });
      const waiting = x.onboarding.tasks.filter((tk) => tk.status === 'Done — awaiting check');
      if (waiting.length) alerts.push({ kind: 'TASK_AWAITING', applicationId: x.id, severity: 'medium', text: `${x.id}: ${waiting.length} task${waiting.length === 1 ? '' : 's'} awaiting your check` });
    }
    if (x.humanReview) alerts.push({ kind: 'NOTES_REVIEW', applicationId: x.id, severity: 'low', text: `${x.id}: notes contradict the form — read them` });
  }
  const outsiders = results.filter((x) => !x.territoryId).map((x) => ({ id: x.id, city: x.app.city, pin: x.app.pin, pct: x.adjustedPct }));
  for (const d of demandSignals(outsiders)) {
    alerts.push({ kind: 'DEMAND_SIGNAL', pin: d.pin, severity: 'medium', text: `${d.ids.length} strong applicants want the area around ${d.pin} — consider adding it to a territory.` });
  }
  for (const d of duplicates) {
    alerts.push({ kind: 'DUPLICATE_PIN', pin: d.pin, severity: 'low', text: `PIN ${d.pin} is listed in ${d.ids.join(' and ')} — using ${d.ids[0]}.` });
  }
  for (const w of base.parseWarnings) alerts.push({ kind: 'PARSE', severity: 'low', text: w });

  return { results, territories: terrResults, alerts, options, applications: eff.applications, territoryInputs: territories, stores: base.stores };
}
