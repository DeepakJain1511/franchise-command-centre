import { differenceInCalendarDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, Clock3, GraduationCap, Hexagon, LifeBuoy, ListChecks, MapPin, MessageCircle, Moon,
  PhoneCall, PlayCircle, Store, Sun, TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LanguageBadge, ReasonChip, StatusChip } from '@/components/chips';
import { CountUp, EmptyState, Reveal, Skeleton } from '@/components/data';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { useApplicants, usePinStates } from '@/engine/hooks';
import { ONBOARDING_STEPS, type NextStep, type OnboardingPlan, type OnboardingStep } from '@/engine/types';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { inrLakh, num } from '@/lib/format';
import { DEMO_TODAY, fmtDate, fmtDateLong, iso } from '@/lib/time';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { loadDataset } from '@/lib/actions';

/** What each stage means, in the partner's words. */
const STAGE_COPY: Record<OnboardingStep, { what: string; you: string }> = {
  Agreement: { what: 'Sign the franchise agreement and pay the brand fee.', you: 'Review and e-sign the agreement' },
  'Space ready': { what: 'Your shop space is confirmed and handed over.', you: 'Share keys, photos and the rent agreement' },
  'Fit-out': { what: 'Our projects team builds the store interior.', you: 'Approve the layout and be on site for handover' },
  Training: { what: 'You and your staff learn the brand, eye tests and the POS.', you: 'Finish all six training modules' },
  'Stock & systems': { what: 'Frames, lenses and the billing system arrive and are set up.', you: 'Check the stock delivery and test billing' },
  'Soft launch': { what: 'A quiet opening week with friends, family and local customers.', you: 'Run the store with our team beside you' },
  Open: { what: 'Your store is open to everyone.', you: 'Celebrate — and keep the first-month checklist handy' },
};

const PARTNER_OWNERS: NextStep['owner'][] = ['Partner'];

/* ------------------------------------------------------------------ */

