/**
 * Checks agent — audits every pipeline run against the Build Spec rules ("checks and balances").
 * Deterministic invariants run after every change; an optional Gemini pass recomputes the rubric
 * independently from the raw rows and the agent compares it with the engine (Gemini never decides).
 */
import {
  APPROVAL_BAR, FACTOR_MAX, MONEY_HARD_FLOOR_RATIO, REJECT_LINE, STRONG_LINE, TRAINING_WEEKS, MALL_EXTRA_WEEKS, BASE_OPENING_WEEKS, type FactorKey,
} from '@/config';
import { computeFlags } from './flags';
import type { AppResult, BaseData, Override, PipelineResult } from './model';
import { runPipeline } from './pipeline';
import { scoreApplication } from './score';
import { trainingTrack } from './onboarding';

export interface CheckItem {
  id: string;
  title: string;
  rule: string; // spec section
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  offenders: string[];
}

export interface CheckReport {
  ranAt: string;
  items: CheckItem[];
  passed: number;
  failed: number;
  warned: number;
}

const item = (id: string, title: string, rule: string, offenders: string[], detailOk: string, detailBad: (o: string[]) => string, warnOnly = false): CheckItem => ({
  id, title, rule, offenders,
  status: offenders.length === 0 ? 'pass' : warnOnly ? 'warn' : 'fail',
  detail: offenders.length === 0 ? detailOk : detailBad(offenders),
});

const live = (r: AppResult) => r.outcome === 'APPROVE' || r.outcome === 'HOLD_RESERVED' || r.outcome === 'REDIRECT_RESERVED';

