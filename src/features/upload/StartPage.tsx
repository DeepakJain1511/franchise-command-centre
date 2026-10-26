import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Download, FileSpreadsheet, Hexagon, Loader2, Moon, RotateCcw, Sparkles, Sun, Swords, TriangleAlert, Upload, Users,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, FlagChip, PriorityChip, StatusChip } from '@/components/chips';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { useApplicants, useDataset, useTerritoryStates } from '@/engine/hooks';
import { loadDataset } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { inrLakh } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { checkWorkbook, fileTypeError, type WorkbookCheck } from './checkWorkbook';

const STAGES = ['Reading sheets', 'Checking data', 'Matching PINs to territories', 'Deciding', 'Preparing onboarding'];
type Phase = 'idle' | 'processing' | 'done' | 'error';
type Preview = 'apps' | 'territories' | 'flags' | 'competing' | null;

export default function StartPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [check, setCheck] = useState<WorkbookCheck | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const loaded = useData((s) => s.loaded);

  useEffect(() => {
    document.title = 'Start · Bunty Consulting';
  }, []);

  const tick = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

  const run = async (source: 'sample' | File) => {
    setPhase('processing');
    setErrors([]);
    setCheck(null);
    setStage(0);
    setFileName(source === 'sample' ? null : source.name);
    try {
      if (source !== 'sample') {
        const typeErr = fileTypeError(source);
        if (typeErr) throw new UserError([typeErr]);
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await source.arrayBuffer());
        await tick(350);
        setStage(1);
        const c = checkWorkbook(wb, XLSX.utils);
        setCheck(c);
        if (!c.ok) throw new UserError(c.errors);
        await tick(350);
      } else {
        await tick(300);
        setStage(1);
        await tick(300);
      }
      const loading = loadDataset(source);
      for (let i = 2; i < STAGES.length; i++) {
        setStage(i);
        await tick(380);
      }
      await loading;
      setStage(STAGES.length);
      setPhase('done');
    } catch (e) {
      setErrors(e instanceof UserError ? e.messages : ['That file could not be read. Is it the Excel template?']);
      setPhase('error');
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void run(f);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,hsl(var(--brand)/0.10),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />

      <header className="relative flex items-center gap-3 px-4 py-4 md:px-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-brand-fg shadow-soft">
          <Hexagon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-semibold tracking-tight">Bunty Consulting</span>
        <div className="ml-auto flex items-center gap-1">
          {loaded && phase === 'idle' && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/overview')}>
              Back to dashboard <ArrowRight />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-2xl flex-col items-center px-4 pb-16 pt-6 text-center md:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.1]">
          From applications to open stores.
        </h1>
        <p className="mt-3 text-base text-muted">Upload the Excel. See who to approve, where, and why.</p>

        <AnimatePresence mode="wait">
          {(phase === 'idle' || phase === 'error') && (
            <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-8 w-full">
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
                onDragOver={(e) => (e.preventDefault(), setDrag(true))}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  onFiles(e.dataTransfer.files);
                }}
                aria-label="Upload Excel file: drop it here or press Enter to browse"
                className={cn(
                  'card group flex cursor-pointer flex-col items-center gap-4 border-2 border-dashed px-6 py-10 transition-all focus-ring',
                  drag ? 'scale-[1.01] border-brand bg-brand-soft' : 'hover:border-brand/50 hover:shadow-lift',
                )}
              >
                <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-transform', drag && 'scale-110')}>
                  <Upload className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-semibold">Drop your Excel here</p>
                  <p className="text-sm text-muted">or click to browse · .xlsx</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2" aria-label="Expected sheets">
                  <SheetChip>Applications</SheetChip>
                  <SheetChip>Territories</SheetChip>
                  <SheetChip builtIn>Existing stores</SheetChip>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onFiles(e.target.files)} />
              </div>

              {phase === 'error' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="mt-4 rounded-lg border border-st-rejected/30 bg-st-rejected/[0.06] p-4 text-left">
                  <p className="flex items-center gap-2 text-sm font-semibold text-st-rejected">
                    <AlertTriangle className="h-4 w-4" /> {fileName ?? 'This file'} needs a fix
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {errors.map((e) => (
                      <li key={e} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-st-rejected" aria-hidden /> {e}
                      </li>
                    ))}
                  </ul>
                  {check && <SheetSummary check={check} className="mt-3" />}
                </motion.div>
              )}

              <div className="mt-6 flex flex-col items-center gap-3">
                <Button variant="primary" size="lg" onClick={() => run('sample')} className="min-w-64 shadow-lift">
                  <Sparkles /> Try with sample data
                </Button>
                <a href="/Case1_Franchise_Test_Data_Format.xlsx" download className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg focus-ring">
                  <Download className="h-4 w-4" /> Download template
                </a>
              </div>
            </motion.div>
          )}

          {phase === 'processing' && (
            <motion.div key="proc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mt-8 w-full max-w-md p-6 text-left">
              <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                <FileSpreadsheet className="h-4 w-4" /> {fileName ?? 'Sample dataset'}
              </p>
              <Stages current={stage} />
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 w-full">
              <Summary fileName={fileName} check={check} />
              <Button variant="primary" size="lg" className="mt-6 min-w-64 shadow-lift" onClick={() => navigate('/overview')} autoFocus>
                Open dashboard <ArrowRight />
              </Button>
              <div className="mt-3">
                <button type="button" onClick={() => setPhase('idle')} className="inline-flex items-center gap-1 text-xs text-subtle hover:text-fg focus-ring">
                  <RotateCcw className="h-3 w-3" /> Start over
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-10 text-2xs text-subtle">Phase 1 demo · decisions come from sample fixtures · no login needed</p>
      </main>
      <Toaster />
    </div>
  );
}