export default function PartnerPage() {
  const { id } = useParams();
  const apps = useApplicants();
  const loaded = useData((s) => s.loaded);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loaded) void loadDataset('sample');
  }, [loaded]);

  const row = apps.data?.find((r) => r.app.id === id);
  useEffect(() => {
    document.title = row ? `${row.app.name} · Partner portal · Bunty Consulting` : 'Partner portal · Bunty Consulting';
  }, [row]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-brand-fg">
            <Hexagon className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Bunty Consulting</div>
            <div className="text-2xs text-subtle">Partner portal</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-dashed border-brand/40 bg-brand-soft px-2.5 py-1 text-2xs font-medium text-brand sm:inline">
              Demo — viewing as partner
            </span>
            {apps.data && (
              <Select
                ariaLabel="View as partner"
                className="h-8 w-52 text-xs"
                value={id}
                onChange={(v) => navigate(`/partner/${v}`)}
                options={apps.data.map((r) => ({ value: r.app.id, label: `${r.app.name} · ${r.decision.status === 'Approved' ? r.decision.onboarding?.current ?? 'Approved' : r.decision.status}` }))}
                placeholder="Pick a partner"
              />
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <Link to="/onboarding" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg focus-ring">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the company dashboard
        </Link>
        {!apps.data ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : !row ? (
          <PartnerPicker rows={apps.data} />
        ) : row.decision.onboarding ? (
          <OnboardingPortal row={row} plan={row.decision.onboarding} />
        ) : (
          <ApplicationPortal row={row} />
        )}
      </main>
      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PartnerPicker({ rows }: { rows: ApplicantRow[] }) {
  const onboarding = rows.filter((r) => r.decision.onboarding);
  const others = rows.filter((r) => !r.decision.onboarding).slice(0, 8);
  const Card = ({ r }: { r: ApplicantRow }) => (
    <Link to={`/partner/${r.app.id}`} className="card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift focus-ring">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
        {r.app.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.app.name}</div>
        <div className="text-2xs text-subtle">
          {r.app.city} · {r.decision.onboarding ? r.decision.onboarding.current : r.decision.status}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-subtle" />
    </Link>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partner portal</h1>
        <p className="text-sm text-muted">What a franchise partner sees about their own store. Pick someone to view as.</p>
      </div>
      <section>
        <h2 className="label mb-2">Onboarding partners</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {onboarding.map((r) => (
            <Card key={r.app.id} r={r} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="label mb-2">Applicants (not approved yet)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((r) => (
            <Card key={r.app.id} r={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ title, icon, children, className, aside }: { title: string; icon: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn('card p-5', className)}>
      <header className="mb-4 flex items-center gap-2">
        <span className="text-brand [&_svg]:size-4">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto">{aside}</div>
      </header>
      {children}
    </section>
  );
}

function BigRing({ value, label, sub }: { value: number; label: ReactNode; sub: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg width="128" height="128" className="-rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-white/20" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-white"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold tnum">{label}</div>
        <div className="text-[10px] text-white/75">{sub}</div>
      </div>
    </div>
  );
}

function OnboardingPortal({ row, plan }: { row: ApplicantRow; plan: OnboardingPlan }) {
  const { app } = row;
  const pins = usePinStates();
  const pin = pins.data?.find((p) => p.pin === app.pin);
  const doneSteps = plan.steps.filter((s) => s.state === 'done').length;
  const progress = plan.current === 'Open' ? 1 : doneSteps / ONBOARDING_STEPS.length;
  const daysLeft = differenceInCalendarDays(parseISO(plan.targetOpen), DEMO_TODAY);
  const isOpen = plan.current === 'Open';
  const firstName = app.name.split(' ')[0];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Reveal>
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-brand to-[hsl(205_45%_28%)] p-6 text-white shadow-lift md:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">Namaskara, {firstName} 👋</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {isOpen ? 'Your store is open!' : daysLeft > 0 ? (
                  <>
                    Your store opens in <CountUp value={daysLeft} /> days
                  </>
                ) : (
                  'Your opening date is here'
                )}
              </h1>
              <p className="mt-2 max-w-xl text-white/80">
                {isOpen ? `Opened on ${fmtDateLong(plan.targetOpen)} in ${pin?.area ?? app.city}.` : `Target opening ${fmtDateLong(plan.targetOpen)} · ${pin?.area ?? app.city}, ${app.city}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
                  Now: <b>{plan.current}</b>
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25 tnum">Step {ONBOARDING_STEPS.indexOf(plan.current) + 1} of 7</span>
                {plan.atRisk && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(38_85%_68%)] px-3 py-1 font-medium text-[hsl(30_40%_18%)]">
                    <TriangleAlert className="h-3.5 w-3.5" /> {plan.riskNote}
                  </span>
                )}
              </div>
            </div>
            <BigRing value={progress} label={`${Math.round(progress * 100)}%`} sub="of the journey" />
          </div>
        </section>
      </Reveal>

      {/* Journey */}
      <Reveal delay={0.06}>
        <Journey plan={plan} />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Reveal delay={0.12}>
          <NextSteps row={row} extra={partnerTasks(plan)} />
        </Reveal>
        <Reveal delay={0.16}>
          <div className="space-y-5">
            <StoreCard row={row} area={pin?.area} />
            <Help />
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <TrainingSection row={row} plan={plan} />
      </Reveal>
    </div>
  );
}

function Journey({ plan }: { plan: OnboardingPlan }) {
  const currentIdx = ONBOARDING_STEPS.indexOf(plan.current);
  const [sel, setSel] = useState<OnboardingStep>(plan.current);
  const s = plan.steps.find((x) => x.step === sel)!;
  const today = iso(DEMO_TODAY);
  return (
    <Section title="Your journey to opening" icon={<CalendarDays />}>
      <ol className="flex items-start" aria-label="Onboarding journey">
        {plan.steps.map((st, i) => {
          const done = st.state === 'done';
          const active = st.state === 'active';
          const picked = sel === st.step;
          return (
            <li key={st.step} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-4 h-1 w-full -translate-x-4 rounded-full', i <= currentIdx ? 'bg-brand' : 'bg-raised')} />}
              <button
                type="button"
                onClick={() => setSel(st.step)}
                aria-pressed={picked}
                aria-label={`${st.step}: ${st.state}`}
                className={cn(
                  'relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all focus-ring',
                  done ? 'border-brand bg-brand text-brand-fg' : active ? 'border-brand bg-surface text-brand ring-4 ring-brand/20' : 'border-border bg-surface text-subtle',
                  picked && 'scale-110 shadow-lift',
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <motion.span className="h-2.5 w-2.5 rounded-full bg-brand" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} /> : <span className="text-xs tnum">{i + 1}</span>}
              </button>
              <span className={cn('mt-2 hidden text-xs font-medium sm:block', active ? 'text-fg' : 'text-muted')}>{st.step}</span>
              <span className="hidden text-[10px] text-subtle tnum sm:block">{fmtDate(st.targetDate)}</span>
            </li>
          );
        })}
      </ol>
      <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-xl bg-raised/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{sel}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-2xs font-medium', s.state === 'done' ? 'bg-st-approved/10 text-st-approved' : s.state === 'active' ? 'bg-brand-soft text-brand' : 'bg-raised text-muted')}>
            {s.state === 'done' ? 'Done' : s.state === 'active' ? (s.targetDate < today ? 'In progress · running late' : 'In progress') : 'Coming up'}
          </span>
          <span className="ml-auto text-xs text-muted tnum">Target {fmtDateLong(s.targetDate)}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{STAGE_COPY[sel].what}</p>
        <p className="mt-1 text-sm">
          <span className="font-medium">Your part:</span> {STAGE_COPY[sel].you}
        </p>
      </motion.div>
    </Section>
  );
}

/** The partner's own part of the current and next stage (from the stage guide). */
function partnerTasks(plan: OnboardingPlan): NextStep[] {
  if (plan.current === 'Open') return [];
  return plan.steps
    .filter((st) => st.state !== 'done')
    .slice(0, 2)
    .map((st) => ({ id: 'you-' + st.step, label: STAGE_COPY[st.step].you, owner: 'Partner', dueDate: st.targetDate, done: false }));
}

function NextSteps({ row, extra = [] }: { row: ApplicantRow; extra?: NextStep[] }) {
  const toast = useUi((s) => s.toast);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const steps = [...extra, ...row.decision.nextSteps];
  const mine = steps.filter((s) => PARTNER_OWNERS.includes(s.owner));
  const team = steps.filter((s) => !PARTNER_OWNERS.includes(s.owner));
  const today = iso(DEMO_TODAY);
  const Item = ({ s, yours }: { s: NextStep; yours: boolean }) => {
    const isDone = done[s.id] ?? s.done;
    const late = !isDone && s.dueDate < today;
    return (
      <li className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
        {yours ? (
          <button
            type="button"
            onClick={() => {
              setDone((d) => ({ ...d, [s.id]: !isDone }));
              if (!isDone) toast('Marked done — the Bunty team is notified', 'success');
            }}
            aria-pressed={isDone}
            aria-label={isDone ? `Mark "${s.label}" not done` : `Mark "${s.label}" done`}
            className="focus-ring"
          >
            {isDone ? <CheckCircle2 className="h-5 w-5 text-st-approved" /> : <Circle className="h-5 w-5 text-subtle hover:text-brand" />}
          </button>
        ) : (
          <Clock3 className="h-5 w-5 text-subtle" aria-label="Handled by the Bunty team" />
        )}
        <span className={cn('flex-1 text-sm', isDone && 'text-subtle line-through')}>{s.label}</span>
        <span className={cn('text-xs tnum', late ? 'font-semibold text-st-rejected' : 'text-muted')}>{late ? `Overdue · ${fmtDate(s.dueDate)}` : `By ${fmtDate(s.dueDate)}`}</span>
      </li>
    );
  };
  return (
    <Section title="Your next steps" icon={<ListChecks />} aside={<span className="text-xs text-muted tnum">{mine.filter((s) => done[s.id] ?? s.done).length}/{mine.length} done</span>}>
      <h3 className="label mb-2">For you</h3>
      {mine.length ? (
        <ul className="space-y-2">
          {mine.map((s) => (
            <Item key={s.id} s={s} yours />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-raised/60 px-3 py-2.5 text-sm text-muted">Nothing for you right now — we're on it.</p>
      )}
      {team.length > 0 && (
        <>
          <h3 className="label mb-2 mt-4">The Bunty team is handling</h3>
          <ul className="space-y-2">
            {team.map((s) => (
              <Item key={s.id} s={s} yours={false} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function StoreCard({ row, area }: { row: ApplicantRow; area?: string }) {
  const { app } = row;
  const facts: Array<[string, ReactNode]> = [
    ['Location', `${area ?? '—'}, ${app.city}`],
    ['PIN code', <span className="tnum">{app.pin}</span>],
    ['Space', `${app.space}${app.spaceSqft ? ` · ${num(app.spaceSqft)} sq ft` : ''}${app.floor !== 'Not known' ? ` · ${app.floor}` : ''}`],
    ['Investment', inrLakh(app.investmentLakh)],
    ['Territory', row.decision.territoryId ?? '—'],
  ];
  return (
    <Section title="Your store" icon={<Store />}>
      <dl className="space-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-raised/60 px-3 py-2 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" /> PIN {app.pin} is reserved for your store — one store per PIN.
      </p>
    </Section>
  );
}

function Help() {
  const toast = useUi((s) => s.toast);
  return (
    <Section title="Need help?" icon={<LifeBuoy />}>
      <p className="text-sm text-muted">Your expansion manager replies within a working day.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => toast('Messaging opens in the full version')}>
          <MessageCircle /> Message
        </Button>
        <Button onClick={() => toast('Call booking opens in the full version')}>
          <PhoneCall /> Book a call
        </Button>
      </div>
    </Section>
  );
}

function TrainingSection({ row, plan }: { row: ApplicantRow; plan: OnboardingPlan }) {
  const toast = useUi((s) => s.toast);
  const modules = plan.training;
  const done = modules.filter((m) => m.progress >= 1).length;
  const hours = modules.reduce((n, m) => n + m.hours, 0);
  const hoursDone = modules.reduce((n, m) => n + m.hours * m.progress, 0);
  const weeks = [...new Set(modules.map((m) => m.week))];
  return (
    <Section
      title="Your training"
      icon={<GraduationCap />}
      aside={
        <span className="flex items-center gap-2">
          <LanguageBadge language={row.app.language} size="sm" />
          <span className="text-xs text-muted tnum">
            {done}/{modules.length} modules · {Math.round(hoursDone)}/{hours} h
          </span>
        </span>
      }
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-raised">
        <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(hoursDone / hours) * 100}%` }} transition={{ duration: 0.9 }} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {weeks.map((w) => (
          <div key={w}>
            <h3 className="label mb-2">Week {w}</h3>
            <ul className="space-y-2">
              {modules
                .filter((m) => m.week === w)
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        m.progress >= 1 ? 'bg-st-approved/10 text-st-approved' : m.progress > 0 ? 'bg-brand-soft text-brand' : 'bg-raised text-subtle',
                      )}
                    >
                      {m.progress >= 1 ? <Check className="h-4 w-4" strokeWidth={3} /> : <PlayCircle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="text-2xs text-subtle tnum">
                        {m.hours} h · {m.progress >= 1 ? 'Done' : m.progress > 0 ? `${Math.round(m.progress * 100)}% done` : 'Not started'}
                      </div>
                    </div>
                    {m.progress < 1 && (
                      <Button size="sm" variant={m.progress > 0 ? 'primary' : 'secondary'} onClick={() => toast(`"${m.title}" opens in the full version`)}>
                        {m.progress > 0 ? 'Continue' : 'Start'}
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

/** Not approved yet: show the application status and what would move it forward. */
function ApplicationPortal({ row }: { row: ApplicantRow }) {
  const { app, decision } = row;
  const firstName = app.name.split(' ')[0];
  const blockers = decision.reasons.filter((r) => r.sentiment !== 'helped');
  const strengths = decision.reasons.filter((r) => r.sentiment === 'helped');
  const FRIENDLY: Record<string, string> = {
    'On hold': "You're close. Sort out the points below and we'll pick your application up again.",
    Waitlisted: "Your application is strong, but every slot in your area is taken. We'll come back to you first when one opens.",
    'Needs info': 'A few details are missing. Add them and we can decide quickly.',
    Rejected: "Thank you for applying. Here's why we can't go ahead, and what might change that.",
  };
  const HEAD: Record<string, string> = {
    'On hold': 'Your application is on hold',
    Waitlisted: "You're on the waitlist",
    'Needs info': 'We need a little more from you',
    Rejected: "We can't go ahead this time",
  };
  return (
    <div className="space-y-5">
      <Reveal>
        <section className="card p-6 md:p-8">
          <p className="text-sm text-muted">Namaskara, {firstName} 👋</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{HEAD[decision.status] ?? 'Your application'}</h1>
            <StatusChip status={decision.status} />
          </div>
          <p className="mt-2 max-w-2xl text-muted">{FRIENDLY[decision.status] ?? "Here is where things stand."}</p>
          <p className="mt-1 text-xs text-subtle tnum">
            Application {app.id} · {app.city} · PIN {app.pin} · received {fmtDateLong(app.submittedAt)}
          </p>
        </section>
      </Reveal>
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal delay={0.06}>
          <Section title="What would move you forward" icon={<TriangleAlert />}>
            {blockers.length ? (
              <div className="flex flex-wrap gap-2">
                {blockers.map((r) => (
                  <ReasonChip key={r.id} reason={r} size="lg" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing blocking right now.</p>
            )}
            {strengths.length > 0 && (
              <>
                <h3 className="label mb-2 mt-4">Already working in your favour</h3>
                <div className="flex flex-wrap gap-2">
                  {strengths.map((r) => (
                    <ReasonChip key={r.id} reason={r} />
                  ))}
                </div>
              </>
            )}
          </Section>
        </Reveal>
        <Reveal delay={0.1}>
          {decision.nextSteps.length ? <NextSteps row={row} /> : <EmptyState title="No steps for you right now" />}
        </Reveal>
      </div>
      <Reveal delay={0.14}>
        <Help />
      </Reveal>
    </div>
  );
}
