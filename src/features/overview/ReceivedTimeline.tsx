import { addDays, parseISO, startOfWeek } from 'date-fns';
import { MousePointerClick, MoveHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartSkeleton, DataTable } from '@/components/data';
import { useFilteredApplicants } from '@/engine/hooks';
import { DECISION_STATUSES, type DecisionStatus } from '@/engine/types';
import { cn } from '@/lib/cn';
import type { IgnoreKey } from '@/lib/filtering';
import { useColors } from '@/lib/hooks';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { STATUS_META } from '@/lib/tokens';
import { useFilters } from '@/store/filters';

// The chart shows every week so the brush can move freely; it ignores its own range filter.
const IGNORE: IgnoreKey[] = ['range'];

type Week = { from: string; to: string; label: string; total: number } & Record<DecisionStatus, number>;

export function ReceivedTimeline() {
  const q = useFilteredApplicants(IGNORE);
  const range = useFilters((s) => s.range);
  const setRange = useFilters((s) => s.setRange);
  const c = useColors();
  const [hidden, setHidden] = useState<DecisionStatus[]>([]);
  const timer = useRef<number | undefined>(undefined);

  const weeks = useMemo<Week[]>(() => {
    const all = q.all ?? [];
    if (!all.length) return [];
    const first = startOfWeek(parseISO(all.map((r) => r.app.submittedAt).sort()[0]), { weekStartsOn: 1 });
    const out: Week[] = [];
    for (let d = first; d <= DEMO_TODAY; d = addDays(d, 7)) {
      const from = iso(d);
      const to = iso(addDays(d, 6));
      const w = { from, to, label: fmtDate(from), total: 0 } as Week;
      DECISION_STATUSES.forEach((s) => (w[s] = 0));
      out.push(w);
    }
    for (const r of q.data ?? []) {
      const w = out.find((x) => r.app.submittedAt >= x.from && r.app.submittedAt <= x.to);
      if (w) {
        w[r.decision.status] += 1;
        w.total += 1;
      }
    }
    return out;
  }, [q.data, q.all]);

  const startIndex = range ? Math.max(0, weeks.findIndex((w) => w.to >= range[0])) : 0;
  const endIndexRaw = range ? weeks.map((w) => w.from <= range[1]).lastIndexOf(true) : weeks.length - 1;
  const endIndex = Math.max(startIndex, endIndexRaw < 0 ? weeks.length - 1 : endIndexRaw);

  // Brush drags fire continuously; commit the filter once the hand settles.
  const commit = (s: number, e: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (s <= 0 && e >= weeks.length - 1) setRange(null);
      else setRange([weeks[s].from, weeks[e].to]);
    }, 160);
  };

  const inRange = (i: number) => i >= startIndex && i <= endIndex;
  const totalSelected = weeks.filter((_, i) => inRange(i)).reduce((n, w) => n + w.total, 0);

  return (
    <ChartCard
      title="Applications received"
      info="Weekly applications, stacked by decision. Drag the handles to filter the whole page to those dates; click a week to zoom to it."
      className="lg:col-span-12"
      actions={
        <span className="hidden items-center gap-1.5 text-2xs text-subtle sm:inline-flex">
          <MoveHorizontal className="h-3.5 w-3.5" /> drag to filter
          <MousePointerClick className="ml-2 h-3.5 w-3.5" /> click a week
        </span>
      }
      table={
        <DataTable
          columns={['Week of', 'Total', ...DECISION_STATUSES]}
          rows={weeks.map((w) => [w.label, w.total, ...DECISION_STATUSES.map((s) => w[s])])}
        />
      }
    >
      {!q.data ? (
        <ChartSkeleton className="h-44" />
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1" role="img" aria-label="Weekly applications received, stacked by decision">
            <div className="h-48">
              <ResponsiveContainer>
                <AreaChart
                  data={weeks}
                  margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
                  onClick={(e: { activeTooltipIndex?: number }) => {
                    const i = e?.activeTooltipIndex;
                    if (i === undefined || !weeks[i]) return;
                    const single = range && range[0] === weeks[i].from && range[1] === weeks[i].to;
                    setRange(single ? null : [weeks[i].from, weeks[i].to]);
                  }}
                  className="cursor-pointer"
                >
                  <defs>
                    {DECISION_STATUSES.map((s) => (
                      <linearGradient key={s} id={`g-${s.replace(/\s/g, '')}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor={c(STATUS_META[s].token)} stopOpacity={0.55} />
                        <stop offset="1" stopColor={c(STATUS_META[s].token)} stopOpacity={0.15} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke={c('border')} />
                  <XAxis dataKey="label" tick={{ fill: c('subtle'), fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fill: c('subtle'), fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RTooltip
                    cursor={{ stroke: c('brand'), strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const w = payload[0].payload as Week;
                      return (
                        <div className="min-w-40 rounded-md border bg-surface px-3 py-2 text-xs shadow-pop">
                          <div className="mb-1 flex justify-between gap-4 font-semibold tnum">
                            <span>Week of {w.label}</span>
                            <span>{w.total}</span>
                          </div>
                          {DECISION_STATUSES.filter((s) => w[s] > 0).map((s) => (
                            <div key={s} className="flex items-center justify-between gap-4 text-muted tnum">
                              <span className="flex items-center gap-1.5">
                                <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />
                                {s}
                              </span>
                              {w[s]}
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {DECISION_STATUSES.filter((s) => !hidden.includes(s)).map((s) => (
                    <Area
                      key={s}
                      type="monotone"
                      dataKey={s}
                      stackId="1"
                      stroke={c(STATUS_META[s].token)}
                      strokeWidth={1.5}
                      fill={`url(#g-${s.replace(/\s/g, '')})`}
                      animationDuration={500}
                    />
                  ))}
                  <Brush
                    dataKey="label"
                    height={22}
                    travellerWidth={10}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    stroke={c('brand')}
                    fill={c('raised')}
                    tickFormatter={() => ''}
                    onChange={(r: { startIndex?: number; endIndex?: number }) => commit(r.startIndex ?? 0, r.endIndex ?? weeks.length - 1)}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex shrink-0 flex-row flex-wrap gap-1 lg:w-44 lg:flex-col">
            <div className="mb-1 hidden lg:block">
              <div className="text-2xl font-semibold tracking-tight tnum">{totalSelected}</div>
              <div className="text-2xs text-subtle">
                {range ? `${fmtDate(weeks[startIndex]?.from ?? range[0])} – ${fmtDate(weeks[endIndex]?.to ?? range[1])}` : 'all weeks'}
              </div>
            </div>
            {DECISION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={!hidden.includes(s)}
                onClick={() => setHidden((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]))}
                className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-opacity hover:bg-raised focus-ring', hidden.includes(s) && 'opacity-35')}
              >
                <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
