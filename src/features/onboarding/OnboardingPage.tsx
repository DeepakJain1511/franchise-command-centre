import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarCheck, Clock3, GanttChartSquare, GraduationCap, TriangleAlert, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/AppShell';
import { Avatar, LanguageBadge } from '@/components/chips';
import { EmptyState, ErrorState, Skeleton, Stat } from '@/components/data';
import { Segmented, Select } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { useFilteredApplicants } from '@/engine/hooks';
import { ONBOARDING_STEPS, type OnboardingPlan, type OnboardingStep } from '@/engine/types';
import { useView } from '@/lib/hooks';
import type { ApplicantRow } from '@/lib/filtering';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { CityStrip, StageJourney } from './StageJourney';
import { isStepOverdue, OnboardingStepper, Ring } from './Stepper';
import { trainingFor } from './training';

const VIEWS = ['partners', 'training', 'cohort'] as const;
type View = (typeof VIEWS)[number];

type Row = ApplicantRow & { decision: ApplicantRow['decision'] & { onboarding: OnboardingPlan } };

/** At risk = flagged by the engine, or the active step is past its target date. */
function riskOf(plan: OnboardingPlan): string | null {
  const active = plan.steps.find((s) => s.state === 'active');
  if (plan.atRisk) return plan.riskNote ?? 'At risk';
  if (active && isStepOverdue(active)) return `${active.step} overdue`;
  return null;
}

function RiskChip({ note }: { note: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-st-hold/30 bg-st-hold/10 px-2 py-0.5 text-2xs font-medium text-st-hold">
      <TriangleAlert className="h-3 w-3" aria-hidden /> {note}
    </span>
  );
}

/* ---------------- Partners ---------------- */
function Partners({ rows }: { rows: Row[] }) {
  const cities = [...new Set(rows.map((r) => r.app.city))].sort((a, b) => rows.filter((r) => r.app.city === b).length - rows.filter((r) => r.app.city === a).length);
  return (
    <div className="space-y-5">
      {cities.map((city) => {
        const list = rows.filter((r) => r.app.city === city);
        return (
          <section key={city} aria-label={city}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {city}
              <span className="rounded-full bg-raised px-1.5 text-2xs font-medium text-muted tnum">{list.length}</span>
            </h2>
            <PartnerCards rows={list} />
          </section>
        );
      })}
    </div>
  );
}