class UserError extends Error {
  constructor(public messages: string[]) {
    super(messages.join(' '));
  }
}

function SheetChip({ children, builtIn }: { children: ReactNode; builtIn?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium text-muted">
      <FileSpreadsheet className="h-3.5 w-3.5 text-st-approved" aria-hidden />
      {children}
      {builtIn && (
        <span className="inline-flex items-center gap-0.5 text-st-approved">
          <Check className="h-3 w-3" strokeWidth={3} /> built-in
        </span>
      )}
    </span>
  );
}

function Stages({ current }: { current: number }) {
  return (
    <ol className="space-y-3" aria-label="Processing">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className={cn('flex items-center gap-3 text-sm transition-colors', done ? 'text-fg' : active ? 'font-medium text-fg' : 'text-subtle')}>
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all',
                done ? 'border-st-approved bg-st-approved text-white' : active ? 'border-brand text-brand' : 'border-border',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function SheetSummary({ check, className }: { check: WorkbookCheck; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {check.sheets.map((s) => (
        <span
          key={s.name}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
            !s.found && !s.builtIn ? 'border-st-rejected/30 text-st-rejected' : s.missingColumns.length ? 'border-st-hold/40 text-st-hold' : 'text-muted',
          )}
        >
          {s.found && !s.missingColumns.length ? <CheckCircle2 className="h-3.5 w-3.5 text-st-approved" /> : <TriangleAlert className="h-3.5 w-3.5" />}
          {s.name}
          <span className="tnum">{s.found ? `${s.rows} row${s.rows === 1 ? '' : 's'}` : s.builtIn ? 'built-in' : 'missing'}</span>
        </span>
      ))}
    </div>
  );
}

