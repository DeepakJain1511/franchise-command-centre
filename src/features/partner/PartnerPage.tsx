import { differenceInCalendarDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, Clock3, GraduationCap, Hexagon, Info, Languages, ListChecks,
  MapPin, Moon, PlayCircle, Scale, Store, Sun, TrendingUp,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LanguageBadge, StatusChip } from '@/components/chips';
import { CountUp, Reveal, Skeleton } from '@/components/data';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { useApplicants, useEngineActions, usePartnerProfile, usePinStates } from '@/engine/hooks';
import type { AppResult, OnboardingDetail, PlanTask, StageKey } from '@/engine/model';
import { currentStage, isStoreOpen } from '@/engine/onboarding';
import { nextStepTexts, textOf } from '@/engine/present';
import { LANG_LABEL, LANG_OF, t, type Lang } from '@/i18n';
import { ensureLoaded } from '@/lib/actions';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { inrLakh, num } from '@/lib/format';
import { DEMO_TODAY, fmtDate, fmtDateLong, iso } from '@/lib/time';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { ChatCard, ExtrasSkeleton, ManagerCard, PaybackCard } from './PartnerExtras';
import { StaffTraining } from './StaffTraining';

const STAGES: Array<StageKey | 'Approved'> = ['Approved', 'Agreement', 'Licences', 'Fit-out', 'Training', 'Stock & staff', 'Soft launch', 'Open'];
const TS_KEY = { 'Not started': 'TS_NOT_STARTED', 'Done — awaiting check': 'TS_DONE', Verified: 'TS_VERIFIED' } as const;

/* ------------------------------------------------------------------ */