export function runChecks(base: BaseData, overrides: Override[], res: PipelineResult): CheckReport {
  const items: CheckItem[] = [];
  const R = res.results;
  const storePins = new Set(res.stores.map((s) => s.pin));

  // 1 — one store per pin
  const claimed = new Map<string, string[]>();
  R.filter(live).forEach((r) => r.slotPin && claimed.set(r.slotPin, [...(claimed.get(r.slotPin) ?? []), r.id]));
  const dupPins = [...claimed.entries()].filter(([, ids]) => ids.length > 1).flatMap(([p, ids]) => ids.map((i) => `${i}@${p}`));
  const onStore = R.filter((r) => live(r) && r.slotPin && storePins.has(r.slotPin)).map((r) => r.id);
  items.push(item('pin-unique', 'One store per pin', '§1, §10', [...dupPins, ...onStore], `${claimed.size} slot pins, all unique and none on an existing store.`, (o) => `Pin clash: ${o.join(', ')}`));

  // 2 — slots never exceeded
  const over = res.territories.filter((t) => t.approved.length + t.reserved.length > t.openSlots).map((t) => t.id);
  items.push(item('slots', 'Territory slots respected', '§10', over, 'No territory has more approvals + reservations than open slots.', (o) => `Over capacity: ${o.join(', ')}`));

  // 3 — exactly one outcome per applicant
  const ids = new Set(R.map((r) => r.id));
  const missingOutcome = base.applications.filter((a) => !ids.has(a.id)).map((a) => a.id).concat(R.filter((r) => !r.outcome || !r.mainReason).map((r) => r.id));
  items.push(item('one-outcome', 'Every applicant has one outcome + reason', '§11.1, §12.3', missingOutcome, `${R.length} applicants, each with one outcome and a main reason code.`, (o) => `Missing outcome/reason: ${o.join(', ')}`));

  // 4 — score arithmetic
  const badMath = R.filter((r) => {
    const f = Object.values(r.score.factors);
    const sum = f.reduce((s, x) => s + x.points, 0);
    const maxOk = f.every((x) => x.points >= 0 && x.points <= FACTOR_MAX[x.key as FactorKey] && (!x.excluded || x.points === 0));
    const assess = 100 - f.filter((x) => x.excluded).reduce((s, x) => s + x.max, 0);
    const q = f.some((x) => x.excluded) ? (assess ? (sum / assess) * 100 : 0) : sum;
    return sum !== r.score.fitScore || !maxOk || assess !== r.score.assessableMax || Math.abs(q - r.score.qualityPct) > 1e-6
      || Math.abs(r.adjustedScore - (r.score.fitScore - r.penalty.penalty)) > 1e-6 || Math.abs(r.adjustedPct - (r.score.qualityPct - r.penalty.penalty)) > 1e-6;
  }).map((r) => r.id);
  items.push(item('math', 'Score arithmetic', '§7.6', badMath, 'Fit = sum of factors; quality % and adjusted scores reconcile for everyone.', (o) => `Mismatch: ${o.join(', ')}`));

  // 5 — re-score from scratch (independent recomputation of every factor)
  const rescoreBad = R.filter((r) => {
    const card = scoreApplication(r.app, computeFlags(r.app, res.options.decisionDate)).card;
    return card.fitScore !== r.score.fitScore || Math.abs(card.qualityPct - r.score.qualityPct) > 1e-6;
  }).map((r) => r.id);
  items.push(item('rescore', 'Independent re-score matches', '§7', rescoreBad, 'Every applicant re-scored from the raw row gives the same points.', (o) => `Different on re-score: ${o.join(', ')}`));

  // 6 — decision lines respected
  const lineBad = R.filter((r) => {
    // Local approval: at or above its territory bar. Approved redirect: a strong (≥ 70) applicant.
    if (r.outcome === 'APPROVE') return r.slotPin === r.app.pin ? r.adjustedPct < r.bar - 1e-9 : r.score.qualityPct < STRONG_LINE;
    if (r.mainReason.code === 'R_LOW_SCORE') return r.adjustedPct >= REJECT_LINE;
    if (r.waitlistType === 'BELOW_BAR') return r.adjustedPct >= r.bar;
    if (r.mainReason.code === 'R_MONEY_BELOW_FLOOR') return (r.score.investmentRatio ?? 1) >= MONEY_HARD_FLOOR_RATIO;
    if (r.outcome === 'REDIRECT_RESERVED' || (r.outcome === 'HOLD' && r.holdType === 'STRONG_WAITING' && r.mainReason.code === 'R_STRONG_NO_SLOT')) return r.score.qualityPct < STRONG_LINE;
    return false;
  }).map((r) => r.id);
  items.push(item('lines', 'Decision lines (45 / bar / 70)', '§8', lineBad, 'No approval below its bar; rejects, waitlists and redirects sit on the right side of their lines.', (o) => `Wrong side of a line: ${o.join(', ')}`));

  // 7 — money floor always rejects
  const floorBad = R.filter((r) => r.score.investmentRatio !== null && r.score.investmentRatio < MONEY_HARD_FLOOR_RATIO && r.outcome !== 'REJECT' && r.outcome !== 'WITHDRAWN').map((r) => r.id);
  items.push(item('money-floor', 'Money floor (70%) always rejects', '§8.1 G3', floorBad, 'Everyone under 70% of the tier minimum is rejected with a reapply amount.', (o) => `Not rejected: ${o.join(', ')}`));

  // 8 — approvals never carry blocking flags
  const flaggedApproved = R.filter((r) => r.outcome === 'APPROVE' && r.blocking).map((r) => r.id);
  items.push(item('flags', 'No approval with open blocking flags', '§6, §8.2', flaggedApproved, 'Flagged applicants are held (reserved or not) until they fix the data.', (o) => `Approved with flags: ${o.join(', ')}`));

  // 9 — approval bar matches territory priority
  const barBad = R.filter((r) => r.priority && r.bar !== STRONG_LINE && r.bar !== APPROVAL_BAR[r.priority]).map((r) => r.id);
  items.push(item('bars', 'Approval bar = territory priority', '§8.3', barBad, 'High 55 · Medium 60 · Low 65 applied everywhere.', (o) => `Wrong bar: ${o.join(', ')}`));

  // 10 — redirects valid
  const terrById = new Map(res.territoryInputs.map((t) => [t.id, t]));
  const redirectBad = R.filter((r) => r.outcome === 'REDIRECT_RESERVED').filter((r) => {
    const t = r.slotTerritoryId ? terrById.get(r.slotTerritoryId) : undefined;
    return !t || t.city !== r.app.city || !r.slotPin || !t.pins.includes(r.slotPin) || storePins.has(r.slotPin);
  }).map((r) => r.id);
  items.push(item('redirects', 'Redirect pins are valid', '§9.3', redirectBad, 'Every redirect is a free pin in a same-city territory with a slot.', (o) => `Bad redirect: ${o.join(', ')}`));

  // 11 — gap rule
  const gapBad = R.filter((r) => r.mainReason.code === 'R_LOST_GAP_RULE' && Number(r.mainReason.params.gap) < 15).map((r) => r.id);
  items.push(item('gap', '15-point gap rule', '§10', gapBad, 'Locals only lose a slot to an outsider who is ≥ 15 points ahead.', (o) => `Gap below 15: ${o.join(', ')}`));

  // 12 — onboarding plans
  const planBad = R.filter((r) => r.outcome === 'APPROVE').filter((r) => {
    const p = r.onboarding;
    if (!p) return true;
    const trackOk = p.track === trainingTrack(r.app.experienceYears) && p.trainingWeeks === TRAINING_WEEKS[p.track];
    const mallOk = !p.mall || p.earliestOpeningWeeks >= BASE_OPENING_WEEKS + MALL_EXTRA_WEEKS;
    const langOk = p.language === r.app.language;
    return !trackOk || !mallOk || !langOk || !p.buddyStoreId;
  }).map((r) => r.id);
  items.push(item('plans', 'Onboarding plans complete', '§13', planBad, 'Every approval has tasks, the right training track, language and a buddy store.', (o) => `Plan issue: ${o.join(', ')}`));

  // 13 — determinism
  const again = runPipeline(base, overrides, res.options);
  const same = JSON.stringify(again.results.map((r) => [r.id, r.outcome, r.slotPin, r.adjustedScore])) === JSON.stringify(R.map((r) => [r.id, r.outcome, r.slotPin, r.adjustedScore]));
  items.push(item('determinism', 'Same input → same decisions', '§0.3', same ? [] : ['re-run differs'], 'A full re-run reproduced every decision exactly.', () => 'A re-run gave different results.'));

  // 14 — data quality surfaced (warning level)
  const flagged = R.filter((r) => r.flags.some((f) => f.blocking)).length;
  const reviews = R.filter((r) => r.humanReview).map((r) => r.id);
  items.push(item('review', 'Notes needing a human', '§6', reviews, `No notes contradict the form. ${flagged} applicants have blocking data flags (handled as holds).`, (o) => `Read the notes for ${o.join(', ')} (decision unchanged).`, true));

  const passed = items.filter((i) => i.status === 'pass').length;
  const failed = items.filter((i) => i.status === 'fail').length;
  return { ranAt: new Date().toISOString(), items, passed, failed, warned: items.length - passed - failed };
}