function Summary({ fileName, check }: { fileName: string | null; check: WorkbookCheck | null }) {
  const apps = useApplicants();
  const ds = useDataset();
  const ts = useTerritoryStates();
  const [preview, setPreview] = useState<Preview>(null);
  const navigate = useNavigate();
  if (!apps.data || !ds.data || !ts.data) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-subtle" />
      </div>
    );
  }
  const over = new Set(ts.data.filter((t) => t.oversubscribed).map((t) => t.territoryId));
  const flagged = apps.data.filter((r) => r.decision.dataFlags.length > 0);
  const competing = apps.data.filter((r) => r.decision.territoryId && over.has(r.decision.territoryId) && r.decision.status !== 'Rejected' && r.decision.status !== 'Approved');
  const chips: Array<{ key: Exclude<Preview, null>; icon: ReactNode; value: number; label: string; tone?: string }> = [
    { key: 'apps', icon: <Users />, value: apps.data.length, label: 'applications' },
    { key: 'territories', icon: <Hexagon />, value: ds.data.territories.length, label: 'territories' },
    { key: 'flags', icon: <TriangleAlert />, value: flagged.length, label: 'with data issues', tone: 'text-st-needs' },
    { key: 'competing', icon: <Swords />, value: competing.length, label: 'competing for slots', tone: 'text-st-hold' },
  ];
  const rows = preview === 'apps' ? apps.data : preview === 'flags' ? flagged : preview === 'competing' ? competing : [];

  return (
    <div className="card p-5 text-left">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-st-approved" />
        <p className="font-semibold">Ready</p>
        <span className="ml-auto text-xs text-subtle">{fileName ?? 'Sample dataset'}</span>
      </div>
      {check && (
        <>
          <SheetSummary check={check} className="mt-3" />
          <p className="mt-2 text-2xs text-subtle">Phase 1: the file is checked, results use the sample dataset.</p>
        </>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setPreview((p) => (p === c.key ? null : c.key))}
            aria-pressed={preview === c.key}
            aria-label={`${c.value} ${c.label}: preview`}
            className={cn('rounded-md border px-3 py-2.5 text-left transition-all hover:bg-raised focus-ring', preview === c.key && 'border-brand/50 bg-brand-soft')}
          >
            <span className={cn('flex items-center gap-1.5 text-2xl font-semibold tnum [&_svg]:size-4', c.tone)}>
              {c.icon}
              {c.value}
            </span>
            <span className="text-2xs text-muted">{c.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 max-h-64 overflow-y-auto rounded-md border scrollbar-thin">
              {preview === 'territories' ? (
                <ul className="divide-y">
                  {ds.data.territories.map((t) => {
                    const s = ts.data!.find((x) => x.territoryId === t.id)!;
                    return (
                      <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="w-14 text-xs text-subtle tnum">{t.id}</span>
                        <span className="flex-1 truncate">{t.name}</span>
                        <PriorityChip priority={t.priority} size="sm" />
                        <span className="w-16 text-right text-xs text-muted tnum">
                          {s.applicants} apps
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="divide-y">
                  {rows.map((r) => (
                    <li key={r.app.id}>
                      <button type="button" onClick={() => navigate(`/applicants?app=${r.app.id}`)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-raised focus-ring">
                        <Avatar name={r.app.name} className="h-6 w-6 text-[9px]" />
                        <span className="min-w-0 flex-1 truncate">
                          {r.app.name} <span className="text-2xs text-subtle tnum">{r.app.id}</span>
                        </span>
                        {preview === 'flags' ? (
                          <span className="flex flex-wrap justify-end gap-1">
                            {r.decision.dataFlags.slice(0, 2).map((f) => (
                              <FlagChip key={f.label}>{f.label}</FlagChip>
                            ))}
                          </span>
                        ) : (
                          <>
                            <span className="hidden text-xs text-muted tnum sm:inline">{inrLakh(r.app.investmentLakh)}</span>
                            <StatusChip status={r.decision.status} size="sm" />
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link to={preview === 'territories' ? '/territories' : preview === 'flags' ? '/applicants?view=attention' : preview === 'competing' ? '/applicants?view=competing' : '/applicants'} className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
