import {
  AlertCircle, CalendarClock, CheckSquare, ClipboardList, GanttChartSquare, History, MapPin, MessageSquareText, Square, Store as StoreIcon, UserRound, Scale,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, FlagChip, LanguageBadge, PinChip, PriorityChip, ReasonChip, StageChip, StatusChip } from '@/components/chips';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data';
import { SideDrawer } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { useApplicants, useExplanation, usePinStates } from '@/engine/hooks';
import type { Application, Decision, Explanation, Reason } from '@/engine/types';
import { cn } from '@/lib/cn';
import { inrLakh, sqft } from '@/lib/format';
import { useAppDrawer, type DrawerTab } from '@/lib/hooks';
import { DEMO_TODAY, fmtDate, fmtDateLong, iso } from '@/lib/time';
import { OnboardingStepper, Ring } from '@/features/onboarding/Stepper';
import { trainingFor } from '@/features/onboarding/training';

export function ApplicantDrawer() {
  const { appId, tab, setTab, close, openApp } = useAppDrawer();
  const rows = useApplicants();
  const row = rows.data?.find((r) => r.app.id === appId);
  const navigate = useNavigate();

  return (
    <SideDrawer
      open={!!appId}
      onOpenChange={(o) => !o && close()}
      title={
        row ? (
          <span className="flex items-center gap-2.5">
            <Avatar name={row.app.name} />
            <span className="min-w-0">
              <span className="block truncate">{row.app.name}</span>
              <span className="block text-xs font-normal text-muted tnum">
                {row.app.id} · {row.app.city} · {row.app.pin}
              </span>
            </span>
          </span>
        ) : (
          appId ?? 'Applicant'
        )
      }
      footer={
        row && (
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => navigate(`/ask?about=${row.app.id}`)}>
              <MessageSquareText /> Ask about this applicant
            </Button>
            <Button onClick={() => navigate(`/partner/${row.app.id}`)} title="See what this partner sees">
              <StoreIcon /> Partner view
            </Button>
          </div>
        )
      }
    >
      {rows.loading && !rows.data ? (
        <div className="p-5">
          <ListSkeleton />
        </div>
      ) : !row ? (
        <EmptyState title={`No applicant ${appId ?? ''}`} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)} className="flex flex-col">
          <TabsList className="sticky top-0 z-10 bg-surface px-4 pt-3">
            <TabsTrigger value="decision">
              <Scale /> Decision
            </TabsTrigger>
            <TabsTrigger value="profile">
              <UserRound /> Profile
              {row.decision.dataFlags.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-st-needs" aria-label="has data flags" />}
            </TabsTrigger>
            <TabsTrigger value="next">
              <ClipboardList /> Next steps
            </TabsTrigger>
            <TabsTrigger value="onboarding">
              <GanttChartSquare /> Onboarding
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <History /> Timeline
            </TabsTrigger>
          </TabsList>
          <div className="p-5">
            <TabsContent value="decision">
              <DecisionTab decision={row.decision} app={row.app} onOpen={openApp} territoryPriority={row.territory?.priority} />
            </TabsContent>
            <TabsContent value="profile">
              <ProfileTab app={row.app} decision={row.decision} />
            </TabsContent>
            <TabsContent value="next">
              <NextStepsTab decision={row.decision} />
            </TabsContent>
            <TabsContent value="onboarding">
              <OnboardingTab decision={row.decision} app={row.app} />
            </TabsContent>
            <TabsContent value="timeline">
              <TimelineTab decision={row.decision} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </SideDrawer>
  );
}

/* ------------------------------------------------------------------ */

