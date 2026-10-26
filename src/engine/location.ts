/** Location rules (Build Spec §9): territory matching, cannibalisation, redirect pins, demand signal. */
import { CANNIBAL_PENALTY, PRIORITY_ORDER, STRONG_LINE } from '@/config';
import { isValidPin } from './flags';
import type { PenaltyInfo } from './model';
import type { City, Territory } from './types';

export interface StoreRef {
  city: City;
  pin: string;
  /** ST-xx for existing stores, APP-xxx for slots awarded earlier in the run. */
  id: string;
}

/** pin → territory. A pin listed in more than one territory uses the first; duplicates are reported. */
export function buildPinToTerritory(territories: Territory[]): { map: Map<string, Territory>; duplicates: Array<{ pin: string; ids: string[] }> } {
  const map = new Map<string, Territory>();
  const seen = new Map<string, string[]>();
  for (const t of territories) {
    for (const pin of t.pins) {
      seen.set(pin, [...(seen.get(pin) ?? []), t.id]);
      if (!map.has(pin)) map.set(pin, t);
    }
  }
  const duplicates = [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([pin, ids]) => ({ pin, ids }));
  return { map, duplicates };
}

const pinNum = (p: string) => (isValidPin(p) ? Number(p) : NaN);

/** Penalty against the nearest store in the same city. diff 0 = blocked (G2). Different cities never interact. */
export function penaltyFor(city: City, pin: string, stores: StoreRef[]): PenaltyInfo {
  const n = pinNum(pin);
  if (Number.isNaN(n)) return { penalty: 0, blocked: false, nearestPin: null, nearestStoreId: null, diff: null };
  let best: { s: StoreRef; diff: number } | null = null;
  for (const s of stores) {
    if (s.city !== city) continue;
    const d = Math.abs(n - pinNum(s.pin));
    if (Number.isNaN(d)) continue;
    if (!best || d < best.diff || (d === best.diff && s.id < best.s.id)) best = { s, diff: d };
  }
  if (!best) return { penalty: 0, blocked: false, nearestPin: null, nearestStoreId: null, diff: null };
  if (best.diff === 0) return { penalty: 0, blocked: true, nearestPin: best.s.pin, nearestStoreId: best.s.id, diff: 0 };
  const band = CANNIBAL_PENALTY.find((b) => best!.diff <= b.maxDiff);
  return { penalty: band?.penalty ?? 0, blocked: false, nearestPin: best.s.pin, nearestStoreId: best.s.id, diff: best.diff };
}

export interface RedirectCandidate {
  pin: string;
  territory: Territory;
  penalty: number;
  distance: number;
}

/**
 * Best redirect pin for a strong outsider (§9.3). Candidates: same-city territory with slots remaining,
 * pin not a store and not claimed, preferably not requested by a waiting local applicant.
 */
export function bestRedirectPin(args: {
  city: City;
  applicantPin: string;
  territories: Territory[];
  remainingSlots: (territoryId: string) => number;
  claimedPins: Set<string>;
  stores: StoreRef[];
  requestedByWaitingLocals: Set<string>;
  /** Optional: restrict to one territory (used when filling that territory's slot). */
  onlyTerritoryId?: string;
}): RedirectCandidate | null {
  const ap = pinNum(args.applicantPin);
  const all: RedirectCandidate[] = [];
  for (const t of args.territories) {
    if (t.city !== args.city) continue;
    if (args.onlyTerritoryId && t.id !== args.onlyTerritoryId) continue;
    if (args.remainingSlots(t.id) <= 0) continue;
    for (const pin of t.pins) {
      if (args.claimedPins.has(pin)) continue;
      const p = penaltyFor(args.city, pin, args.stores);
      if (p.blocked) continue;
      const d = Number.isNaN(ap) ? Number.POSITIVE_INFINITY : Math.abs(pinNum(pin) - ap);
      all.push({ pin, territory: t, penalty: p.penalty, distance: d });
    }
  }
  const free = all.filter((c) => !args.requestedByWaitingLocals.has(c.pin));
  const pool = free.length ? free : all;
  pool.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.penalty - b.penalty ||
      PRIORITY_ORDER.indexOf(a.territory.priority) - PRIORITY_ORDER.indexOf(b.territory.priority) ||
      Number(a.pin) - Number(b.pin),
  );
  return pool[0] ?? null;
}

/**
 * Demand signal (§9.4): ≥2 strong applicants outside all territories in the same city with pins within 10
 * of each other → "consider adding it to a territory".
 */
export function demandSignals(
  outsiders: Array<{ id: string; city: City; pin: string; pct: number }>,
): Array<{ city: City; pin: string; ids: string[] }> {
  const strong = outsiders.filter((o) => o.pct >= STRONG_LINE && isValidPin(o.pin));
  const out: Array<{ city: City; pin: string; ids: string[] }> = [];
  const used = new Set<string>();
  for (const o of strong) {
    if (used.has(o.id)) continue;
    const group = strong.filter((x) => x.city === o.city && Math.abs(Number(x.pin) - Number(o.pin)) <= 10);
    if (group.length >= 2) {
      group.forEach((g) => used.add(g.id));
      out.push({ city: o.city, pin: o.pin, ids: group.map((g) => g.id) });
    }
  }
  return out;
}
