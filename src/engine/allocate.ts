/**
 * Step 7 — slot allocation (Build Spec §8, §10). Follows the spec's pseudo-code:
 * pre-classification → slot filling by territory priority (local priority, 15-point gap rule,
 * one store per pin, penalties recomputed after every award) → leftovers → queues.
 */
import { APPROVAL_BAR, GAP_RULE_POINTS, MONEY_HARD_FLOOR_RATIO, PRIORITY_ORDER, REJECT_LINE, STRONG_LINE, type PriorityKey, type TierNum } from '@/config';
import { bestRedirectPin, penaltyFor, type StoreRef } from './location';
import type { Flag, HoldType, OutcomeCode, PenaltyInfo, ReasonRef, ScoreCard, WaitlistType } from './model';
import type { Application, Territory } from './types';

export interface Prepared {
  id: string;
  app: Application;
  tier: TierNum;
  flags: Flag[];
  blocking: boolean;
  holdDays: number | null;
  card: ScoreCard;
}

export interface Forced {
  outcome: OutcomeCode;
  waitlistType: WaitlistType | null;
  holdType: HoldType | null;
  main: ReasonRef;
}

export interface Allocated {
  id: string;
  territoryId: string | null;
  bar: number;
  priority: PriorityKey | null;
  penalty: PenaltyInfo;
  adjustedScore: number;
  adjustedPct: number;
  outcome: OutcomeCode;
  waitlistType: WaitlistType | null;
  holdType: HoldType | null;
  mainReason: ReasonRef;
  otherReasons: ReasonRef[];
  slotPin: string | null;
  slotTerritoryId: string | null;
  slotRank: number | null;
  queuePosition: number | null;
  competitors: string[];
  decidedBy: string | null;
  origin: 'local' | 'outside' | 'hasStore' | 'pinTaken';
  futureLead: boolean;
  lostGap: { to: string; gap: number } | null;
}

export interface AllocationOutput {
  byId: Map<string, Allocated>;
  queues: Map<string, string[]>;
}

const r = (code: ReasonRef['code'], params: ReasonRef['params'] = {}): ReasonRef => ({ code, params });
const round = (n: number) => Math.round(n);

interface Cand extends Prepared {
  T: Territory | null;
  bar: number;
  origin: Allocated['origin'];
  penalty: PenaltyInfo;
  adjScore: number;
  adjPct: number;
  decided: boolean;
  res: Partial<Allocated>;
  targetPin?: string;
  targetT?: Territory;
  outsiderAdj?: number;
  lostGap: { to: string; gap: number } | null;
}