function Confidence({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <div className="flex items-center gap-2" title="Mock confidence — visual only in Phase 1">
      <div className="flex gap-0.5" role="img" aria-label={`Confidence ${filled} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn('h-2 w-4 rounded-sm', i <= filled ? 'bg-brand' : 'bg-raised')} />
        ))}
      </div>
      <span className="text-2xs text-subtle">confidence</span>
    </div>
  );
}

const SENT_ORDER: Record<Reason['sentiment'], number> = { hurt: 0, missing: 1, helped: 2 };

function DecisionTab({ decision, app, onOpen, territoryPriority }: {
  decision: Decision;
  app: Application;
  onOpen: (id: string) => void;
  territoryPriority?: 'High' | 'Medium' | 'Low';
}) {
  const ex = useExplanation(decision.applicationId);
  const pins = usePinStates();
  const pin = pins.data?.find((p) => p.pin === app.pin);
  const reasons = [...decision.reasons].sort((a, b) => SENT_ORDER[a.sentiment] - SENT_ORDER[b.sentiment]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={decision.status} size="lg" />
        {decision.stage !== decision.status && <StageChip stage={decision.stage} size="sm" />}
        <div className="ml-auto">
          <Confidence value={decision.confidence} />
        </div>
      </div>
      <p className="text-[15px] leading-snug">{decision.summary}</p>

      <section aria-label="Why">
        <div className="mb-2 flex items-center gap-3">
          <h3 className="label">Why</h3>
          <span className="flex items-center gap-2 text-2xs text-subtle">
            <span>✓ helped</span>
            <span>✕ hurt</span>
            <span>! missing</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {reasons.map((r) => (
            <ReasonChip key={r.id} reason={r} size="lg" />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-raised/60 p-2.5">
        <MapPin className="h-4 w-4 text-subtle" aria-hidden />
        {pin && <PinChip pin={pin.pin} status={pin.status} />}
        {decision.territoryId ? (
          <>
            <span className="text-xs text-muted tnum">{decision.territoryId}</span>
            {territoryPriority && <PriorityChip priority={territoryPriority} size="sm" />}
            {decision.territoryRank && <span className="text-xs text-muted">#{decision.territoryRank} in line</span>}
          </>
        ) : (
          <span className="text-xs text-muted">No territory</span>
        )}
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="full" className="border-y">
          <AccordionTrigger>See full reasoning</AccordionTrigger>
          <AccordionContent>
            {ex.error ? (
              <ErrorState />
            ) : !ex.data ? (
              <ListSkeleton rows={3} />
            ) : (
              <ul className="space-y-1.5 text-sm text-muted">
                {ex.data.fullReasoning.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {ex.data && ex.data.competitors.length > 0 && <Competitors ex={ex.data} self={decision} app={app} onOpen={onOpen} />}
    </div>
  );
}

function Competitors({ ex, self, app, onOpen }: { ex: Explanation; self: Decision; app: Application; onOpen: (id: string) => void }) {
  const rows = [
    { applicationId: self.applicationId, name: app.name, status: self.status, rank: self.territoryRank, investmentLakh: app.investmentLakh, self: true },
    ...ex.competitors.map((c) => ({ ...c, self: false })),
  ].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return (
    <section aria-label="Compared with competing applicants">
      <h3 className="label mb-2">Compared with competitors · {self.territoryId}</h3>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-raised/60 text-left text-subtle">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">#</th>
              <th className="px-2.5 py-1.5 font-medium">Applicant</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Capacity</th>
              <th className="px-2.5 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.applicationId}
                className={cn('border-t', r.self ? 'bg-brand-soft/60' : 'cursor-pointer hover:bg-raised/60')}
                onClick={() => !r.self && onOpen(r.applicationId)}
              >
                <td className="px-2.5 py-1.5 tnum text-muted">{r.rank ?? '—'}</td>
                <td className="px-2.5 py-1.5">
                  <span className="font-medium">{r.name}</span> <span className="text-subtle tnum">{r.applicationId}</span>
                  {r.self && <span className="ml-1 text-2xs text-brand">you</span>}
                </td>
                <td className="px-2.5 py-1.5 text-right tnum">{inrLakh(r.investmentLakh)}</td>
                <td className="px-2.5 py-1.5">
                  <StatusChip status={r.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ProfileTab({ app, decision }: { app: Application; decision: Decision }) {
  const flags = (field: string) => decision.dataFlags.filter((f) => f.field === field);
  const F = ({ field, label, value, wide }: { field: string; label: string; value: ReactNode; wide?: boolean }) => {
    const empty = value === null || value === undefined || value === '';
    const fl = flags(field);
    return (
      <div className={cn('min-w-0 rounded-md border px-3 py-2', fl.length > 0 && 'border-st-needs/35 bg-st-needs/[0.04]', wide && 'col-span-2')}>
        <dt className="text-2xs font-medium text-subtle">{label}</dt>
        <dd className={cn('mt-0.5 text-sm', empty && 'italic text-subtle')}>{empty ? 'Not provided' : value}</dd>
        {fl.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {fl.map((f) => (
              <FlagChip key={f.label}>{f.label}</FlagChip>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      {decision.dataFlags.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-st-needs/10 px-3 py-2 text-xs text-st-needs">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {decision.dataFlags.length} data-quality flag{decision.dataFlags.length > 1 ? 's' : ''} on this application
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2">
        <F field="name" label="Applicant" value={app.name} />
        <F field="id" label="Application ID" value={<span className="tnum">{app.id}</span>} />
        <F field="city" label="City" value={`${app.city}, ${app.state}`} />
        <F field="pin" label="PIN code" value={<span className="tnum">{app.pin}</span>} />
        <F field="investmentLakh" label="Investment capacity" value={<span className="tnum">{inrLakh(app.investmentLakh)}</span>} />
        <F field="experienceYears" label="Retail experience" value={<span className="tnum">{app.experienceYears} yrs</span>} />
        <F field="space" label="Space available" value={app.space} />
        <F field="spaceSqft" label="Space size" value={sqft(app.spaceSqft)} />
        <F field="floor" label="Floor" value={app.floor} />
        <F field="launchMonths" label="Target launch" value={<span className="tnum">{app.launchMonths} month{app.launchMonths > 1 ? 's' : ''}</span>} />
        <F field="language" label="Training language" value={<LanguageBadge language={app.language} size="sm" />} />
        <F field="submittedAt" label="Received" value={fmtDateLong(app.submittedAt)} />
        <F field="business" label="Current / past business" value={app.business} wide />
        <F field="notes" label="Notes from applicant" value={app.notes ? <span className="italic">“{app.notes}”</span> : ''} wide />
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NextStepsTab({ decision }: { decision: Decision }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const today = iso(DEMO_TODAY);
  if (!decision.nextSteps.length) return <EmptyState title="No next steps" />;
  return (
    <ul className="space-y-2">
      {decision.nextSteps.map((s) => {
        const isDone = done[s.id] ?? s.done;
        const overdue = !isDone && s.dueDate < today;
        return (
          <li key={s.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <button
              type="button"
              onClick={() => setDone((d) => ({ ...d, [s.id]: !isDone }))}
              className="text-muted hover:text-fg focus-ring"
              aria-label={isDone ? `Mark "${s.label}" not done` : `Mark "${s.label}" done`}
              aria-pressed={isDone}
            >
              {isDone ? <CheckSquare className="h-4 w-4 text-st-approved" /> : <Square className="h-4 w-4" />}
            </button>
            <span className={cn('flex-1 text-sm', isDone && 'text-subtle line-through')}>{s.label}</span>
            <span className="hidden rounded-full bg-raised px-2 py-0.5 text-2xs text-muted sm:inline">{s.owner}</span>
            <span className={cn('flex items-center gap-1 text-xs tnum', overdue ? 'font-semibold text-st-rejected' : 'text-muted')}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {fmtDate(s.dueDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function OnboardingTab({ decision, app }: { decision: Decision; app: Application }) {
  const plan = decision.onboarding;
  if (!plan) {
    return <EmptyState title="Onboarding starts after approval" icon={<GanttChartSquare className="h-5 w-5" />} />;
  }
  const modules = trainingFor(plan);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Now: <span className="font-medium text-fg">{plan.current}</span>
        </span>
        <span className="tnum">Target open {fmtDate(plan.targetOpen)}</span>
      </div>
      <OnboardingStepper plan={plan} />
      {plan.atRisk && (
        <div className="flex items-center gap-2 rounded-md bg-st-hold/10 px-3 py-2 text-xs text-st-hold">
          <AlertCircle className="h-4 w-4" aria-hidden /> {plan.riskNote}
        </div>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label">Training plan</h3>
          <LanguageBadge language={app.language} size="sm" />
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {modules.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
              <Ring value={m.progress} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{m.title}</span>
                <span className="text-2xs text-subtle tnum">
                  Wk {m.week} · {m.hours} h
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TimelineTab({ decision }: { decision: Decision }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {decision.timeline.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface',
              e.kind === 'decision' ? 'bg-brand' : e.kind === 'onboarding' ? 'bg-st-onboarding' : e.kind === 'info' ? 'bg-st-needs' : 'bg-subtle',
            )}
            aria-hidden
          />
          <div className="text-sm">{e.label}</div>
          <div className="text-2xs text-subtle tnum">{fmtDateLong(e.date)}</div>
        </li>
      ))}
    </ol>
  );
}

