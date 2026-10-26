import { motion } from 'framer-motion';
import type { FactorKey } from '@/config';
import type { AppResult } from '@/engine/model';
import { t, type Lang } from '@/i18n';
import { cn } from '@/lib/cn';

const KEYS: FactorKey[] = ['money', 'space', 'experience', 'background', 'timeline'];

/** Spec §12.3: Money x/30 · Space x/25 · Experience x/20 · Background x/15 · Timeline x/10 · Nearby store −x · Total · Bar. */
export function ScoreBreakdown({ r, lang = 'en', compact }: { r: AppResult; lang?: Lang; compact?: boolean }) {
  const total = Math.round(r.adjustedPct);
  const above = r.adjustedPct >= r.bar;
  const flagged = r.score.assessableMax < 100;
  return (
    <div className="space-y-2" aria-label={t(lang, 'UI_SCORE')}>
      <ul className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {KEYS.map((k, i) => {
          const f = r.score.factors[k];
          const share = f.points / f.max;
          return (
            <li key={k} className="rounded-md border px-2.5 py-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-muted">{t(lang, `FACTOR_${k}`)}</span>
                {f.excluded ? (
                  <span className="text-2xs italic text-st-needs">{t(lang, 'EXCLUDED')}</span>
                ) : (
                  <span className="font-semibold tnum">
                    {f.points}
                    <span className="font-normal text-subtle">/{f.max}</span>
                  </span>
                )}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                <motion.div
                  className={cn('h-full rounded-full', f.excluded ? 'bg-st-needs/40' : share >= 0.8 ? 'bg-st-approved' : share >= 0.5 ? 'bg-st-hold' : 'bg-st-rejected')}
                  initial={{ width: 0 }}
                  animate={{ width: `${f.excluded ? 100 : share * 100}%` }}
                  transition={{ duration: 0.45, delay: i * 0.04 }}
                />
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
          <span className="font-medium text-muted">{t(lang, 'PENALTY')}</span>
          <span className={cn('font-semibold tnum', r.penalty.penalty ? 'text-st-rejected' : 'text-subtle')}>
            {r.penalty.penalty ? `−${r.penalty.penalty}` : '0'}
            {r.penalty.nearestPin && r.penalty.penalty > 0 && <span className="ml-1 font-normal text-subtle">· {r.penalty.nearestPin}</span>}
          </span>
        </li>
      </ul>
      <div className="relative rounded-md bg-raised/60 px-3 py-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold">
            {t(lang, 'TOTAL')} <span className="text-base tnum">{total}</span>
            {flagged && <span className="ml-1 font-normal text-subtle tnum">({r.score.fitScore}/{r.score.assessableMax} scored)</span>}
          </span>
          <span className={cn('font-medium tnum', above ? 'text-st-approved' : 'text-st-rejected')}>
            {t(lang, 'BAR')} {r.bar}
          </span>
        </div>
        <div className="relative mt-1.5 h-2 rounded-full bg-surface">
          <div className={cn('h-full rounded-full', above ? 'bg-st-approved' : 'bg-st-hold')} style={{ width: `${Math.max(0, Math.min(100, r.adjustedPct))}%` }} />
          <span className="absolute -top-1 h-4 w-0.5 rounded bg-fg/70" style={{ left: `${r.bar}%` }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
