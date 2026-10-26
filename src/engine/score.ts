/** Step 5 — fit score out of 100 on five factors (Build Spec §7). Every factor is scored for every applicant. */
import {
  BACKGROUND_KEYWORDS, BACKGROUND_POINTS, EXPERIENCE_BANDS, FACTOR_MAX, FLOOR_POINTS, MONEY_BANDS, OWNERSHIP_POINTS,
  REALISTIC_MIN_MONTHS_NO_SPACE, REALISTIC_MIN_MONTHS_WITH_SPACE, SIZE_POINTS, SPACE_SIZE, TIER_MIN_INVESTMENT, TIMELINE_LONG_MONTHS,
  TIMELINE_POINTS, type FactorKey,
} from '@/config';
import { hasSpace, makeFlag, tierOf } from './flags';
import type { BackgroundCategory, FactorScore, Flag, ScoreCard, SizeBand, Warning } from './model';
import type { Application } from './types';

const SPACE_EXCLUDING = new Set(['F_NO_SPACE', 'F_SPACE_TOO_SMALL', 'F_SIZE_MISSING', 'F_FLOOR_UNKNOWN']);
const UNUSABLE = new Set(['F_NO_SPACE', 'F_SPACE_TOO_SMALL']);

const wordRe = (k: string) => new RegExp(`(^|[^\\p{L}])${k.replace(/\s+/g, '\\s+')}(s|es)?($|[^\\p{L}])`, 'iu');

export function backgroundCategory(text: string): BackgroundCategory {
  const t = (text ?? '').trim();
  if (!t) return 'unclear';
  if (BACKGROUND_KEYWORDS.retail.some((k) => wordRe(k).test(t))) return 'retail';
  if (BACKGROUND_KEYWORDS.otherBusiness.some((k) => wordRe(k).test(t))) return 'otherBusiness';
  return 'unclear';
}

export function moneyPoints(ratio: number | null): number {
  if (ratio === null) return 0;
  return MONEY_BANDS.find((b) => ratio >= b.minRatio)?.points ?? 0;
}

export function experiencePoints(years: number | null): number {
  const y = years ?? 0;
  return EXPERIENCE_BANDS.find((b) => y >= b.minYears)?.points ?? EXPERIENCE_BANDS[EXPERIENCE_BANDS.length - 1].points;
}

export function sizeBandOf(sqft: number | null, tier: 1 | 2 | 3): SizeBand {
  if (sqft === null || sqft === 0) return null;
  const s = SPACE_SIZE[tier];
  if (sqft < s.min) return 'tooSmall';
  if (sqft < s.idealMin) return 'slightlySmall';
  if (sqft <= s.idealMax) return 'ideal';
  return 'larger';
}

export function timelinePoints(target: number | null, realisticMin: number): { points: number; warning: Warning | null } {
  if (target === null) return { points: TIMELINE_POINTS.blank, warning: null };
  if (target >= realisticMin && target <= TIMELINE_LONG_MONTHS) return { points: TIMELINE_POINTS.realistic, warning: null };
  if (target > TIMELINE_LONG_MONTHS) return { points: TIMELINE_POINTS.long, warning: null };
  if (target >= realisticMin - 1) return { points: TIMELINE_POINTS.tight, warning: { code: 'W_TIGHT_TIMELINE', params: { n: realisticMin } } };
  return { points: TIMELINE_POINTS.unrealistic, warning: { code: 'W_UNREALISTIC_TIMELINE', params: { n: realisticMin } } };
}

/**
 * Scores one application. Mutates nothing; returns the card plus the F_BACKGROUND_UNCLEAR flag when it applies.
 * `flags` are the §6 flags from computeFlags — they decide which factors are excluded.
 */