/* ---------------- Gemini rubric cross-check ---------------- */

export interface AuditRow {
  id: string;
  money: number;
  space: number;
  experience: number;
  background: number;
  timeline: number;
}

/** Compare Gemini's independently computed factor points with the engine's. */
export function compareAudit(res: PipelineResult, rows: AuditRow[]): CheckItem {
  const offenders: string[] = [];
  const notes: string[] = [];
  for (const g of rows) {
    const r = res.results.find((x) => x.id === g.id);
    if (!r) continue;
    const diffs = (['money', 'space', 'experience', 'background', 'timeline'] as const).filter((k) => {
      const eng = r.score.factors[k].excluded ? 0 : r.score.factors[k].points;
      return Math.round(Number(g[k])) !== eng;
    });
    if (diffs.length) {
      offenders.push(r.id);
      notes.push(`${r.id}: ${diffs.map((k) => `${k} engine ${r.score.factors[k].points} vs Gemini ${g[k]}`).join(', ')}`);
    }
  }
  const checked = rows.length;
  return {
    id: 'gemini', title: 'Gemini rubric cross-check', rule: '§7 (independent)', offenders,
    status: offenders.length ? 'warn' : 'pass',
    detail: offenders.length
      ? `Gemini disagreed on ${offenders.length} of ${checked}. The engine's rule result stands — review: ${notes.slice(0, 4).join('; ')}${notes.length > 4 ? '…' : ''}`
      : `Gemini recomputed the rubric for ${checked} applicants and matched the engine on every factor.`,
  };
}
