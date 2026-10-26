import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, FlaskConical, History, Play, RotateCcw, Undo2, Waves } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ReasonChip, StatusChip } from '@/components/chips';
import { ListSkeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Segmented, Select, Slider, Switch } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { useApplicants, useScenarioCommit, useScenarioPresets, useSimulate } from '@/engine/hooks';
import type { Application, DecisionStatus, Floor, Reason, ScenarioChange, ScenarioResult, SpaceAvailable } from '@/engine/types';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { useAppDrawer } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

interface Draft {
  space: SpaceAvailable;
  floor: Floor;
  spaceSqft: number | null;
  launchMonths: number;
}

const fromApp = (a: Application): Draft => ({ space: a.space, floor: a.floor, spaceSqft: a.spaceSqft, launchMonths: a.launchMonths });

export interface SandboxRequest {
  appId: string;
  change?: ScenarioChange;
  autorun?: boolean;
  nonce: number;
}

export function Sandbox({ request }: { request: SandboxRequest | null }) {
  const apps = useApplicants();
  const presets = useScenarioPresets();
  const sim = useSimulate();
  const commit = useScenarioCommit();
  const toast = useUi((s) => s.toast);
  const simulations = useData((s) => s.simulations);
  const appliedIds = useData((s) => s.appliedIds);
  const addSimulation = useData((s) => s.addSimulation);
  const { openApp } = useAppDrawer();

  const [appId, setAppId] = useState('APP-012');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const row = apps.data?.find((r) => r.app.id === appId);
  const original = useMemo(() => (row ? fromApp(row.app) : null), [row]);

  // Reset the draft whenever the applicant changes (or data reloads)
  useEffect(() => {
    if (original) setDraft(original);
  }, [original]);

  const lastRun = useRef('');
  const run = async (change: ScenarioChange, opts: { quiet?: boolean } = {}) => {
    lastRun.current = JSON.stringify(change);
    const r = await sim.run(change);
    setResult(r);
    // Live re-runs only land in history when they produce a real outcome change.
    if (!opts.quiet || r.canned) addSimulation(r);
  };

  // External requests (from Ask, ?about=, or preset chips)
  useEffect(() => {
    if (!request) return;
    setAppId(request.appId);
    setResult(null);
    if (request.change && request.autorun) void run(request.change);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  // When a preset change arrives, mirror it in the controls once the applicant is loaded
  useEffect(() => {
    if (request?.change && original && request.appId === appId) {
      const c = request.change;
      setDraft({
        space: c.space ?? original.space,
        floor: c.floor ?? original.floor,
        spaceSqft: c.spaceSqft === undefined ? original.spaceSqft : c.spaceSqft,
        launchMonths: c.launchMonths ?? original.launchMonths,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce, original]);

  const edited = draft && original ? (Object.keys(draft) as Array<keyof Draft>).filter((k) => draft[k] !== original[k]) : [];
  const change: ScenarioChange | null = draft
    ? { applicationId: appId, ...Object.fromEntries(edited.map((k) => [k, draft[k]])) }
    : null;
  const applied = result ? appliedIds.includes(result.id) : false;

  // Live mode: re-run shortly after the user stops dragging / toggling.
  const [live, setLive] = useState(true);
  const changeKey = change && edited.length ? JSON.stringify(change) : '';
  useEffect(() => {
    if (!live || !changeKey || changeKey === lastRun.current || applied) return;
    const id = window.setTimeout(() => void run(JSON.parse(changeKey) as ScenarioChange, { quiet: true }), 450);
    return () => window.clearTimeout(id);
    // run is stable enough for this debounce; the key captures the inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeKey, live, applied]);

  const options = (apps.data ?? []).map((r) => ({ value: r.app.id, label: `${r.app.id} · ${r.app.name}` }));

  return (
    <section className="card flex flex-col" aria-label="What-if sandbox">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <FlaskConical className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">What-if sandbox</h2>
        <span className="ml-auto text-2xs text-subtle">Outcomes are canned in Phase 1</span>
      </header>

      <div className="space-y-4 p-4">
        {/* Suggested scenarios */}
        <div className="flex flex-wrap gap-1.5">
          {(presets.data ?? []).map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => {
                setAppId(p.applicationId);
                setResult(null);
                setDraft(null);
                setTimeout(() => {
                  const base = apps.data?.find((r) => r.app.id === p.applicationId)?.app;
                  if (base) setDraft({ ...fromApp(base), ...(p.change as Partial<Draft>) });
                  void run(p.change);
                }, 0);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-xs text-fg transition-colors hover:border-brand/50 focus-ring"
            >
              <Play className="h-3 w-3 text-brand" /> {p.title}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_1fr]">
          {/* Controls */}
          <div className="space-y-3.5 rounded-lg border bg-raised/40 p-3.5">
            <Select value={appId} onChange={(v) => (setAppId(v), setResult(null))} options={options} ariaLabel="Applicant" />
            {!draft || !original ? (
              <ListSkeleton rows={3} />
            ) : (
              <>
                <Field label="Space available" edited={edited.includes('space')}>
                  <Segmented<SpaceAvailable>
                    ariaLabel="Space available"
                    value={draft.space}
                    onChange={(v) => setDraft({ ...draft, space: v, spaceSqft: v === 'Not yet identified' ? null : draft.spaceSqft ?? 400 })}
                    className="w-full [&>*]:flex-1 [&>*]:justify-center"
                    options={[
                      { value: 'Owned', label: 'Owned' },
                      { value: 'Rented', label: 'Rented' },
                      { value: 'Not yet identified', label: 'None yet' },
                    ]}
                  />
                </Field>
                <Field label="Floor" edited={edited.includes('floor')}>
                  <Segmented<Floor>
                    ariaLabel="Floor"
                    value={draft.floor}
                    onChange={(v) => setDraft({ ...draft, floor: v })}
                    className="w-full [&>*]:flex-1 [&>*]:justify-center"
                    options={[
                      { value: 'Ground', label: 'Ground' },
                      { value: 'Upper', label: 'Upper' },
                      { value: 'Mall unit', label: 'Mall' },
                      { value: 'Not known', label: '?' , title: 'Not known' },
                    ]}
                  />
                </Field>
                <Field label="Space size" edited={edited.includes('spaceSqft')} value={draft.spaceSqft == null ? '—' : `${num(draft.spaceSqft)} sq ft`}>
                  <Slider
                    min={100}
                    max={1500}
                    step={10}
                    disabled={draft.space === 'Not yet identified'}
                    value={[draft.spaceSqft ?? 100]}
                    onValueChange={([v]) => setDraft({ ...draft, spaceSqft: v })}
                    thumbLabel="Space size in square feet"
                  />
                </Field>
                <Field label="Target launch" edited={edited.includes('launchMonths')} value={`${draft.launchMonths} mo`}>
                  <Slider min={1} max={12} step={1} value={[draft.launchMonths]} onValueChange={([v]) => setDraft({ ...draft, launchMonths: v })} thumbLabel="Months to launch" />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Button variant="primary" className="flex-1" disabled={!edited.length || sim.loading} onClick={() => change && run(change)}>
                    <Play /> {sim.loading ? 'Simulating…' : 'Simulate'}
                  </Button>
                  <Tooltip content="Back to submitted values">
                    <Button size="icon" onClick={() => (setDraft(original), setResult(null))} disabled={!edited.length} aria-label="Reset fields">
                      <RotateCcw />
                    </Button>
                  </Tooltip>
                </div>
                <label className="flex items-center justify-between gap-2 text-2xs text-muted">
                  <span>{live ? 'Live: re-runs as you change fields' : 'Live updates off'}</span>
                  <Switch checked={live} onCheckedChange={setLive} aria-label="Live simulation" />
                </label>
              </>
            )}
          </div>

          {/* Diff */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {sim.loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-60 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                    <FlaskConical className="h-6 w-6 text-brand" />
                  </motion.span>
                  <span className="text-sm text-muted">Re-running the decision…</span>
                </motion.div>
              ) : result ? (
                <motion.div key={result.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <Diff
                    result={result}
                    applied={applied}
                    busy={commit.busy}
                    onOpen={openApp}
                    onApply={async () => {
                      await commit.apply(result);
                      toast('Change applied — every screen is updated', 'success');
                    }}
                    onRevert={async () => {
                      await commit.revert(result.id);
                      toast('Change reverted');
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
                  <Waves className="h-6 w-6 text-subtle" />
                  <p className="text-sm text-muted">Pick a scenario or edit a field, then Simulate.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {simulations.length > 0 && (
          <div className="border-t pt-3">
            <h3 className="label mb-2 flex items-center gap-1.5">
              <History className="h-3 w-3" /> Recent simulations
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {simulations.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => (setAppId(s.change.applicationId), setResult(s))}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-raised focus-ring', result?.id === s.id && 'border-brand/50 bg-brand-soft')}
                  >
                    <span className="tnum text-muted">{s.change.applicationId}</span>
                    <MiniStatus s={s.before.status} />
                    <ArrowRight className="h-3 w-3 text-subtle" />
                    <MiniStatus s={s.after.status} />
                    {appliedIds.includes(s.id) && <Check className="h-3 w-3 text-st-approved" aria-label="applied" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, edited, value, children }: { label: string; edited?: boolean; value?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs">
        <span className="font-medium text-muted">{label}</span>
        {edited && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="edited" />}
        {value && <span className="ml-auto font-semibold tnum">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function MiniStatus({ s }: { s: DecisionStatus }) {
  return <StatusChip status={s} size="sm" />;
}

function Confidence({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex justify-between text-2xs text-subtle">
        <span>{label}</span>
        <span className="tnum">{Math.round(value * 100)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-raised">
        <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.6 }} />
      </div>
    </div>
  );
}

function Diff({ result, applied, busy, onOpen, onApply, onRevert }: {
  result: ScenarioResult;
  applied: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onApply: () => void;
  onRevert: () => void;
}) {
  const changed = result.before.status !== result.after.status;
  const beforeById = new Map(result.before.reasons.map((r) => [r.id, r]));
  const rows: Array<{ before?: Reason; after?: Reason; flipped: boolean }> = [
    ...result.after.reasons.map((a) => ({ before: beforeById.get(a.id), after: a, flipped: result.flipped.includes(a.id) })),
    ...result.before.reasons.filter((b) => !result.after.reasons.some((a) => a.id === b.id)).map((b) => ({ before: b, flipped: true })),
  ];
  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Badge change */}
      <div className="flex flex-wrap items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center gap-1">
          <span className="label">Before</span>
          <StatusChip status={result.before.status} size="lg" className={cn(changed && 'opacity-60')} />
        </div>
        <motion.span initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="mt-4">
          <ArrowRight className={cn('h-5 w-5', changed ? 'text-brand' : 'text-subtle')} />
        </motion.span>
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 18 }} className="flex flex-col items-center gap-1">
          <span className="label">After</span>
          <StatusChip status={result.after.status} size="lg" className={cn(changed && 'shadow-lift ring-2 ring-brand/30')} />
        </motion.div>
      </div>
      <div className="flex gap-4">
        <Confidence value={result.before.confidence} label="Confidence before" />
        <Confidence value={result.after.confidence} label="after" />
      </div>
      <p className="text-center text-sm">{result.sentence}</p>

      {/* Reason chips: before -> after */}
      <div>
        <h3 className="label mb-2">Reasons {result.flipped.length > 0 && <span className="normal-case tracking-normal text-brand">· {result.flipped.length} flipped</span>}</h3>
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <motion.li
              key={(r.after ?? r.before)!.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className={cn('flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5', r.flipped ? 'bg-brand-soft/70' : 'opacity-70')}
            >
              {r.flipped && r.before && (
                <>
                  <span className="opacity-60 line-through decoration-subtle">
                    <ReasonChip reason={r.before} />
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-brand" aria-label="becomes" />
                </>
              )}
              {r.after ? <ReasonChip reason={r.after} flipped={r.flipped} /> : <span className="text-2xs text-subtle">no longer applies</span>}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Ripple effects */}
      {result.ripples.length > 0 && (
        <div>
          <h3 className="label mb-2 flex items-center gap-1.5">
            <Waves className="h-3 w-3" /> Ripple effect
          </h3>
          <ul className="divide-y rounded-md border">
            {result.ripples.map((rp, i) => {
              const isStatus = (v: string): v is DecisionStatus => ['Approved', 'On hold', 'Waitlisted', 'Rejected', 'Needs info'].includes(v);
              return (
                <motion.li
                  key={rp.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  {rp.applicationId ? (
                    <button type="button" onClick={() => onOpen(rp.applicationId!)} className="whitespace-nowrap font-medium text-brand hover:underline focus-ring tnum">
                      {rp.label}
                    </button>
                  ) : (
                    <span className="font-medium tnum">{rp.label}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    {isStatus(rp.before) ? <StatusChip status={rp.before} size="sm" /> : <span className="text-muted tnum">{rp.before}</span>}
                    <ArrowRight className="h-3.5 w-3.5 text-subtle" />
                    {isStatus(rp.after) ? <StatusChip status={rp.after} size="sm" /> : <span className="font-semibold tnum">{rp.after}</span>}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {applied ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-st-approved">
              <Check className="h-3.5 w-3.5" /> Applied to the dashboard
            </span>
            <Button className="ml-auto" onClick={onRevert} disabled={busy}>
              <Undo2 /> Revert
            </Button>
          </>
        ) : (
          <>
            {!result.canned && <span className="text-2xs text-subtle">No decision change for this edit in the demo</span>}
            <Tooltip content={result.canned ? 'Update every screen with this outcome' : 'Nothing to apply — the decision does not change'}>
              <span className="ml-auto">
                <Button variant="primary" onClick={onApply} disabled={!result.canned || busy}>
                  <Check /> Apply change
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
