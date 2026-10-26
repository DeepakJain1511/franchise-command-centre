/** Explanations, warnings and improvement tips (Build Spec §12). Text is rendered per language from reason codes. */
import { addDays, format, parseISO } from 'date-fns';
import { EXPERIENCE_BANDS, FACTOR_MAX, FLOOR_POINTS, OWNERSHIP_POINTS, REALISTIC_MIN_MONTHS_WITH_SPACE, SIZE_POINTS, SPACE_SIZE, TIMELINE_POINTS, type FactorKey } from '@/config';
import { t, type Lang } from '@/i18n';
import type { AppResult, Flag, FlagCode, ReasonRef, Tip, Warning } from './model';

const fmt = (iso: string) => format(parseISO(iso), 'd MMM');

export interface RenderCtx {
  flags: Flag[];
  /** Reservation deadline for this applicant (R_HOLD_FIX). */
  deadline?: string | null;
  /** Deadline the gap-rule winner has to meet (R_LOST_GAP_RULE). */
  gapDate?: string | null;
}

export function renderFixes(codes: string, flags: Flag[], lang: Lang): string {
  const list = codes
    .split(',')
    .filter(Boolean)
    .map((c) => t(lang, `FX_${c.replace(/^F_/, '')}`, flags.find((f) => f.code === (c as FlagCode))?.params ?? {}));
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join('; ')}; ${list[list.length - 1]}`;
}

export function renderReason(ref: ReasonRef, lang: Lang, ctx: RenderCtx): string {
  const p: Record<string, string | number> = { ...ref.params };
  if (typeof p.fixes === 'string') p.fixes = renderFixes(p.fixes, ctx.flags, lang);
  if (typeof p.weakest === 'string') p.weakest = p.weakest.split(',').map((k) => t(lang, `FACTOR_${k}`)).join(', ');
  switch (ref.code) {
    case 'R_HOLD_FIX':
      return t(lang, 'R_HOLD_FIX', { ...p, date: ctx.deadline ? fmt(ctx.deadline) : '—' });
    case 'R_LOST_GAP_RULE':
      return t(lang, 'R_LOST_GAP_RULE', { ...p, date: ctx.gapDate ? fmt(ctx.gapDate) : '—' });
    case 'R_REDIRECT_OFFERED':
      return t(lang, `R_REDIRECT_OFFERED_${p.why}`, p);
    case 'R_RESERVATION_LAPSED':
      return t(lang, 'R_RESERVATION_LAPSED', { ...p, date: typeof p.date === 'string' ? fmt(p.date) : '—', next: t(lang, `R_RESERVATION_LAPSED_${p.kind === 'SPACE' ? 'space' : 'info'}`) });
    default:
      return t(lang, ref.code, p);
  }
}

export function renderWarning(w: Warning, lang: Lang): string {
  if (w.code === 'W_NOTES_DATE') {
    return t(lang, 'W_NOTES_DATE', { ...w.params, date: typeof w.params.date === 'string' ? fmt(w.params.date) : '', verdict: t(lang, w.params.met ? 'W_NOTES_DATE_met' : 'W_NOTES_DATE_missed') });
  }
  return t(lang, w.code, w.params);
}

export const renderTip = (tip: Tip, lang: Lang) => t(lang, tip.code, { ...tip.params, points: tip.points });

/** The two weakest factors (lowest share of their maximum), for R_LOW_SCORE. */
export function weakestFactors(r: Pick<AppResult, 'score'>): string {
  return (Object.values(r.score.factors) as Array<{ key: FactorKey; points: number; max: number }>)
    .sort((a, b) => a.points / a.max - b.points / b.max)
    .slice(0, 2)
    .map((f) => f.key)
    .join(',');
}

/** §12.4 — points gained by moving each factor to the next better band; top 3. */
export function improvementTips(r: Pick<AppResult, 'app' | 'score' | 'flags'>): Tip[] {
  const { app, score } = r;
  const tier = score.tier;
  const size = SPACE_SIZE[tier];
  const f = score.factors;
  const tips: Tip[] = [];

  if (!f.money.excluded && score.investmentRatio !== null && f.money.points < FACTOR_MAX.money) {
    tips.push({ factor: 'money', code: 'TIP_INVEST', points: FACTOR_MAX.money - f.money.points, params: { amount: score.tierMin, city: app.city } });
  }
  if (f.space.excluded || !score.usableSpace) {
    const best = OWNERSHIP_POINTS.Owned + SIZE_POINTS.ideal + FLOOR_POINTS.Ground;
    tips.push({ factor: 'space', code: 'TIP_SPACE', points: best, params: { min: size.min, city: app.city } });
  } else {
    if (app.floor === 'Upper') tips.push({ factor: 'space', code: 'TIP_GROUND_FLOOR', points: FLOOR_POINTS.Ground - FLOOR_POINTS.Upper, params: {} });
    if (score.sizeBand === 'slightlySmall' || score.sizeBand === 'larger') {
      tips.push({ factor: 'space', code: 'TIP_SIZE', points: SIZE_POINTS.ideal - SIZE_POINTS.slightlySmall, params: { from: size.idealMin, to: size.idealMax, city: app.city } });
    }
    if (app.space === 'Rented') tips.push({ factor: 'space', code: 'TIP_OWN', points: OWNERSHIP_POINTS.Owned - OWNERSHIP_POINTS.Rented, params: {} });
  }
  const years = app.experienceYears ?? 0;
  const next = [...EXPERIENCE_BANDS].reverse().find((b) => b.minYears > years);
  if (next) tips.push({ factor: 'experience', code: 'TIP_EXPERIENCE', points: next.points - f.experience.points, params: { years: next.minYears } });
  if (score.backgroundCategory !== 'retail') tips.push({ factor: 'background', code: 'TIP_BACKGROUND', points: FACTOR_MAX.background - f.background.points, params: {} });
  if (f.timeline.points < TIMELINE_POINTS.realistic) {
    tips.push({ factor: 'timeline', code: 'TIP_TIMELINE', points: TIMELINE_POINTS.realistic - f.timeline.points, params: { months: score.usableSpace ? REALISTIC_MIN_MONTHS_WITH_SPACE : score.realisticMinMonths } });
  }
  return tips.filter((x) => x.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
}

/** Warnings shown alongside the outcome (§12.2): scoring warnings + penalty + notes. */
export function collectWarnings(r: Pick<AppResult, 'score' | 'penalty' | 'flags'>, openingDate: string | null): Warning[] {
  const out: Warning[] = [...r.score.warnings.filter((w) => w.code !== 'W_BACKGROUND_UNCLEAR')];
  if (r.penalty.penalty >= 10) out.push({ code: 'W_NEARBY_STORE_VERY_CLOSE', params: { pin: r.penalty.nearestPin ?? '' } });
  else if (r.penalty.penalty > 0) out.push({ code: 'W_NEARBY_STORE', params: { pin: r.penalty.nearestPin ?? '' } });
  const nc = r.flags.find((f) => f.code === 'F_NOTES_CONTRADICTION');
  if (nc) out.push({ code: 'W_NOTES_REVIEW', params: { phrase: String(nc.params.phrase) } });
  const nd = r.flags.find((f) => f.code === 'F_NOTES_DATE');
  if (nd) {
    const met = openingDate ? openingDate <= String(nd.params.date) : false;
    out.push({ code: 'W_NOTES_DATE', params: { label: String(nd.params.label), date: String(nd.params.date), met: met ? 1 : 0 } });
  }
  if (r.score.warnings.some((w) => w.code === 'W_BACKGROUND_UNCLEAR')) out.push({ code: 'W_BACKGROUND_UNCLEAR', params: {} });
  return out;
}

export const plusDaysIso = (iso: string, n: number) => format(addDays(parseISO(iso), n), 'yyyy-MM-dd');
