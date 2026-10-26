import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { ChartCard, ChartSkeleton, CountUp, DataTable, EmptyState } from '@/components/data';
import { useFilteredApplicants } from '@/engine/hooks';
import { DECISION_STATUSES, type DecisionStatus } from '@/engine/types';
import { asOf } from '@/lib/aggregate';
import { cn } from '@/lib/cn';
import { pct } from '@/lib/format';
import { useColors } from '@/lib/hooks';
import { STATUS_META } from '@/lib/tokens';
import { useFilters, type ListKey } from '@/store/filters';

const IGNORE: ListKey[] = ['status'];

interface Slice {
  status: DecisionStatus;
  value: number;
  share: number;
  delta: number;
}

function SliceTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Slice }> }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-pop tnum">
      <b>{s.status}</b> · {s.value} · {pct(s.share)} · {s.delta >= 0 ? '+' : ''}
      {s.delta} vs 4 wks ago
    </div>
  );
}

export function DecisionDonut() {
  const q = useFilteredApplicants(IGNORE);
  const selected = useFilters((s) => s.status);
  const toggle = useFilters((s) => s.toggle);
  const only = useFilters((s) => s.only);
  const reset = useFilters((s) => s.reset);
  const c = useColors();
  const navigate = useNavigate();

  const rows = q.data ?? [];
  const prev = asOf(rows);
  const data: Slice[] = DECISION_STATUSES.map((s) => {
    const value = rows.filter((r) => r.decision.status === s).length;
    return { status: s, value, share: rows.length ? value / rows.length : 0, delta: value - prev.filter((r) => r.decision.status === s).length };
  });
  const shownTotal = selected.length ? data.filter((d) => selected.includes(d.status)).reduce((n, d) => n + d.value, 0) : rows.length;
  const isOn = (s: DecisionStatus) => selected.length === 0 || selected.includes(s);

  return (
    <ChartCard
      title="Decision mix"
      info="Share of applicants by decision. Click a slice or legend item to filter."
      className="lg:col-span-5"
      onDrill={() => navigate(`/applicants${selected.length ? `?status=${encodeURIComponent(selected.join(','))}` : ''}`)}
      drillLabel="List applicants"
      table={<DataTable columns={['Decision', 'Count', 'Share', 'Δ 4 wks']} rows={data.map((d) => [d.status, d.value, pct(d.share), `${d.delta >= 0 ? '+' : ''}${d.delta}`])} />}
    >
      {!q.data ? (
        <ChartSkeleton className="h-56" />
      ) : rows.length === 0 ? (
        <EmptyState onReset={reset} />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative h-52 w-52 shrink-0" role="img" aria-label={`Decision mix: ${data.map((d) => `${d.status} ${d.value}`).join(', ')}`}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="status"
                  innerRadius="66%"
                  outerRadius="96%"
                  paddingAngle={2}
                  cornerRadius={5}
                  stroke="none"
                  isAnimationActive
                  animationDuration={500}
                  onClick={(d: { payload?: Slice }) => d.payload && only('status', d.payload.status)}
                  onDoubleClick={(d: { payload?: Slice }) => d.payload && navigate(`/applicants?status=${encodeURIComponent(d.payload.status)}`)}
                  className="cursor-pointer outline-none"
                >
                  {data
                    .filter((d) => d.value > 0)
                    .map((d) => (
                      <Cell key={d.status} fill={c(STATUS_META[d.status].token)} fillOpacity={isOn(d.status) ? 1 : 0.35} className="outline-none transition-opacity" />
                    ))}
                </Pie>
                <RTooltip content={<SliceTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight">
                <CountUp value={shownTotal} />
              </span>
              <span className="text-2xs text-subtle">{selected.length ? 'selected' : 'applicants'}</span>
            </div>
          </div>
          <ul className="grid w-full grid-cols-2 gap-1 sm:grid-cols-1" aria-label="Legend — click to filter">
            {data.map((d) => {
              const M = STATUS_META[d.status];
              return (
                <li key={d.status}>
                  <button
                    type="button"
                    onClick={() => toggle('status', d.status)}
                    aria-pressed={selected.includes(d.status)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-all hover:bg-raised focus-ring',
                      !isOn(d.status) && 'opacity-35',
                      selected.includes(d.status) && 'bg-raised',
                    )}
                  >
                    <M.icon className={cn('h-3.5 w-3.5 shrink-0', M.cls.split(' ')[0])} aria-hidden />
                    <span className="flex-1 truncate">{d.status}</span>
                    <span className="font-semibold tnum">{d.value}</span>
                    <span className="w-9 text-right text-subtle tnum">{pct(d.share)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
