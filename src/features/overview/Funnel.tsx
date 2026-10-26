import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChartCard, ChartSkeleton, DataTable, EmptyState } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlay';
import { useFilteredApplicants } from '@/engine/hooks';
import type { Stage } from '@/engine/types';
import { asOf, countBy } from '@/lib/aggregate';
import { cn } from '@/lib/cn';
import { reachedStage, type ApplicantRow } from '@/lib/filtering';
import { pct } from '@/lib/format';
import { useFilters, type ListKey } from '@/store/filters';

const STEPS: Array<{ stage: Stage; label: string; bar: string }> = [
  { stage: 'Applied', label: 'Applied', bar: 'bg-fg/70' },
  { stage: 'Screened', label: 'Screened', bar: 'bg-st-waitlisted' },
  { stage: 'Approved', label: 'Approved', bar: 'bg-st-approved' },
  { stage: 'In onboarding', label: 'In onboarding', bar: 'bg-st-onboarding' },
  { stage: 'Open', label: 'Store open', bar: 'bg-st-open' },
];
const IGNORE: ListKey[] = ['stage'];

function dropReasons(rows: ApplicantRow[], idx: number): Array<{ label: string; n: number }> {
  const here = STEPS[idx].stage;
  const next = STEPS[idx + 1]?.stage;
  if (!next) {
    const by = countBy(rows.filter((r) => reachedStage(here, r.decision)), (r) => r.app.city);
    return Object.entries(by).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 3);
  }
  const dropped = rows.filter((r) => reachedStage(here, r.decision) && !reachedStage(next, r.decision));
  const by = countBy(dropped, (r) => {
    if (here === 'Approved') return 'Agreement pending';
    if (here === 'In onboarding') return r.decision.onboarding?.current ?? 'In progress';
    return r.decision.dropReason ?? 'Other';
  });
  return Object.entries(by).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 3);
}

export function Funnel() {
  const q = useFilteredApplicants(IGNORE);
  const selected = useFilters((s) => s.stage);
  const only = useFilters((s) => s.only);
  const reset = useFilters((s) => s.reset);
  const navigate = useNavigate();

  const rows = q.data ?? [];
  const prev = asOf(rows);
  const counts = STEPS.map((s) => rows.filter((r) => reachedStage(s.stage, r.decision)).length);
  const prevCounts = STEPS.map((s) => prev.filter((r) => reachedStage(s.stage, r.decision)).length);
  const max = Math.max(counts[0], 1);
  const activeIdx = STEPS.findIndex((s) => selected.length === 1 && selected[0] === s.stage);
  const reasons = activeIdx >= 0 ? dropReasons(rows, activeIdx) : [];
  const reasonMax = Math.max(1, ...reasons.map((r) => r.n));

  const drill = (s: Stage) => navigate(`/applicants?stage=${encodeURIComponent(s)}`);

  return (
    <ChartCard
      title="Pipeline funnel"
      info="How many applicants reached each stage. Click a stage to filter; double-click to list them."
      className="lg:col-span-7"
      onDrill={() => drill(activeIdx >= 0 ? STEPS[activeIdx].stage : 'Applied')}
      drillLabel="List applicants"
      table={
        <DataTable
          columns={['Stage', 'Count', '% of applied', 'Δ 4 wks']}
          rows={STEPS.map((s, i) => [s.label, counts[i], pct(counts[i] / max), `${counts[i] - prevCounts[i] >= 0 ? '+' : ''}${counts[i] - prevCounts[i]}`])}
        />
      }
    >
      {!q.data ? (
        <ChartSkeleton className="h-56" />
      ) : rows.length === 0 ? (
        <EmptyState onReset={reset} />
      ) : (
        <div className="flex gap-4">
          <ol className="flex min-w-0 flex-1 flex-col gap-1.5 pt-2" aria-label="Funnel stages">
            {STEPS.map((s, i) => {
              const conv = i === 0 ? null : counts[i - 1] ? counts[i] / counts[i - 1] : 0;
              const dim = activeIdx >= 0 && activeIdx !== i;
              const d = counts[i] - prevCounts[i];
              return (
                <li key={s.stage}>
                  <Tooltip
                    content={
                      <span className="tnum">
                        <b>{s.label}</b> · {counts[i]} · {pct(counts[i] / max)} of applied · {d >= 0 ? '+' : ''}
                        {d} vs 4 wks ago
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => only('stage', s.stage)}
                      onDoubleClick={() => drill(s.stage)}
                      aria-pressed={activeIdx === i}
                      aria-label={`${s.label}: ${counts[i]}. Click to filter, double-click to list.`}
                      className={cn('group grid w-full grid-cols-[108px_1fr_44px] items-center gap-3 rounded-md px-1 py-0.5 text-left transition-opacity duration-200 focus-ring', dim && 'opacity-35')}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-muted group-hover:text-fg">{s.label}</span>
                        {conv !== null && <span className="block text-[10px] text-subtle tnum">{pct(conv)} of prev.</span>}
                      </span>
                      <span className="relative flex h-9 items-center justify-center">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(4, (counts[i] / max) * 100)}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                          className={cn('h-full rounded-[10px] opacity-90 transition-all group-hover:opacity-100', s.bar, activeIdx === i && 'ring-2 ring-brand/50 ring-offset-2 ring-offset-surface')}
                        />
                      </span>
                      <span className="text-right text-lg font-semibold tnum">{counts[i]}</span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
          <AnimatePresence>
            {activeIdx >= 0 && (
              <motion.aside
                initial={{ opacity: 0, x: 12, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 200 }}
                exit={{ opacity: 0, x: 12, width: 0 }}
                transition={{ duration: 0.2 }}
                className="hidden shrink-0 overflow-hidden border-l pl-4 sm:block"
                aria-label="Top reasons at this stage"
              >
                <div className="flex items-center justify-between">
                  <span className="label">{STEPS[activeIdx + 1] ? 'Why they stop here' : 'Where they opened'}</span>
                  <button type="button" onClick={() => only('stage', STEPS[activeIdx].stage)} className="text-subtle hover:text-fg focus-ring" aria-label="Close panel">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {reasons.length === 0 && <li className="text-xs text-subtle">Nobody stops here</li>}
                  {reasons.map((r) => (
                    <li key={r.label}>
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{r.label}</span>
                        <span className="font-semibold tnum">{r.n}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-raised">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(r.n / reasonMax) * 100}%` }} className="h-full rounded-full bg-brand/70" />
                      </div>
                    </li>
                  ))}
                </ul>
                <Button variant="link" size="sm" className="mt-3 text-xs" onClick={() => drill(STEPS[activeIdx].stage)}>
                  List them <ArrowRight />
                </Button>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}
    </ChartCard>
  );
}