/** Tie rules (§10.1): adjusted score → investment ratio → experience → lower Application ID. */
function tieCompare(scoreA: number, a: Cand, scoreB: number, b: Cand) {
  return (
    scoreB - scoreA ||
    (b.card.investmentRatio ?? 0) - (a.card.investmentRatio ?? 0) ||
    (b.app.experienceYears ?? 0) - (a.app.experienceYears ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

const fixesOf = (c: Prepared) => c.flags.filter((f) => f.blocking).map((f) => f.code).join(',');

export function allocate(input: {
  prepared: Prepared[];
  territories: Territory[];
  existingStores: StoreRef[];
  pinToTerritory: Map<string, Territory>;
  forced: Map<string, Forced>;
}): AllocationOutput {
  const { territories, existingStores, pinToTerritory, forced } = input;
  const stores: StoreRef[] = [...existingStores];
  const storePins = new Set(existingStores.map((s) => s.pin));
  const claimedPins = new Set(storePins);
  const awardedCount = new Map<string, number>();
  const tById = new Map(territories.map((t) => [t.id, t]));

  const cands: Cand[] = input.prepared.map((p) => {
    const T = pinToTerritory.get(p.app.pin) ?? null;
    const pen = penaltyFor(p.app.city, p.app.pin, stores);
    return {
      ...p, T, bar: T ? APPROVAL_BAR[T.priority] : STRONG_LINE, origin: 'local', penalty: pen,
      adjScore: p.card.fitScore - pen.penalty, adjPct: p.card.qualityPct - pen.penalty, decided: false, res: {}, lostGap: null,
    };
  });

  const decide = (c: Cand, outcome: OutcomeCode, main: ReasonRef, extra: Partial<Allocated> = {}) => {
    c.decided = true;
    c.res = { ...c.res, outcome, mainReason: main, waitlistType: null, holdType: null, ...extra };
  };
  const recompute = (c: Cand, pin = c.app.pin) => {
    c.penalty = penaltyFor(c.app.city, pin, stores);
    c.adjScore = c.card.fitScore - c.penalty.penalty;
    c.adjPct = c.card.qualityPct - c.penalty.penalty;
  };

  const localPool = new Map<string, Cand[]>(territories.map((t) => [t.id, []]));
  const outsiderPool: Cand[] = [];

  /* ---------------- Pre-classification ---------------- */
  for (const c of cands) {
    const f = forced.get(c.id);
    if (f) {
      decide(c, f.outcome, f.main, { waitlistType: f.waitlistType, holdType: f.holdType });
      continue;
    }
    const others: ReasonRef[] = [];
    const locationFail = !c.T || storePins.has(c.app.pin);
    const g1 = !c.T;
    const g2 = !g1 && storePins.has(c.app.pin);
    const g3 = c.card.investmentRatio !== null && c.card.investmentRatio < MONEY_HARD_FLOOR_RATIO;
    const locReason = g1 ? r('R_OUTSIDE_TERRITORY', { pin: c.app.pin }) : r('R_PIN_HAS_STORE', { pin: c.app.pin });

    if (g3) {
      // G3 always rejects. Main reason by severity G1 → G2 → G3 → G4.
      const money = r('R_MONEY_BELOW_FLOOR', {
        inv: c.app.investmentLakh ?? 0, min: c.card.tierMin, city: c.app.city, floor: round(c.card.tierMin * MONEY_HARD_FLOOR_RATIO * 10) / 10,
      });
      const main = g1 || g2 ? locReason : money;
      if (g1 || g2) others.push(money);
      if (c.blocking) others.push(r('R_HOLD_NO_RESERVATION', { fixes: fixesOf(c) }));
      decide(c, 'REJECT', main, { otherReasons: others, futureLead: g1, decidedBy: 'G3 money floor' });
      continue;
    }
    if (locationFail) {
      if (c.adjPct >= STRONG_LINE) {
        c.origin = g1 ? 'outside' : 'hasStore';
        c.bar = STRONG_LINE;
        outsiderPool.push(c);
      } else {
        if (c.blocking) others.push(r('R_HOLD_NO_RESERVATION', { fixes: fixesOf(c) }));
        decide(c, 'REJECT', locReason, { otherReasons: others, futureLead: g1, decidedBy: g1 ? 'G1 pin outside territories' : 'G2 pin has a store' });
      }
      continue;
    }
    const T = c.T!;
    if (c.blocking) {
      if (c.adjPct >= c.bar) localPool.get(T.id)!.push(c);
      else decide(c, 'REJECT', r('R_FLAGGED_WEAK', { fixes: fixesOf(c), pct: round(c.adjPct), bar: c.bar }), { decidedBy: 'Rest-of-application rule' });
    } else if (c.adjPct < REJECT_LINE) {
      decide(c, 'REJECT', r('R_LOW_SCORE', { score: round(c.adjPct) }), { decidedBy: 'Below reject line 45' });
    } else if (c.adjPct < c.bar) {
      decide(c, 'WAITLIST', r('R_BELOW_BAR', { score: round(c.adjPct), bar: c.bar, territory: T.id, priority: T.priority }), {
        waitlistType: 'BELOW_BAR', decidedBy: `Below ${T.priority} bar ${c.bar}`,
      });
    } else {
      localPool.get(T.id)!.push(c);
    }
  }

  /* ---------------- Slot filling ---------------- */
  const remaining = (tid: string) => (tById.get(tid)?.openSlots ?? 0) - (awardedCount.get(tid) ?? 0);
  const waitingLocalPins = () => {
    const s = new Set<string>();
    localPool.forEach((list) => list.filter((l) => !l.decided).forEach((l) => s.add(l.app.pin)));
    return s;
  };
  const competitorsOf = new Map<string, Set<string>>(territories.map((t) => [t.id, new Set<string>()]));

  const award = (c: Cand, pin: string, T: Territory, rule: string, outsider: boolean) => {
    claimedPins.add(pin);
    stores.push({ city: c.app.city, pin, id: c.id });
    awardedCount.set(T.id, (awardedCount.get(T.id) ?? 0) + 1);
    const rank = awardedCount.get(T.id)!;
    const comps = [...competitorsOf.get(T.id)!].filter((x) => x !== c.id);
    const base = { slotPin: pin, slotTerritoryId: T.id, slotRank: rank, competitors: comps, decidedBy: rule };
    if (outsider) {
      const why = c.origin === 'outside' ? 'outside' : c.origin === 'hasStore' ? 'hasStore' : 'taken';
      decide(c, 'REDIRECT_RESERVED', r('R_REDIRECT_OFFERED', { pin: c.app.pin, why, score: round(c.adjPct), newPin: pin, city: c.app.city }), {
        ...base, holdType: 'REDIRECT',
        otherReasons: c.blocking ? [r('R_HOLD_NO_RESERVATION', { fixes: fixesOf(c) })] : [],
      });
    } else if (c.blocking) {
      decide(c, 'HOLD_RESERVED', r('R_HOLD_FIX', { fixes: fixesOf(c), days: c.holdDays ?? 0 }), {
        ...base, holdType: (c.holdDays ?? 0) >= 30 ? 'SPACE' : 'INFO',
      });
    } else {
      decide(c, 'APPROVE', r('R_WON_SLOT', { score: round(c.adjPct), rank, n: comps.length + 1, territory: T.id, slots: T.openSlots }), base);
    }
  };

  /** §10 refresh: pin taken by another applicant, or a new nearby store pushed the score under the bar. */
  const refreshLocals = (T: Territory) => {
    for (const L of [...localPool.get(T.id)!]) {
      if (L.decided) continue;
      if (claimedPins.has(L.app.pin)) {
        if (L.card.qualityPct >= STRONG_LINE) {
          // Strong: leaves the local pool and takes the redirect path.
          L.origin = 'pinTaken';
          L.bar = STRONG_LINE;
          outsiderPool.push(L);
          localPool.set(T.id, localPool.get(T.id)!.filter((x) => x !== L));
        } else {
          decide(L, 'WAITLIST', r('R_PIN_TAKEN', { pin: L.app.pin }), { waitlistType: 'PIN_TAKEN', decidedBy: 'One store per pin' });
        }
        continue;
      }
      recompute(L);
      if (L.adjPct < L.bar) {
        decide(L, 'WAITLIST', r('R_BELOW_BAR', { score: round(L.adjPct), bar: L.bar, territory: T.id, priority: T.priority }), {
          waitlistType: 'BELOW_BAR', decidedBy: 'New nearby store lowered score',
          otherReasons: [r('R_NEARBY_STORE_LOWERED', { pin: L.penalty.nearestPin ?? '', id: L.penalty.nearestStoreId ?? '' })],
        });
      }
    }
  };

  const outsiderCandidatesFor = (T: Territory): Cand[] => {
    const locals = waitingLocalPins();
    const out: Cand[] = [];
    for (const o of outsiderPool) {
      if (o.decided || o.app.city !== T.city) continue;
      const best = bestRedirectPin({
        city: o.app.city, applicantPin: o.app.pin, territories, remainingSlots: remaining, claimedPins, stores, requestedByWaitingLocals: locals,
      });
      if (!best || best.territory.id !== T.id) continue;
      o.targetPin = best.pin;
      o.targetT = best.territory;
      o.outsiderAdj = o.card.fitScore - best.penalty;
      out.push(o);
    }
    return out.sort((a, b) => tieCompare(a.outsiderAdj!, a, b.outsiderAdj!, b));
  };

  const ordered = [...territories].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.id.localeCompare(b.id));

  for (const T of ordered) {
    localPool.get(T.id)!.forEach((l) => competitorsOf.get(T.id)!.add(l.id));
    while (remaining(T.id) > 0) {
      refreshLocals(T);
      const locals = localPool.get(T.id)!.filter((l) => !l.decided).sort((a, b) => tieCompare(a.adjScore, a, b.adjScore, b));
      const bestLocal = locals[0];
      const outs = outsiderCandidatesFor(T);
      outs.forEach((o) => competitorsOf.get(T.id)!.add(o.id));
      const bestOutsider = outs[0];
      if (bestLocal && (!bestOutsider || bestOutsider.outsiderAdj! < bestLocal.adjScore + GAP_RULE_POINTS)) {
        award(bestLocal, bestLocal.app.pin, T, bestOutsider ? `Local priority (gap < ${GAP_RULE_POINTS})` : 'Highest-ranked local', false);
      } else if (bestOutsider) {
        if (bestLocal) bestLocal.lostGap = { to: bestOutsider.id, gap: round(bestOutsider.outsiderAdj! - bestLocal.adjScore) };
        recompute(bestOutsider, bestOutsider.targetPin);
        award(bestOutsider, bestOutsider.targetPin!, T, bestLocal ? `Gap rule (≥ ${GAP_RULE_POINTS} points)` : 'Strong applicant redirected', true);
      } else break;
    }
    // Leftovers: refresh once more so a pin taken by the last award reads as PIN_TAKEN, not SLOTS_FULL.
    refreshLocals(T);
    for (const L of localPool.get(T.id)!) {
      if (L.decided) continue;
      const gap = L.lostGap ? r('R_LOST_GAP_RULE', { gap: L.lostGap.gap, to: L.lostGap.to }) : null;
      if (L.blocking) {
        decide(L, 'HOLD', r('R_HOLD_NO_RESERVATION', { fixes: fixesOf(L) }), {
          holdType: (L.holdDays ?? 0) >= 30 ? 'SPACE' : 'INFO', otherReasons: gap ? [gap] : [], decidedBy: 'Slots went to higher-ranked applicants',
        });
      } else {
        const full = r('R_SLOTS_FULL', { score: round(L.adjPct), territory: T.id, slots: T.openSlots, position: 0 });
        decide(L, 'WAITLIST', gap ?? full, { waitlistType: 'QUALIFIED', otherReasons: gap ? [full] : [], decidedBy: 'Slots full' });
      }
      L.res.competitors = [...competitorsOf.get(T.id)!].filter((x) => x !== L.id);
    }
  }

  // Leftover slots (no locals left anywhere in them) go to strong outsiders who still wait.
  for (const T of ordered) {
    while (remaining(T.id) > 0) {
      const outs = outsiderCandidatesFor(T);
      if (!outs.length) break;
      recompute(outs[0], outs[0].targetPin);
      award(outs[0], outs[0].targetPin!, T, 'Strong applicant redirected to a free slot', true);
    }
  }

  for (const o of outsiderPool) {
    if (o.decided) continue;
    const why = o.origin === 'outside' ? r('R_OUTSIDE_TERRITORY', { pin: o.app.pin }) : o.origin === 'hasStore' ? r('R_PIN_HAS_STORE', { pin: o.app.pin }) : r('R_PIN_TAKEN', { pin: o.app.pin });
    decide(o, 'HOLD', r('R_STRONG_NO_SLOT', { score: round(o.adjPct) }), {
      holdType: 'STRONG_WAITING', otherReasons: [why, ...(o.blocking ? [r('R_HOLD_NO_RESERVATION', { fixes: fixesOf(o) })] : [])], decidedBy: 'No free slot near the location',
    });
  }

  /* ---------------- Queues for released slots (§10.2) ---------------- */
  const queues = new Map<string, string[]>();
  const queuePos = new Map<string, number>();
  for (const T of ordered) {
    const locals = cands
      .filter((c) => c.res.outcome === 'WAITLIST' && c.res.waitlistType === 'QUALIFIED' && c.T?.id === T.id)
      .sort((a, b) => tieCompare(a.adjScore, a, b.adjScore, b));
    const outs = cands
      .filter((c) => c.res.outcome === 'HOLD' && c.res.holdType === 'STRONG_WAITING' && c.app.city === T.city)
      .map((o) => {
        const best = bestRedirectPin({
          city: o.app.city, applicantPin: o.app.pin, territories, remainingSlots: () => 1, claimedPins, stores, requestedByWaitingLocals: new Set(), onlyTerritoryId: T.id,
        });
        return best ? { o, adj: o.card.fitScore - best.penalty } : null;
      })
      .filter((x): x is { o: Cand; adj: number } => !!x)
      .sort((a, b) => tieCompare(a.adj, a.o, b.adj, b.o));
    const q: string[] = [];
    let i = 0;
    let j = 0;
    while (i < locals.length || j < outs.length) {
      const L = locals[i];
      const O = outs[j];
      if (L && (!O || O.adj < L.adjScore + GAP_RULE_POINTS)) q.push(locals[i++].id);
      else q.push(outs[j++].o.id);
    }
    queues.set(T.id, q);
    q.forEach((id, k) => {
      if (!queuePos.has(id)) queuePos.set(id, k + 1);
    });
  }

  /* ---------------- Output ---------------- */
  const out = new Map<string, Allocated>();
  for (const c of cands) {
    const pos = queuePos.get(c.id) ?? null;
    const main = c.res.mainReason!;
    const fixPos = (ref: ReasonRef) => (ref.code === 'R_SLOTS_FULL' ? { ...ref, params: { ...ref.params, position: pos ?? 0 } } : ref);
    out.set(c.id, {
      id: c.id,
      territoryId: c.T?.id ?? null,
      bar: c.bar,
      priority: c.T?.priority ?? null,
      penalty: c.penalty,
      adjustedScore: c.adjScore,
      adjustedPct: c.adjPct,
      outcome: c.res.outcome!,
      waitlistType: c.res.waitlistType ?? null,
      holdType: c.res.holdType ?? null,
      mainReason: fixPos(main),
      otherReasons: (c.res.otherReasons ?? []).map(fixPos),
      slotPin: c.res.slotPin ?? null,
      slotTerritoryId: c.res.slotTerritoryId ?? null,
      slotRank: c.res.slotRank ?? null,
      queuePosition: pos,
      competitors: c.res.competitors ?? (c.T ? [...(competitorsOf.get(c.T.id) ?? [])].filter((x) => x !== c.id) : []),
      decidedBy: c.res.decidedBy ?? null,
      origin: c.origin,
      futureLead: c.res.futureLead ?? false,
      lostGap: c.lostGap,
    });
  }
  return { byId: out, queues };
}
