import {
  AlertCircle, AlertTriangle, BadgeCheck, CalendarClock, CalendarPlus, CheckSquare, ClipboardList, GanttChartSquare, History, Info, MapPin, MessageSquareText,
  Square, Store as StoreIcon, TrendingUp, Undo2, Unlock, UserRound, Scale,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, FlagChip, LanguageBadge, PinChip, PriorityChip, ReasonChip, StatusChip } from '@/components/chips';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data';
import { SideDrawer } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { useApplicants, useEngineActions, useExplanation, usePinStates } from '@/engine/hooks';
import type { Application, Decision, Explanation, Reason, TaskStatus } from '@/engine/types';
import { t } from '@/i18n';
import { useUi } from '@/store/ui';
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
  const r = decision.result;
  const txt = decision.text;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <StatusChip status={decision.status} size="lg" />
        <span className="text-sm font-semibold">{txt.outcome}</span>
        {txt.sub && <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted tnum">{txt.sub}</span>}
      </div>
      <p className="text-[15px] leading-snug">{txt.main}</p>

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
          {reasons.map((x) => (
            <ReasonChip key={x.id} reason={x} size="lg" />
          ))}
        </div>
      </section>

      <section aria-label="Score breakdown">
        <h3 className="label mb-2">Score breakdown</h3>
        <ScoreBreakdown r={r} />
      </section>

      {(txt.others.length > 0 || txt.warnings.length > 0) && (
        <section aria-label="Also" className="space-y-1.5">
          {txt.others.map((o, i) => (
            <p key={`o${i}`} className="flex gap-2 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden /> {o}
            </p>
          ))}
          {txt.warnings.map((w, i) => (
            <p key={`w${i}`} className="flex gap-2 text-sm text-st-hold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {w}
            </p>
          ))}
        </section>
      )}

      {txt.tips.length > 0 && (
        <section aria-label="How to improve">
          <h3 className="label mb-2">How to improve</h3>
          <ul className="space-y-1">
            {txt.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-st-approved" aria-hidden /> {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-raised/60 p-2.5">
        <MapPin className="h-4 w-4 text-subtle" aria-hidden />
        {pin && <PinChip pin={pin.pin} status={pin.status} />}
        {r.slotPin && r.slotPin !== app.pin && <span className="text-xs text-muted tnum">→ slot at {r.slotPin}</span>}
        {decision.territoryId ? (
          <>
            <span className="text-xs text-muted tnum">{decision.territoryId}</span>
            {territoryPriority && <PriorityChip priority={territoryPriority} size="sm" />}
            {r.slotRank ? <span className="text-xs text-muted">slot #{r.slotRank}</span> : r.queuePosition ? <span className="text-xs text-muted">#{r.queuePosition} in line</span> : null}
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
  const all = useApplicants();
  const scores = new Map((all.data ?? []).map((x) => [x.app.id, Math.round(x.decision.result.adjustedPct)]));
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
              <th className="px-2.5 py-1.5 text-right font-medium">Score</th>
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
                <td className="px-2.5 py-1.5 text-right tnum">{scores.get(r.applicationId) ?? '—'}</td>
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
        <F field="investmentLakh" label="Investment capacity" value={app.investmentLakh === null ? '' : <span className="tnum">{inrLakh(app.investmentLakh)}</span>} />
        <F field="experienceYears" label="Retail experience" value={app.experienceYears === null ? '' : <span className="tnum">{app.experienceYears} yrs</span>} />
        <F field="space" label="Space available" value={app.space} />
        <F field="spaceSqft" label="Space size" value={sqft(app.spaceSqft)} />
        <F field="floor" label="Floor" value={app.floor} />
        <F field="launchMonths" label="Target launch" value={app.launchMonths === null ? '' : <span className="tnum">{app.launchMonths} month{app.launchMonths === 1 ? '' : 's'}</span>} />
        <F field="language" label="Training language" value={<LanguageBadge language={app.language} size="sm" />} />
        <F field="submittedAt" label="Received" value={fmtDateLong(app.submittedAt)} />
        <F field="business" label="Current / past business" value={app.business} wide />
        <F field="notes" label="Notes from applicant" value={app.notes ? <span className="italic">“{app.notes}”</span> : ''} wide />
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const TASK_TONE: Record<TaskStatus, string> = {
  'Not started': 'text-muted',
  'Done — awaiting check': 'text-st-hold',
  Verified: 'text-st-approved',
};

function NextStepsTab({ decision }: { decision: Decision }) {
  const r = decision.result;
  const act = useEngineActions();
  const toast = useUi((x) => x.toast);
  const [reasonFor, setReasonFor] = useState<'extend' | 'release' | null>(null);
  const [reason, setReason] = useState('');
  const today = iso(DEMO_TODAY);
  const tasks = r.outcome === 'APPROVE' ? r.onboarding?.tasks ?? [] : [];

  const submitReason = async () => {
    if (!reason.trim() || !reasonFor) return;
    const diff = reasonFor === 'extend' ? await act.extend(r.id, reason.trim()) : await act.release(r.id, reason.trim());
    toast(
      reasonFor === 'extend' ? 'Deadline extended by 7 days' : `Reservation released${diff.length ? ` — ${diff.length} applicant${diff.length > 1 ? 's' : ''} moved` : ''}`,
      'success',
    );
    setReasonFor(null);
    setReason('');
  };

  return (
    <div className="space-y-4">
      {r.reservation && (
        <div className="space-y-2 rounded-md border border-st-hold/30 bg-st-hold/[0.06] p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-st-hold" aria-hidden />
            <span className="font-medium">
              Slot reserved at {r.reservation.pin} ({r.reservation.territoryId})
            </span>
            <span className="ml-auto text-xs tnum text-muted">
              until {fmtDateLong(r.reservation.deadline)}
              {r.reservation.extendedDays ? ` (+${r.reservation.extendedDays}d)` : ''}
            </span>
          </div>
          {r.reservation.milestones && (
            <ol className="flex flex-wrap gap-1.5">
              {r.reservation.milestones.map((m) => (
                <li key={m.key} className={cn('rounded-full border px-2 py-0.5 text-2xs', m.done ? 'border-st-approved/40 text-st-approved' : 'text-muted')}>
                  {m.done ? '✓ ' : ''}
                  {m.key === 'accept' ? 'Accept' : m.key === 'space' ? 'Space' : 'Verified'} · {fmtDate(m.due)}
                </li>
              ))}
            </ol>
          )}
          {reasonFor ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submitReason();
              }}
            >
              <label htmlFor="act-reason" className="sr-only">
                Reason
              </label>
              <input
                id="act-reason"
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonFor === 'extend' ? 'Reason for the extension (required)' : 'Reason for releasing (required)'}
                className="h-8 min-w-0 flex-1 rounded-md border bg-surface px-2.5 text-sm focus-ring"
              />
              <Button size="sm" variant="primary" type="submit" disabled={!reason.trim() || act.busy}>
                {reasonFor === 'extend' ? 'Extend +7 days' : 'Release slot'}
              </Button>
              <Button size="sm" type="button" onClick={() => setReasonFor(null)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setReasonFor('extend')}>
                <CalendarPlus /> Extend 7 days
              </Button>
              <Button size="sm" onClick={() => setReasonFor('release')}>
                <Unlock /> Release reservation
              </Button>
            </div>
          )}
        </div>
      )}

      {tasks.length > 0 ? (
        <ul className="space-y-2">
          {tasks.map((tk) => {
            const overdue = tk.status === 'Not started' && tk.dueDate < today;
            return (
              <li key={tk.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2.5">
                {tk.status === 'Verified' ? (
                  <CheckSquare className="h-4 w-4 text-st-approved" aria-hidden />
                ) : (
                  <Square className={cn('h-4 w-4', tk.status === 'Done — awaiting check' ? 'text-st-hold' : 'text-muted')} aria-hidden />
                )}
                <span className={cn('min-w-0 flex-1 text-sm', tk.status === 'Verified' && 'text-subtle line-through')}>{t('en', tk.code)}</span>
                <span className={cn('text-2xs', TASK_TONE[tk.status])}>{overdue ? `Overdue ${tk.overdueDays}d` : tk.status}</span>
                <span className={cn('flex items-center gap-1 text-xs tnum', overdue ? 'font-semibold text-st-rejected' : 'text-muted')}>
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  wk {tk.dueWeek} · {fmtDate(tk.dueDate)}
                </span>
                {tk.status === 'Done — awaiting check' && (
                  <Button size="sm" variant="primary" disabled={act.busy} onClick={() => act.setTask(r.id, tk.id, 'Verified', 'company')}>
                    <BadgeCheck /> Verify
                  </Button>
                )}
                {tk.status === 'Not started' && (
                  <Button size="sm" disabled={act.busy} onClick={() => act.setTask(r.id, tk.id, 'Done — awaiting check', 'company')} title="Record that the partner finished this">
                    Mark done
                  </Button>
                )}
                {tk.status === 'Verified' && (
                  <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => act.setTask(r.id, tk.id, 'Not started', 'company')} aria-label="Reopen task">
                    <Undo2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : decision.nextSteps.length ? (
        <ul className="space-y-2">
          {decision.nextSteps.map((st) => (
            <li key={st.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
              {st.done ? <CheckSquare className="h-4 w-4 text-st-approved" aria-hidden /> : <Square className="h-4 w-4 text-muted" aria-hidden />}
              <span className="flex-1 text-sm">{st.label}</span>
              <span className="hidden rounded-full bg-raised px-2 py-0.5 text-2xs text-muted sm:inline">{st.owner}</span>
              {r.reservation && st.owner === 'Partner' && <span className="text-xs tnum text-muted">{fmtDate(st.dueDate)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No next steps" />
      )}
    </div>
  );
}

function OnboardingTab({ decision, app }: { decision: Decision; app: Application }) {
  const plan = decision.onboarding;
  const p = decision.result.onboarding;
  if (!p) {
    return <EmptyState title="Onboarding starts after approval" icon={<GanttChartSquare className="h-5 w-5" />} />;
  }
  const modules = trainingFor(plan);
  const note = p.openingNote === 'TARGET_MET' ? (p.bufferWeeks > 0 ? t('en', 'OPEN_TARGET_MET', { buffer: p.bufferWeeks }) : t('en', 'OPEN_TARGET_EXACT')) : t('en', `OPEN_${p.openingNote}`);
  const shown = modules.length ? modules : p.modules.map((m) => ({ id: m.code, title: t('en', m.code), week: m.week, hours: 0, progress: 0 }));
  return (
    <div className="space-y-5">
      {p.preview && (
        <div className="flex items-center gap-2 rounded-md bg-raised px-3 py-2 text-xs text-muted">
          <Info className="h-4 w-4 shrink-0" aria-hidden /> Preview — the plan starts once the reservation becomes an approval.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Fact label="Week 1" value={fmtDate(p.startDate)} />
        <Fact label="Opening" value={`${fmtDate(p.openingDate)} · wk ${p.openingWeeks}`} />
        <Fact label="Training" value={`${p.track[0].toUpperCase()}${p.track.slice(1)} · ${p.trainingWeeks} wks`} />
        <Fact label="Buddy store" value={p.buddyStoreId} />
      </div>
      <p className="text-sm text-muted">
        {note}
        {p.mall ? ' Mall unit: +2 weeks for mall approval and fit-out.' : ''}
      </p>
      {p.occasion && (
        <p className={cn('flex gap-2 text-sm', p.occasion.met ? 'text-st-approved' : 'text-st-hold')}>
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Notes mention {p.occasion.label} ({fmtDate(p.occasion.date)}) — {p.occasion.met ? 'the opening is before it.' : 'the earliest safe opening is after it.'}
        </p>
      )}
      {plan && <OnboardingStepper plan={plan} />}
      {plan?.atRisk && (
        <div className="flex items-center gap-2 rounded-md bg-st-hold/10 px-3 py-2 text-xs text-st-hold">
          <AlertCircle className="h-4 w-4" aria-hidden /> {p.health}: {plan.riskNote}
        </div>
      )}
      {p.firstTimeOwner && <p className="text-xs text-muted">{t('en', 'FIRST_TIME_OWNER')}</p>}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label">Training plan</h3>
          <LanguageBadge language={app.language} size="sm" />
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shown.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
              <Ring value={m.progress} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{m.title}</span>
                <span className="text-2xs text-subtle tnum">
                  Wk {m.week}
                  {m.hours ? ` · ${m.hours} h` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="text-2xs text-subtle">{label}</div>
      <div className="font-medium tnum">{value}</div>
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

