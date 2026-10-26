import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Download, FileSpreadsheet, Hexagon, Loader2, Moon, RotateCcw, Sparkles, Sun, Swords, TriangleAlert, Upload, Users,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, FlagChip, PriorityChip, StatusChip } from '@/components/chips';
import { CountUp, Reveal } from '@/components/data';
import { Toaster } from '@/components/Toaster';
import { Tooltip } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { useApplicants, useDataset, useTerritoryStates } from '@/engine/hooks';
import { loadDataset } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { inrLakh } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { checkWorkbook, EXPECTED, fileTypeError, type SheetName, type WorkbookCheck } from './checkWorkbook';
import { ProcessingView, STAGES } from './ProcessingView';
import { StartBackdrop } from './StartBackdrop';

type Phase = 'idle' | 'processing' | 'done' | 'error';
type Preview = 'apps' | 'territories' | 'flags' | 'competing' | null;

export default function StartPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
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
    setFileSize(source === 'sample' ? null : source.size);
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
        await tick(520);
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
      <StartBackdrop />

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
        <Reveal>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:-mx-24 md:text-[44px] md:leading-[1.08]">
            From applications to <span className="text-brand">open stores.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-3 text-base text-muted">Upload the Excel. See who to approve, where, and why.</p>
        </Reveal>

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
                  'card group flex cursor-pointer flex-col items-center gap-4 border-2 border-dashed bg-surface/80 px-6 py-10 backdrop-blur-md transition-all duration-300 focus-ring',
                  drag ? 'scale-[1.02] border-brand bg-brand-soft/90 shadow-pop' : 'hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift',
                )}
              >
                <motion.span
                  animate={drag ? { scale: 1.15, y: -4 } : { scale: 1, y: [0, -4, 0] }}
                  transition={drag ? { type: 'spring', stiffness: 300, damping: 15 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"
                >
                  <Upload className="h-6 w-6" />
                </motion.span>
                <div>
                  <p className="text-lg font-semibold">{drag ? 'Release to upload' : 'Drop your Excel here'}</p>
                  <p className="text-sm text-muted">or click to browse · .xlsx</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2" aria-label="Expected sheets">
                  <SheetChip name="Applications" />
                  <SheetChip name="Territories" />
                  <SheetChip name="Existing stores" builtIn />
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
                <Button variant="primary" size="lg" onClick={() => run('sample')} className="group relative min-w-64 overflow-hidden shadow-lift">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
                  <Sparkles /> Try with sample data
                </Button>
                <a href="/Case1_Franchise_Test_Data_Format.xlsx" download className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg focus-ring">
                  <Download className="h-4 w-4" /> Download template
                </a>
              </div>
            </motion.div>
          )}

          {phase === 'processing' && (
            <motion.div key="proc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mt-8 w-full bg-surface/90 p-6 backdrop-blur-md">
              <ProcessingView stage={stage} fileName={fileName} fileSize={fileSize} />
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

/** Sheet chip: hover (or focus) to see the columns this sheet should have. */
function SheetChip({ name, builtIn }: { name: SheetName; builtIn?: boolean }) {
  const cols = EXPECTED[name];
  return (
    <Tooltip
      content={
        <div className="py-0.5">
          <div className="mb-1 font-semibold">{name} · {cols.length} columns</div>
          <ul className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-muted sm:grid-cols-2">
            {cols.map((c) => (
              <li key={c} className="truncate">· {c}</li>
            ))}
          </ul>
          {builtIn && <div className="mt-1.5 text-st-approved">Already built in — no need to upload</div>}
        </div>
      }
      className="max-w-md"
    >
      <span
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex cursor-help items-center gap-1.5 rounded-full border bg-surface/90 px-2.5 py-1 text-xs font-medium text-muted transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-fg hover:shadow-soft focus-ring"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-st-approved" aria-hidden />
        {name}
        {builtIn && (
          <span className="inline-flex items-center gap-0.5 text-st-approved">
            <Check className="h-3 w-3" strokeWidth={3} /> built-in
          </span>
        )}
      </span>
    </Tooltip>
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
    <div className="card bg-surface/90 p-5 text-left backdrop-blur-md">
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
        {chips.map((c, i) => (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.35 }}
            whileHover={{ y: -2 }}
            key={c.key}
            type="button"
            onClick={() => setPreview((p) => (p === c.key ? null : c.key))}
            aria-pressed={preview === c.key}
            aria-label={`${c.value} ${c.label}: preview`}
            className={cn('rounded-md border px-3 py-2.5 text-left transition-all hover:bg-raised focus-ring', preview === c.key && 'border-brand/50 bg-brand-soft')}
          >
            <span className={cn('flex items-center gap-1.5 text-2xl font-semibold tnum [&_svg]:size-4', c.tone)}>
              {c.icon}
              <CountUp value={c.value} />
            </span>
            <span className="text-2xs text-muted">{c.label}</span>
          </motion.button>
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
