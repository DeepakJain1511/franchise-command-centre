import { CalendarRange, Columns3, List } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { PageHeader } from '@/app/AppShell';
import { DecisionBadge } from '@/components/chips';
import { EmptyState, ErrorState, Skeleton, Sparkline } from '@/components/data';
import { Segmented } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { useFilteredApplicants } from '@/engine/hooks';
import { STAGES, type Stage } from '@/engine/types';
import { weeklyCumulative } from '@/lib/aggregate';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { inrLakh } from '@/lib/format';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { DEMO_TODAY, daysAgo, fmtDate } from '@/lib/time';
import { STAGE_META } from '@/lib/tokens';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { useUi } from '@/store/ui';
import { useView } from '@/lib/hooks';

const VIEWS = ['board', 'table', 'timeline'] as const;
type View = (typeof VIEWS)[number];
const STUCK_DAYS = 21;

const byStage = (rows: ApplicantRow[], s: Stage) => rows.filter((r) => r.decision.stage === s);

function StageHead({ stage, count, spark }: { stage: Stage; count: number; spark?: number[] }) {
  const m = STAGE_META[stage];
  return (
    <div>
      <div className="flex items-center gap-2">
        <m.icon className={cn('h-4 w-4 shrink-0', m.cls.split(' ')[0])} aria-hidden />
        <span className="truncate text-sm font-semibold">{stage}</span>
        <span className="rounded-full bg-raised px-1.5 text-2xs font-semibold text-muted tnum">{count}</span>
      </div>
      {spark && (
        <div className="mt-1.5" title="Trend, last 8 weeks">
          <Sparkline data={spark} token={m.token === 'subtle' ? 'muted' : m.token} height={14} />
        </div>
      )}
    </div>
  );
}

function StuckDot({ days }: { days: number }) {
  if (days <= STUCK_DAYS) return null;
  return (
    <Tooltip content={`Stuck ${days} days`}>
      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-st-hold ring-2 ring-st-hold/25" aria-label={`Stuck ${days} days`} />
    </Tooltip>
  );
}