export function scoreApplication(a: Application, flags: Flag[]): { card: ScoreCard; extraFlags: Flag[] } {
  const tier = tierOf(a.city);
  const tierMin = TIER_MIN_INVESTMENT[tier];
  const codes = new Set(flags.map((f) => f.code));
  const excluded = new Set<FactorKey>(flags.filter((f) => f.blocking && f.excludes).map((f) => f.excludes!));
  const warnings: Warning[] = [];
  const extraFlags: Flag[] = [];

  // Money — 30
  const ratio = a.investmentLakh === null ? null : a.investmentLakh / tierMin;
  const money = moneyPoints(ratio);
  if (ratio !== null && ratio < 1 && ratio >= 0.7) warnings.push({ code: 'W_PAYBACK_RISK', params: { inv: a.investmentLakh!, min: tierMin } });

  // Space — 25 (whole factor 0 when missing / unusable)
  const sizeBand = hasSpace(a) ? sizeBandOf(a.spaceSqft, tier) : null;
  const spaceBlocked = [...codes].some((c) => SPACE_EXCLUDING.has(c));
  let space = 0;
  let spaceDetail = 'no usable space';
  if (!spaceBlocked && hasSpace(a)) {
    const own = OWNERSHIP_POINTS[a.space as 'Owned' | 'Rented'];
    const size = sizeBand === 'ideal' ? SIZE_POINTS.ideal : sizeBand === 'slightlySmall' ? SIZE_POINTS.slightlySmall : sizeBand === 'larger' ? SIZE_POINTS.larger : 0;
    const floor = a.floor === 'Not known' ? 0 : FLOOR_POINTS[a.floor];
    space = own + size + floor;
    spaceDetail = `${a.space} ${own} · ${a.spaceSqft} sq ft ${size} · ${a.floor} ${floor}`;
  }

  // Experience — 20
  const experience = experiencePoints(a.experienceYears);

  // Background — 15
  const bg = backgroundCategory(a.business);
  const background = BACKGROUND_POINTS[bg];
  if (bg === 'unclear') {
    extraFlags.push(makeFlag('F_BACKGROUND_UNCLEAR'));
    warnings.push({ code: 'W_BACKGROUND_UNCLEAR', params: {} });
  }

  // Timeline — 10
  const usableSpace = hasSpace(a) && ![...codes].some((c) => UNUSABLE.has(c));
  const realisticMinMonths = usableSpace ? REALISTIC_MIN_MONTHS_WITH_SPACE : REALISTIC_MIN_MONTHS_NO_SPACE;
  const tl = timelinePoints(a.launchMonths, realisticMinMonths);
  if (tl.warning) warnings.push(tl.warning);

  const raw: Record<FactorKey, { points: number; detail: string }> = {
    money: { points: money, detail: ratio === null ? 'not given' : `ratio ${ratio.toFixed(2)}` },
    space: { points: space, detail: spaceDetail },
    experience: { points: experience, detail: `${a.experienceYears ?? 0} yrs` },
    background: { points: background, detail: bg },
    timeline: { points: tl.points, detail: a.launchMonths === null ? 'not given' : `${a.launchMonths} mo (min ${realisticMinMonths})` },
  };

  const factors = Object.fromEntries(
    (Object.keys(FACTOR_MAX) as FactorKey[]).map((k) => {
      const ex = excluded.has(k);
      const f: FactorScore = { key: k, points: ex ? 0 : raw[k].points, max: FACTOR_MAX[k], excluded: ex, detail: raw[k].detail };
      return [k, f];
    }),
  ) as Record<FactorKey, FactorScore>;

  const fitScore = Object.values(factors).reduce((s, f) => s + f.points, 0);
  const assessableMax = 100 - [...excluded].reduce((s, k) => s + FACTOR_MAX[k], 0);
  const qualityPct = excluded.size === 0 ? fitScore : assessableMax > 0 ? (fitScore / assessableMax) * 100 : 0;

  return {
    card: { tier, tierMin, investmentRatio: ratio, factors, fitScore, assessableMax, qualityPct, backgroundCategory: bg, sizeBand, usableSpace, realisticMinMonths, warnings },
    extraFlags,
  };
}