function PartnerCards({ rows }: { rows: Row[] }) {
  const { openApp } = useAppDrawer();
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map(({ app, decision }) => {
        const plan = decision.onboarding;
        const risk = riskOf(plan);
        return (
          <li key={app.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => openApp(app.id, 'onboarding')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openApp(app.id, 'onboarding'))}
              className="card cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift focus-ring"
              aria-label={`${app.name}: ${plan.current}${risk ? `, at risk: ${risk}` : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Avatar name={app.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{app.name}</div>
                  <div className="text-2xs text-subtle tnum">
                    {app.id} · {app.city}
                  </div>
                </div>
                <LanguageBadge language={app.language} size="sm" />
              </div>
              <div className="mt-4">
                <OnboardingStepper plan={plan} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                <span className="inline-flex items-center gap-1 text-muted">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                  {plan.current === 'Open' ? 'Opened' : 'Open by'} <b className="text-fg tnum">{fmtDate(plan.targetOpen)}</b>
                </span>
                {risk && <RiskChip note={risk} />}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Training ---------------- */
function Training({ rows }: { rows: Row[] }) {
  const inProgress = rows.find((r) => r.decision.onboarding.current === 'Training') ?? rows.find((r) => r.decision.onboarding.current !== 'Open') ?? rows[0];
  const [id, setId] = useState(inProgress.app.id);
  const row = rows.find((r) => r.app.id === id) ?? inProgress;
  const modules = trainingFor(row.decision.onboarding);
  const done = modules.filter((m) => m.progress >= 1).length;
  const hoursDone = modules.reduce((n, m) => n + m.hours * m.progress, 0);
  const hours = modules.reduce((n, m) => n + m.hours, 0);
  const weeks = [...new Set(modules.map((m) => m.week))];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <Select
          ariaLabel="Partner"
          className="w-full sm:w-72"
          value={row.app.id}
          onChange={setId}
          options={rows.map((r) => ({ value: r.app.id, label: `${r.app.name} · ${r.decision.onboarding.current}` }))}
        />
        <LanguageBadge language={row.app.language} />
        <div className="ml-auto flex items-center gap-6">
          <Stat label="Modules done" value={`${done}/${modules.length}`} />
          <Stat label="Hours done" value={`${Math.round(hoursDone)}/${hours} h`} />
          <Ring value={modules.length ? done / modules.length : 0} size={40} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {weeks.map((w) => (
          <section key={w} aria-label={`Week ${w}`}>
            <h2 className="label mb-2">Week {w}</h2>
            <ul className="space-y-2">
              {modules
                .filter((m) => m.week === w)
                .map((m) => (
                  <li key={m.id} className="card flex items-center gap-3 p-3">
                    <Ring value={m.progress} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-subtle tnum">
                        <Clock3 className="h-3 w-3" aria-hidden /> {m.hours} h
                        <span aria-hidden>·</span>
                        {m.progress >= 1 ? 'Done' : m.progress > 0 ? 'In progress' : 'Not started'}
                      </div>
                    </div>
                    <LanguageBadge language={row.app.language} size="sm" />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Cohort (Gantt-lite) ---------------- */
const RANGE_START = '2026-07-01';
const RANGE_END = '2027-02-01';
const MONTHS = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'];

function Cohort({ rows }: { rows: Row[] }) {
  const c = useColors();
  const { openApp } = useAppDrawer();
  const total = differenceInCalendarDays(parseISO(RANGE_END), parseISO(RANGE_START));
  const pctOf = (d: string) => Math.max(0, Math.min(100, (differenceInCalendarDays(parseISO(d), parseISO(RANGE_START)) / total) * 100));
  const today = pctOf(iso(DEMO_TODAY));

  return (
    <div className="card overflow-x-auto p-4">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[180px_1fr] gap-3">
          <div />
          <div className="relative h-6 text-2xs text-subtle">
            {MONTHS.map((m) => (
              <span key={m} className="absolute -translate-x-1/2 tnum" style={{ left: `${pctOf(m)}%` }}>
                {fmtDate(m).split(' ')[1]}
              </span>
            ))}
          </div>
        </div>
        <ul className="relative space-y-1.5">
          {rows.map(({ app, decision }) => {
            const plan = decision.onboarding;
            const lastDone = [...plan.steps].reverse().find((s) => s.state === 'done');
            const doneUntil = plan.current === 'Open' ? plan.targetOpen : lastDone?.targetDate ?? plan.startDate;
            const active = plan.steps.find((s) => s.state === 'active');
            const risk = riskOf(plan);
            const s0 = pctOf(plan.startDate);
            const s1 = pctOf(plan.targetOpen);
            const d1 = pctOf(doneUntil);
            return (
              <li key={app.id} className="grid grid-cols-[180px_1fr] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={app.name} className="h-6 w-6 text-[9px]" />
                  <span className="truncate text-xs font-medium">{app.name}</span>
                </div>
                <div className="relative h-8">
                  {MONTHS.map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${pctOf(m)}%` }} aria-hidden />
                  ))}
                  <Tooltip
                    content={
                      <span className="tnum">
                        <b>{app.name}</b> · start {fmtDate(plan.startDate)} · open {fmtDate(plan.targetOpen)} · now {plan.current}
                        {risk ? ` · ${risk}` : ''}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => openApp(app.id, 'onboarding')}
                      aria-label={`${app.name}: ${fmtDate(plan.startDate)} to ${fmtDate(plan.targetOpen)}, ${plan.current}${risk ? `, at risk` : ''}`}
                      className="absolute top-1.5 h-5 overflow-hidden rounded-full focus-ring"
                      style={{ left: `${s0}%`, width: `${Math.max(1, s1 - s0)}%`, background: c('raised'), boxShadow: `inset 0 0 0 1px ${c('border')}` }}
                    >
                      <span className="absolute inset-y-0 left-0" style={{ width: `${s1 > s0 ? ((d1 - s0) / (s1 - s0)) * 100 : 0}%`, background: c(plan.current === 'Open' ? 'st-open' : 'st-onboarding') }} />
                    </button>
                  </Tooltip>
                  {risk && active && (
                    <span
                      className="pointer-events-none absolute top-1 h-6 w-1.5 -translate-x-1/2 rounded-full ring-2 ring-surface"
                      style={{ left: `${pctOf(active.targetDate)}%`, background: c('st-rejected') }}
                      aria-hidden
                    />
                  )}
                </div>
              </li>
            );
          })}
          <span className="pointer-events-none absolute inset-y-0 w-0" style={{ left: `calc(180px + 0.75rem + (100% - 180px - 0.75rem) * ${today / 100})` }} aria-hidden>
            <span className="absolute -bottom-5 -translate-x-1/2 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-fg">Today</span>
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand/70" />
          </span>
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-3 text-2xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full" style={{ background: c('st-onboarding') }} /> Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full" style={{ background: c('raised'), boxShadow: `inset 0 0 0 1px ${c('border')}` }} /> Remaining
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full" style={{ background: c('st-open') }} /> Open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-1.5 rounded-full" style={{ background: c('st-rejected') }} /> Slipping
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function OnboardingPage() {
  const q = useFilteredApplicants();
  const reset = useFilters((s) => s.reset);
  const bump = useData((s) => s.bump);
  const [view, setView] = useView<View>(VIEWS, 'partners');
  const [params, setParams] = useSearchParams();
  const rawStep = params.get('step');
  const step = (ONBOARDING_STEPS as readonly string[]).includes(rawStep ?? '') ? (rawStep as OnboardingStep) : null;
  const setStep = (s: OnboardingStep | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (s) n.set('step', s);
        else n.delete('step');
        return n;
      },
      { replace: true },
    );
  const cityQ = useFilteredApplicants(['city']);
  const rows = (q.data ?? [])
    .filter((r): r is Row => r.decision.onboarding !== null)
    .sort((a, b) => a.decision.onboarding.startDate.localeCompare(b.decision.onboarding.startDate));
  const atRisk = rows.filter((r) => riskOf(r.decision.onboarding)).length;
  const shown = step ? rows.filter((r) => r.decision.onboarding.current === step) : rows;
  const stripRows = (cityQ.data ?? []).filter((r): r is Row => r.decision.onboarding !== null && (!step || r.decision.onboarding.current === step));

  return (
    <div className="pb-10">
      <PageHeader
        title="Onboarding"
        question="How do partners get to an open store?"
        actions={
          <Segmented<View>
            ariaLabel="Onboarding view"
            value={view}
            onChange={setView}
            options={[
              { value: 'partners', label: 'Partners', icon: <Users /> },
              { value: 'training', label: 'Training', icon: <GraduationCap /> },
              { value: 'cohort', label: 'Cohort', icon: <GanttChartSquare /> },
            ]}
          />
        }
      />
      <div className="space-y-4 px-4 md:px-6">
        {q.error ? (
          <ErrorState onRetry={bump} />
        ) : !q.data ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No partners onboarding in this view" onReset={reset} icon={<GanttChartSquare className="h-5 w-5" />} />
        ) : (
          <>
            <div className="flex flex-wrap gap-6">
              <Stat label="Onboarding" value={rows.filter((r) => r.decision.onboarding.current !== 'Open').length} />
              <Stat label="Opened" value={rows.filter((r) => r.decision.onboarding.current === 'Open').length} tone="text-st-open" />
              <Stat label="At risk" value={atRisk} tone={atRisk ? 'text-st-hold' : undefined} />
            </div>
            <StageJourney rows={rows} step={step} onPick={setStep} riskOf={(r) => riskOf(r.decision.onboarding)} />
            <CityStrip rows={stripRows} />
            {shown.length === 0 ? (
              <EmptyState title={`Nobody at ${step ?? 'this stage'} in this view`} onReset={() => setStep(null)} icon={<GanttChartSquare className="h-5 w-5" />} />
            ) : view === 'partners' ? (
              <Partners rows={shown} />
            ) : view === 'training' ? (
              <Training rows={shown} />
            ) : (
              <Cohort rows={shown} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