/* ---------------- Board ---------------- */
function Board({ rows }: { rows: ApplicantRow[] }) {
  const { openApp } = useAppDrawer();
  const toast = useUi((s) => s.toast);
  const [dragging, setDragging] = useState<{ id: string; from: Stage } | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const onDrop = (e: DragEvent, to: Stage) => {
    e.preventDefault();
    setOver(null);
    if (dragging && dragging.from !== to) toast('Moves are decided by the engine', 'warning');
    setDragging(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-6 scrollbar-thin md:px-6">
      {STAGES.map((stage) => {
        const list = byStage(rows, stage);
        return (
          <section
            key={stage}
            aria-label={`${stage}: ${list.length}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver((o) => (o === stage ? null : o))}
            onDrop={(e) => onDrop(e, stage)}
            className={cn(
              'flex min-w-[178px] flex-1 basis-0 flex-col rounded-lg border bg-raised/40 transition-colors',
              over === stage && dragging?.from !== stage && 'border-st-hold/50 bg-st-hold/5',
            )}
          >
            <div className="border-b px-3 py-2.5">
              <StageHead stage={stage} count={list.length} spark={weeklyCumulative(rows, 8, (r) => r.decision.stage === stage)} />
            </div>
            <ul className="flex flex-1 flex-col gap-2 p-2">
              {list.length === 0 && <li className="py-6 text-center text-xs text-subtle">None</li>}
              {list.map(({ app, decision }) => (
                <li key={app.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging({ id: app.id, from: stage });
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onClick={() => openApp(app.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openApp(app.id))}
                    className={cn(
                      'card cursor-pointer p-3 transition-all hover:-translate-y-0.5 hover:shadow-lift focus-ring',
                      dragging?.id === app.id && 'opacity-50',
                    )}
                    aria-label={`${app.name}, ${app.city}, ${decision.status}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{app.name}</span>
                      <StuckDot days={decision.daysInStage} />
                    </div>
                    <div className="mt-0.5 truncate text-2xs text-subtle tnum">
                      {app.city.replace('Hubballi-Dharwad', 'Hubballi')} · <span className="font-medium text-muted">{inrLakh(app.investmentLakh)}</span>
                    </div>
                    <div className="mt-2">
                      <DecisionBadge decision={decision} size="sm" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Table ---------------- */
function Table({ rows }: { rows: ApplicantRow[] }) {
  const { openApp } = useAppDrawer();
  return (
    <div className="px-4 pb-6 md:px-6">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-subtle">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium">Applicant</th>
              <th className="py-2 font-medium">City</th>
              <th className="py-2 text-right font-medium">Capacity</th>
              <th className="py-2 pl-4 font-medium">Decision</th>
              <th className="px-4 py-2 text-right font-medium">Days in stage</th>
            </tr>
          </thead>
          {STAGES.map((stage) => {
            const list = byStage(rows, stage);
            if (!list.length) return null;
            return (
              <tbody key={stage}>
                <tr>
                  <th colSpan={5} className="border-b bg-raised/50 px-4 py-2 text-left">
                    <StageHead stage={stage} count={list.length} />
                  </th>
                </tr>
                {list.map(({ app, decision }) => (
                  <tr
                    key={app.id}
                    tabIndex={0}
                    onClick={() => openApp(app.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openApp(app.id)}
                    className="cursor-pointer border-b border-border/60 hover:bg-raised/40 focus-ring"
                  >
                    <td className="px-4 py-2">
                      <span className="font-medium">{app.name}</span> <span className="text-2xs text-subtle tnum">{app.id}</span>
                    </td>
                    <td className="py-2 text-muted">{app.city}</td>
                    <td className="py-2 text-right tnum">{inrLakh(app.investmentLakh)}</td>
                    <td className="py-2 pl-4">
                      <DecisionBadge decision={decision} size="sm" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 tnum">
                        <StuckDot days={decision.daysInStage} />
                        {decision.daysInStage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}

/* ---------------- Timeline ---------------- */
const WEEKS = 16;
function Timeline({ rows }: { rows: ApplicantRow[] }) {
  const { openApp } = useAppDrawer();
  const c = useColors();
  const W = 1000;
  const rowH = 44;
  const left = 120;
  const x = (iso: string) => {
    const weeksAgo = Math.min(WEEKS, Math.max(0, daysAgo(iso) / 7));
    return left + ((WEEKS - weeksAgo) / WEEKS) * (W - left - 16);
  };
  const ticks = Array.from({ length: WEEKS / 2 + 1 }, (_, i) => i * 2);
  const H = STAGES.length * rowH + 28;
  const older = rows.filter((r) => daysAgo(r.app.submittedAt) > WEEKS * 7).length;

  return (
    <div className="px-4 pb-6 md:px-6">
      <div className="card overflow-x-auto p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[720px]" role="img" aria-label="Applications received by week, per stage">
          {ticks.map((w) => {
            const xx = left + ((WEEKS - w) / WEEKS) * (W - left - 16);
            return (
              <g key={w}>
                <line x1={xx} x2={xx} y1={0} y2={H - 24} stroke={c('border')} strokeDasharray={w === 0 ? undefined : '2 4'} />
                <text x={xx} y={H - 8} textAnchor="middle" fontSize={11} fill={c('subtle')} className="tnum">
                  {w === 0 ? 'Today' : `${w}w`}
                </text>
              </g>
            );
          })}
          {STAGES.map((stage, i) => {
            const y = i * rowH + rowH / 2;
            const m = STAGE_META[stage];
            const list = byStage(rows, stage);
            return (
              <g key={stage}>
                <text x={0} y={y + 4} fontSize={12} fontWeight={600} fill={c('muted')}>
                  {stage}
                </text>
                <line x1={left} x2={W - 16} y1={y} y2={y} stroke={c('border')} />
                {list.map(({ app, decision }, k) => {
                  const cx = x(app.submittedAt);
                  const cy = y + ((k % 3) - 1) * 9;
                  return (
                    <Tooltip
                      key={app.id}
                      content={
                        <span className="tnum">
                          <b>{app.name}</b> · {app.id} · received {fmtDate(app.submittedAt)} · {decision.status}
                        </span>
                      }
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill={c(m.token === 'subtle' ? 'subtle' : m.token)}
                        fillOpacity={0.85}
                        stroke={c('surface')}
                        strokeWidth={2}
                        tabIndex={0}
                        role="button"
                        aria-label={`${app.name}, received ${fmtDate(app.submittedAt)}`}
                        className="cursor-pointer outline-none transition-all hover:opacity-100 focus-visible:stroke-[3px]"
                        onClick={() => openApp(app.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openApp(app.id)}
                      />
                    </Tooltip>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-2xs text-subtle">
          Received date · last {WEEKS} weeks to {fmtDate(DEMO_TODAY.toISOString().slice(0, 10))}
          {older > 0 && ` · ${older} older shown at the left edge`}
        </p>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function PipelinePage() {
  const q = useFilteredApplicants();
  const reset = useFilters((s) => s.reset);
  const bump = useData((s) => s.bump);
  const [view, setView] = useView<View>(VIEWS, 'board');

  return (
    <div>
      <PageHeader
        title="Pipeline"
        question="Where is everyone in the journey?"
        actions={
          <Segmented<View>
            ariaLabel="Pipeline view"
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Board', icon: <Columns3 /> },
              { value: 'table', label: 'Table', icon: <List /> },
              { value: 'timeline', label: 'Timeline', icon: <CalendarRange /> },
            ]}
          />
        }
      />
      {q.error ? (
        <ErrorState onRetry={bump} />
      ) : !q.data ? (
        <div className="flex gap-3 overflow-hidden px-4 md:px-6">
          {STAGES.map((s) => (
            <Skeleton key={s} className="h-96 w-[248px] shrink-0 rounded-lg" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState onReset={reset} />
      ) : view === 'board' ? (
        <Board rows={q.data} />
      ) : view === 'table' ? (
        <Table rows={q.data} />
      ) : (
        <Timeline rows={q.data} />
      )}
    </div>
  );
}
