import { motion } from 'framer-motion';
import { MapPin, TriangleAlert, X } from 'lucide-react';
import { ChartCard, DataTable } from '@/components/data';
import { Tooltip } from '@/components/ui/overlay';
import { ONBOARDING_STEPS, type City, type OnboardingStep } from '@/engine/types';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { useFilters } from '@/store/filters';

type Row = ApplicantRow & { decision: ApplicantRow['decision'] & { onboarding: NonNullable<ApplicantRow['decision']['onboarding']> } };

const SHORT: Record<OnboardingStep, string> = {
  Agreement: 'Agreement',
  'Space ready': 'Space ready',
  'Fit-out': 'Fit-out',
  Training: 'Training',
  'Stock & systems': 'Stock & systems',
  'Soft launch': 'Soft launch',
  Open: 'Open',
};

/**
 * The whole onboarding journey at a glance: one circle per stage, sized by how many partners
 * are there right now. Click a circle to focus the list below on that stage.
 */
export function StageJourney({ rows, step, onPick, riskOf }: {
  rows: Row[];
  step: OnboardingStep | null;
  onPick: (s: OnboardingStep | null) => void;
  riskOf: (r: Row) => string | null;
}) {
  const counts = ONBOARDING_STEPS.map((s) => rows.filter((r) => r.decision.onboarding.current === s));
  const max = Math.max(1, ...counts.map((c) => c.length));
  const MAX_D = 96;
  const MIN_D = 30;

  return (
    <ChartCard
      title="Where partners are now"
      info="Each circle is an onboarding stage; its size is how many partners are at that stage today. Click a circle to filter the list."
      actions={
        step && (
          <button type="button" onClick={() => onPick(null)} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-fg hover:bg-brand/15 focus-ring">
            {step} <X className="h-3 w-3" />
          </button>
        )
      }
      table={<DataTable columns={['Stage', 'Partners', 'At risk']} rows={ONBOARDING_STEPS.map((s, i) => [s, counts[i].length, counts[i].filter((r) => riskOf(r)).length])} />}
    >
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <ol className="relative flex min-w-[640px] items-start justify-between pt-2" aria-label="Onboarding stages by number of partners">
          {/* connector track with a gentle flowing dash */}
          <svg className="pointer-events-none absolute left-[7%] right-[7%] top-[56px] h-1 w-[86%] overflow-visible" aria-hidden>
            <line x1="0" y1="2" x2="100%" y2="2" className="stroke-border" strokeWidth={2} />
            <motion.line
              x1="0"
              y1="2"
              x2="100%"
              y2="2"
              className="stroke-brand/50"
              strokeWidth={2}
              strokeDasharray="4 10"
              animate={{ strokeDashoffset: [0, -28] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          </svg>
          {ONBOARDING_STEPS.map((s, i) => {
            const list = counts[i];
            const n = list.length;
            const risky = list.filter((r) => riskOf(r)).length;
            const d = n ? MIN_D + (MAX_D - MIN_D) * Math.sqrt(n / max) : 22;
            const active = step === s;
            const dim = step !== null && !active;
            const isOpen = s === 'Open';
            return (
              <li key={s} className="relative z-[1] flex w-[14%] flex-col items-center text-center">
                <div className="flex h-[112px] items-center justify-center">
                  <Tooltip
                    content={
                      n ? (
                        <div>
                          <div className="mb-1 font-semibold">
                            {s} · {n} partner{n > 1 ? 's' : ''}
                          </div>
                          {list.map((r) => (
                            <div key={r.app.id} className="flex items-center justify-between gap-3 text-muted">
                              <span>{r.app.name}</span>
                              <span className="tnum">{r.app.city.replace('Hubballi-Dharwad', 'Hubballi')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        `${s}: nobody here right now`
                      )
                    }
                  >
                    <motion.button
                      type="button"
                      onClick={() => onPick(active ? null : s)}
                      aria-pressed={active}
                      aria-label={`${s}: ${n} partners${risky ? `, ${risky} at risk` : ''}`}
                      initial={{ width: 0, height: 0 }}
                      animate={{ width: d, height: d }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 18, delay: i * 0.05 }}
                      className={cn(
                        'relative flex items-center justify-center rounded-full font-semibold tnum shadow-lift focus-ring',
                        n === 0 ? 'border-2 border-dashed border-border bg-surface text-subtle shadow-none' : dim ? 'bg-raised text-subtle shadow-none' : isOpen ? 'bg-st-open text-white' : 'bg-st-onboarding text-white',
                        active && 'ring-4 ring-brand/30',
                      )}
                      style={{ fontSize: n ? Math.max(13, d / 3.2) : 11 }}
                    >
                      {n}
                      {risky > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-st-hold px-1 text-[10px] text-white ring-2 ring-surface" aria-hidden>
                          {risky}
                        </span>
                      )}
                    </motion.button>
                  </Tooltip>
                </div>
                <span className={cn('mt-1 text-xs font-medium', dim ? 'text-subtle' : 'text-fg')}>{SHORT[s]}</span>
                <span className="text-2xs text-subtle tnum">step {i + 1}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 border-t pt-3 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-st-onboarding" /> in progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-st-open" /> open
        </span>
        <span className="flex items-center gap-1.5">
          <TriangleAlert className="h-3 w-3 text-st-hold" /> number at risk
        </span>
        <span className="ml-auto">Bigger circle = more partners at that stage</span>
      </div>
    </ChartCard>
  );
}

/** Partners per city; click to filter (same as the global City filter). */
export function CityStrip({ rows }: { rows: Row[] }) {
  const selected = useFilters((s) => s.city);
  const toggle = useFilters((s) => s.toggle);
  const by = new Map<City, number>();
  rows.forEach((r) => by.set(r.app.city, (by.get(r.app.city) ?? 0) + 1));
  const cities = [...by.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cities.map(([, n]) => n));
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Partners by city">
      <span className="label mr-1 flex items-center gap-1">
        <MapPin className="h-3 w-3" /> By city
      </span>
      {cities.map(([city, n]) => {
        const on = selected.includes(city);
        return (
          <button
            key={city}
            type="button"
            onClick={() => toggle('city', city)}
            aria-pressed={on}
            className={cn(
              'relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-full border pl-3 pr-2.5 text-xs font-medium transition-all focus-ring',
              on ? 'border-brand/50 bg-brand-soft text-fg' : 'bg-surface text-muted hover:text-fg hover:shadow-soft',
              selected.length > 0 && !on && 'opacity-50',
            )}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 bg-brand/10" style={{ width: `${(n / max) * 100}%` }} />
            <span className="relative">{city.replace('Hubballi-Dharwad', 'Hubballi')}</span>
            <span className="relative rounded-full bg-raised px-1.5 text-2xs tnum">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