export default function PartnerPage() {
  const { id } = useParams();
  const apps = useApplicants();
  const loaded = useData((s) => s.loaded);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const navigate = useNavigate();
  const row = apps.data?.find((r) => r.app.id === id);
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    if (!loaded) void ensureLoaded();
  }, [loaded]);
  // Shown in the applicant's preferred language, with a toggle (spec §14).
  useEffect(() => {
    if (row) setLang(LANG_OF[row.app.language]);
  }, [row?.app.id, row?.app.language]); // eslint-disable-line react-hooks/exhaustive-deps
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
            {row && (
              <div className="flex items-center gap-0.5 rounded-full border p-0.5" role="group" aria-label={t(lang, 'UI_LANGUAGE')}>
                <Languages className="mx-1 h-3.5 w-3.5 text-subtle" aria-hidden />
                {(['en', 'kn', 'hi'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={cn('rounded-full px-2 py-0.5 text-2xs font-medium focus-ring', lang === l ? 'bg-brand text-brand-fg' : 'text-muted hover:text-fg')}
                  >
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
            )}
            {apps.data && (
              <Select
                ariaLabel="View as partner"
                className="hidden h-8 w-52 text-xs sm:flex"
                value={id}
                onChange={(v) => navigate(`/partner/${v}`)}
                options={apps.data.map((r) => ({ value: r.app.id, label: `${r.app.id} · ${r.app.name}` }))}
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
          <PartnerPicker rows={apps.data} unknown={id} />
        ) : row.decision.result.outcome === 'APPROVE' && row.decision.result.onboarding ? (
          <OnboardingPortal row={row} plan={row.decision.result.onboarding} lang={lang} />
        ) : (
          <ApplicationPortal row={row} lang={lang} />
        )}
      </main>
      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PartnerPicker({ rows, unknown }: { rows: ApplicantRow[]; unknown?: string }) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const go = () => {
    const m = typed.trim().match(/(\d{1,4})/);
    const id = m ? `APP-${m[1].padStart(3, '0')}` : typed.trim().toUpperCase();
    navigate(`/partner/${id}`);
  };
  const approved = rows.filter((r) => r.decision.result.outcome === 'APPROVE');
  const others = rows.filter((r) => r.decision.result.outcome !== 'APPROVE');
  const Card = ({ r }: { r: ApplicantRow }) => (
    <Link to={`/partner/${r.app.id}`} className="card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift focus-ring">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
        {r.app.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.app.name}</div>
        <div className="truncate text-2xs text-subtle">
          {r.app.id} · {r.decision.text.outcome}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-subtle" />
    </Link>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partner portal</h1>
        <p className="text-sm text-muted">What every applicant sees about their own application — in their language.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="card flex flex-wrap items-center gap-2 p-4"
      >
        <label htmlFor="partner-id" className="w-full text-sm font-medium">
          {t('en', 'UI_ENTER_ID')}
        </label>
        <input
          id="partner-id"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="APP-012"
          className="h-10 w-48 rounded-md border bg-surface px-3 text-sm tnum shadow-soft focus-ring"
          autoFocus
        />
        <Button type="submit" variant="primary" disabled={!typed.trim()}>
          {t('en', 'UI_GO')} <ChevronRight />
        </Button>
        <p className="w-full text-2xs text-subtle">{t('en', 'UI_PICK')}</p>
        {unknown && <p className="w-full text-xs text-st-rejected">No application {unknown} in this dataset.</p>}
      </form>
      <section>
        <h2 className="label mb-2">Approved partners</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {approved.map((r) => (
            <Card key={r.app.id} r={r} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="label mb-2">Everyone else</h2>
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
          cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-white" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold tnum">{label}</div>
        <div className="text-[10px] text-white/75">{sub}</div>
      </div>
    </div>
  );
}

/** "Why this decision" — spec §12.3: outcome, main + other reasons, score breakdown, warnings. Shown to every applicant. */
function WhyCard({ r, lang }: { r: AppResult; lang: Lang }) {
  const txt = textOf(r, lang);
  return (
    <Section title={t(lang, 'UI_WHY')} icon={<Scale />}>
      <p className="text-[15px] leading-snug">{txt.main}</p>
      {txt.others.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {txt.others.map((o, i) => (
            <li key={i} className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden /> {o}
            </li>
          ))}
        </ul>
      )}
      <h3 className="label mb-2 mt-4">{t(lang, 'UI_SCORE')}</h3>
      <ScoreBreakdown r={r} lang={lang} />
      {txt.warnings.length > 0 && (
        <>
          <h3 className="label mb-2 mt-4">{t(lang, 'UI_WARNINGS')}</h3>
          <ul className="space-y-1">
            {txt.warnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm text-st-hold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/* ---------------- Approved: the onboarding portal ---------------- */

function OnboardingPortal({ row, plan, lang }: { row: ApplicantRow; plan: OnboardingDetail; lang: Lang }) {
  const { app } = row;
  const r = row.decision.result;
  const pins = usePinStates();
  const profile = usePartnerProfile(app.id);
  const pin = pins.data?.find((p) => p.pin === (r.slotPin ?? app.pin));
  const done = plan.tasks.filter((x) => x.status !== 'Not started').length;
  const progress = plan.tasks.length ? done / plan.tasks.length : 0;
  const daysLeft = differenceInCalendarDays(parseISO(plan.openingDate), DEMO_TODAY);
  const isOpen = isStoreOpen(plan);
  const cur = currentStage(plan);
  const firstName = app.name.split(' ')[0];
  const place = `${pin?.area && pin.area !== '—' ? `${pin.area}, ` : ''}${app.city}`;

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-brand to-[hsl(205_45%_28%)] p-6 text-white shadow-lift md:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">{t(lang, 'UI_HELLO', { name: firstName })}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                {isOpen ? t(lang, 'UI_STORE_OPEN') : daysLeft > 0 ? (
                  <>
                    {t(lang, 'UI_OPENS_IN', { n: '§' }).split('§')[0]}
                    <CountUp value={daysLeft} />
                    {t(lang, 'UI_OPENS_IN', { n: '§' }).split('§')[1]}
                  </>
                ) : (
                  t(lang, 'UI_OPENING_DUE')
                )}
              </h1>
              <p className="mt-2 max-w-xl text-white/80">{t(lang, 'UI_TARGET_OPENING', { date: fmtDateLong(plan.openingDate), place })}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
                  {t(lang, 'UI_NOW')}: <b>{t(lang, `STAGE_${cur}`)}</b>
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25 tnum">{t(lang, 'UI_STEP_OF', { n: STAGES.indexOf(cur) + 1, total: STAGES.length })}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">{t(lang, `TRACK_${plan.track}`)}</span>
                {plan.health !== 'On track' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(38_85%_68%)] px-3 py-1 font-medium text-[hsl(30_40%_18%)]">
                    <AlertTriangle className="h-3.5 w-3.5" /> {plan.health}: {plan.healthReason}
                  </span>
                )}
              </div>
            </div>
            <BigRing value={progress} label={`${Math.round(progress * 100)}%`} sub={t(lang, 'UI_OF_JOURNEY')} />
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.06}>
        <Journey plan={plan} lang={lang} />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Reveal delay={0.1}>
          <TaskList appId={app.id} tasks={plan.tasks} lang={lang} />
        </Reveal>
        <Reveal delay={0.14}>
          <div className="space-y-5">
            <StoreCard row={row} plan={plan} area={pin?.area} lang={lang} />
            {profile.data ? <ManagerCard profile={profile.data} /> : <ExtrasSkeleton />}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.16}>
        <div className="grid gap-5 lg:grid-cols-2">
          <WhyCard r={r} lang={lang} />
          {profile.data ? <ChatCard profile={profile.data} /> : <ExtrasSkeleton />}
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <TrainingSection row={row} plan={plan} lang={lang} />
      </Reveal>

      <Reveal delay={0.22}>{profile.data ? <PaybackCard profile={profile.data} /> : <ExtrasSkeleton />}</Reveal>

      <Reveal delay={0.24}>
        <StaffTraining appId={app.id} storeName={`Bunty ${pin?.area ?? app.city}`} partnerLanguage={app.language} managerName={profile.data?.manager.name ?? 'Bunty team'} />
      </Reveal>
    </div>
  );
}

/** Spec §14: 8-stage progress bar (Approved → … → Open). A stage is done when the brand has verified its tasks. */
function Journey({ plan, lang }: { plan: OnboardingDetail; lang: Lang }) {
  const cur = currentStage(plan);
  const open = isStoreOpen(plan);
  const curIdx = open ? STAGES.length : STAGES.indexOf(cur);
  const [sel, setSel] = useState<StageKey | 'Approved'>(cur);
  useEffect(() => setSel(cur), [cur]);
  const stage = plan.stages.find((s) => s.stage === sel);
  const tasks = plan.tasks.filter((x) => x.stage === sel);
  const dateOf = (s: StageKey | 'Approved') => (s === 'Approved' ? plan.startDate : plan.stages.find((x) => x.stage === s)?.endDate ?? plan.openingDate);
  return (
    <Section title={t(lang, 'UI_JOURNEY')} icon={<CalendarDays />}>
      <ol className="flex items-start" aria-label={t(lang, 'UI_JOURNEY')}>
        {STAGES.map((st, i) => {
          const done = i < curIdx;
          const active = i === curIdx;
          return (
            <li key={st} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-4 h-1 w-full -translate-x-4 rounded-full', i <= curIdx ? 'bg-brand' : 'bg-raised')} />}
              <button
                type="button"
                onClick={() => setSel(st)}
                aria-pressed={sel === st}
                aria-label={t(lang, `STAGE_${st}`)}
                className={cn(
                  'relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all focus-ring',
                  done ? 'border-brand bg-brand text-brand-fg' : active ? 'border-brand bg-surface text-brand ring-4 ring-brand/20' : 'border-border bg-surface text-subtle',
                  sel === st && 'scale-110 shadow-lift',
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <motion.span className="h-2.5 w-2.5 rounded-full bg-brand" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} /> : <span className="text-xs tnum">{i + 1}</span>}
              </button>
              <span className={cn('mt-2 hidden text-xs font-medium sm:block', active ? 'text-fg' : 'text-muted')}>{t(lang, `STAGE_${st}`)}</span>
              <span className="hidden text-[10px] text-subtle tnum sm:block">{fmtDate(dateOf(st))}</span>
            </li>
          );
        })}
      </ol>
      <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-xl bg-raised/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t(lang, `STAGE_${sel}`)}</span>
          {stage && (
            <span className="ml-auto text-xs text-muted tnum">
              {t(lang, 'UI_WEEK')} {stage.startWeek}–{stage.endWeek} · {fmtDate(stage.startDate)} → {fmtDate(stage.endDate)}
            </span>
          )}
        </div>
        {sel === 'Approved' ? (
          <p className="mt-2 text-sm text-muted">
            {t(lang, 'O_APPROVE')} · {fmtDateLong(plan.startDate)}
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {tasks.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                {x.status === 'Verified' ? <CheckCircle2 className="h-4 w-4 text-st-approved" /> : x.status === 'Done — awaiting check' ? <Clock3 className="h-4 w-4 text-st-hold" /> : <Circle className="h-4 w-4 text-subtle" />}
                <span className="flex-1">{t(lang, x.code)}</span>
                <span className="text-xs text-muted tnum">{fmtDate(x.dueDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </Section>
  );
}

/** Task list with due dates and "Mark as done" (partner) → "Done — awaiting check" → the brand verifies (spec §15 loop). */
function TaskList({ appId, tasks, lang }: { appId: string; tasks: PlanTask[]; lang: Lang }) {
  const act = useEngineActions();
  const toast = useUi((s) => s.toast);
  const today = iso(DEMO_TODAY);
  const open = tasks.filter((x) => x.status !== 'Verified');
  const verified = tasks.filter((x) => x.status === 'Verified');
  return (
    <Section
      title={t(lang, 'UI_TASKS')}
      icon={<ListChecks />}
      aside={<span className="text-xs text-muted tnum">{tasks.filter((x) => x.status !== 'Not started').length}/{tasks.length}</span>}
    >
      {open.length === 0 ? (
        <p className="rounded-xl bg-raised/60 px-3 py-2.5 text-sm text-muted">{t(lang, 'UI_NOTHING')}</p>
      ) : (
        <ul className="space-y-2">
          {open.map((x) => {
            const late = x.status === 'Not started' && x.dueDate < today;
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5">
                {x.status === 'Done — awaiting check' ? <Clock3 className="h-5 w-5 text-st-hold" aria-hidden /> : <Circle className="h-5 w-5 text-subtle" aria-hidden />}
                <span className="min-w-0 flex-1 text-sm">{t(lang, x.code)}</span>
                <span className={cn('text-xs tnum', late ? 'font-semibold text-st-rejected' : 'text-muted')}>
                  {late ? `${t(lang, 'TS_OVERDUE')} · ` : `${t(lang, 'UI_DUE')} `}
                  {fmtDate(x.dueDate)}
                </span>
                {x.status === 'Not started' ? (
                  <Button
                    size="sm"
                    disabled={act.busy}
                    onClick={async () => {
                      await act.setTask(appId, x.id, 'Done — awaiting check', 'partner');
                      toast(t(lang, 'UI_MARKED'), 'success');
                    }}
                  >
                    <Check /> {t(lang, 'UI_MARK_DONE')}
                  </Button>
                ) : (
                  <span className="text-2xs font-medium text-st-hold">{t(lang, TS_KEY[x.status])}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {verified.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-st-approved">
          <CheckCircle2 className="h-3.5 w-3.5" /> {verified.length} {t(lang, 'TS_VERIFIED').toLowerCase()}
        </p>
      )}
      <p className="mt-3 text-2xs text-subtle">{t(lang, 'UI_TEAM')}</p>
    </Section>
  );
}

function StoreCard({ row, plan, area, lang }: { row: ApplicantRow; plan: OnboardingDetail; area?: string; lang: Lang }) {
  const { app } = row;
  const r = row.decision.result;
  const facts: Array<[string, ReactNode]> = [
    [t(lang, 'UI_LOCATION'), `${area && area !== '—' ? `${area}, ` : ''}${app.city}`],
    ['PIN', <span className="tnum">{r.slotPin ?? app.pin}</span>],
    [t(lang, 'FACTOR_space'), `${app.space}${app.spaceSqft ? ` · ${num(app.spaceSqft)} sq ft` : ''}${app.floor !== 'Not known' ? ` · ${app.floor}` : ''}`],
    [t(lang, 'FACTOR_money'), inrLakh(app.investmentLakh)],
    [t(lang, 'UI_OPENING'), fmtDateLong(plan.openingDate)],
    [t(lang, 'UI_BUDDY'), plan.buddyStoreId],
  ];
  const note = plan.openingNote === 'TARGET_MET' ? (plan.bufferWeeks > 0 ? t(lang, 'OPEN_TARGET_MET', { buffer: plan.bufferWeeks }) : t(lang, 'OPEN_TARGET_EXACT')) : t(lang, `OPEN_${plan.openingNote}`);
  return (
    <Section title={t(lang, 'UI_YOUR_STORE')} icon={<Store />}>
      <dl className="space-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">{note}</p>
      {plan.occasion && (
        <p className={cn('mt-1 text-xs', plan.occasion.met ? 'text-st-approved' : 'text-st-hold')}>
          {t(lang, 'W_NOTES_DATE', { label: plan.occasion.label, date: fmtDate(plan.occasion.date), verdict: t(lang, plan.occasion.met ? 'W_NOTES_DATE_met' : 'W_NOTES_DATE_missed') })}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-raised/60 px-3 py-2 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" /> {t(lang, 'UI_PIN_RESERVED', { pin: r.slotPin ?? app.pin })}
      </p>
    </Section>
  );
}

function TrainingSection({ row, plan, lang }: { row: ApplicantRow; plan: OnboardingDetail; lang: Lang }) {
  const toast = useUi((s) => s.toast);
  const trainingDone = plan.tasks.find((x) => x.code === 'TASK_TRAINING_DONE')?.status !== 'Not started';
  const weeks = [...new Set(plan.modules.map((m) => m.week))].sort((a, b) => a - b);
  return (
    <Section
      title={t(lang, 'UI_TRAINING')}
      icon={<GraduationCap />}
      aside={
        <span className="flex items-center gap-2">
          <LanguageBadge language={row.app.language} size="sm" />
          <span className="text-xs text-muted">{t(lang, `TRACK_${plan.track}`)}</span>
        </span>
      }
    >
      {plan.firstTimeOwner && <p className="mb-3 rounded-xl bg-brand-soft/60 px-3 py-2 text-sm">{t(lang, 'FIRST_TIME_OWNER')}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {weeks.map((w) => (
          <div key={w}>
            <h3 className="label mb-2">
              {t(lang, 'UI_WEEK')} {w}
            </h3>
            <ul className="space-y-2">
              {plan.modules
                .filter((m) => m.week === w)
                .map((m) => (
                  <li key={m.code} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', trainingDone ? 'bg-st-approved/10 text-st-approved' : m.extra ? 'bg-st-needs/10 text-st-needs' : 'bg-raised text-subtle')}>
                      {trainingDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <PlayCircle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t(lang, m.code)}</div>
                      {m.extra && <div className="text-2xs text-st-needs">+</div>}
                    </div>
                    {!trainingDone && (
                      <Button size="sm" onClick={() => toast('Training content opens in the full version')}>
                        {t(lang, 'UI_START')}
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

/* ---------------- Everyone not approved yet ---------------- */

function Tracker({ steps }: { steps: Array<{ label: string; sub?: string; done: boolean; active?: boolean }> }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-4 h-1 w-full -translate-x-4 rounded-full', s.done || s.active ? 'bg-brand' : 'bg-raised')} />}
          <span
            className={cn(
              'relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2',
              s.done ? 'border-brand bg-brand text-brand-fg' : s.active ? 'border-brand bg-surface text-brand ring-4 ring-brand/20' : 'border-border bg-surface text-subtle',
            )}
          >
            {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs tnum">{i + 1}</span>}
          </span>
          <span className="mt-2 text-xs font-medium">{s.label}</span>
          {s.sub && <span className="text-[10px] text-subtle tnum">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
}

function ApplicationPortal({ row, lang }: { row: ApplicantRow; lang: Lang }) {
  const { app, decision } = row;
  const r = decision.result;
  const profile = usePartnerProfile(app.id);
  const txt = textOf(r, lang);
  const steps = nextStepTexts(r, lang);
  const firstName = app.name.split(' ')[0];
  const res = r.reservation;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <Reveal>
        <section className="card p-6 md:p-8">
          <p className="text-sm text-muted">{t(lang, 'UI_HELLO', { name: firstName })}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{txt.outcome}</h1>
            <StatusChip status={decision.status} />
            {res && <span className="rounded-full bg-st-hold/10 px-2.5 py-1 text-xs font-medium text-st-hold tnum">{t(lang, 'UI_RESERVED')} · {t(lang, 'UI_UNTIL', { date: fmtDateLong(res.deadline) })}</span>}
            {r.waitlistType === 'QUALIFIED' && r.queuePosition && <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-medium tnum">{t(lang, 'UI_IN_LINE', { n: r.queuePosition })}</span>}
          </div>
          <p className="mt-2 max-w-2xl text-[15px]">{txt.main}</p>
          <p className="mt-1 text-xs text-subtle tnum">{t(lang, 'UI_RECEIVED', { id: app.id, city: app.city, pin: app.pin })}</p>

          {r.outcome === 'HOLD_RESERVED' && (
            <div className="mt-5">
              <Tracker steps={[
                { label: t(lang, 'UI_RESERVED'), sub: fmtDate(res!.awardedOn), done: true },
                { label: t(lang, 'UI_FIX'), sub: fmtDate(res!.deadline), done: false, active: true },
                { label: t(lang, 'UI_APPROVED'), done: false },
              ]} />
            </div>
          )}
          {r.outcome === 'REDIRECT_RESERVED' && res?.milestones && (
            <div className="mt-5 space-y-3">
              <p className="text-sm">
                {t(lang, 'UI_NEW_PIN')}: <b className="tnum">{r.slotPin}</b> ({r.slotTerritoryId})
              </p>
              <Tracker steps={[
                { label: t(lang, 'UI_ACCEPT'), sub: fmtDate(res.milestones[0].due), done: res.milestones[0].done, active: !res.milestones[0].done },
                { label: t(lang, 'UI_FIND_SPACE'), sub: fmtDate(res.milestones[1].due), done: res.milestones[1].done, active: res.milestones[0].done && !res.milestones[1].done },
                { label: t(lang, 'UI_VERIFIED'), sub: fmtDate(res.milestones[2].due), done: res.milestones[2].done },
                { label: t(lang, 'UI_APPROVED'), done: false },
              ]} />
            </div>
          )}
          {(r.outcome === 'WAITLIST' || r.outcome === 'HOLD') && (
            <p className="mt-4 inline-flex rounded-full bg-raised px-3 py-1 text-xs font-medium tnum">
              {t(lang, 'UI_SCORE_VS_BAR', { score: Math.round(r.adjustedPct), bar: r.bar })}
              {r.waitlistType === 'BELOW_BAR' ? ` · ${t(lang, 'UI_BELOW_BAR_NOTE')}` : ''}
            </p>
          )}
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal delay={0.06}>
          <WhyCard r={r} lang={lang} />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="space-y-5">
            <Section title={r.outcome === 'REJECT' ? t(lang, 'UI_REAPPLY') : t(lang, 'UI_NEXT')} icon={<ListChecks />}>
              {steps.length ? (
                <ul className="space-y-2">
                  {steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 rounded-xl border px-3 py-2.5">
                      {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-st-approved" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
                      <span className="flex-1 text-sm">{s.label}</span>
                      {s.due && <span className="text-xs text-muted tnum">{fmtDate(s.due)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t(lang, 'UI_NOTHING')}</p>
              )}
              {r.outcome === 'HOLD' && r.holdType !== 'STRONG_WAITING' && <p className="mt-3 text-xs text-muted">{t(lang, 'UI_REASSESSED')}</p>}
            </Section>
            {txt.tips.length > 0 && r.outcome !== 'REJECT' && (
              <Section title={t(lang, 'UI_TIPS')} icon={<TrendingUp />}>
                <ul className="space-y-1.5">
                  {txt.tips.map((x, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-st-approved" aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.14}>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          {profile.data ? <ManagerCard profile={profile.data} /> : <ExtrasSkeleton />}
          {profile.data ? <ChatCard profile={profile.data} /> : <ExtrasSkeleton />}
        </div>
      </Reveal>
    </div>
  );
}
