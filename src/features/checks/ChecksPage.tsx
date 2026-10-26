import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Play, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/app/AppShell';
import { useAiStatus } from '@/app/ShellExtras';
import { ListSkeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { engine } from '@/engine';
import { useEngineQuery, useRunChecks } from '@/engine/hooks';
import type { CheckReport } from '@/engine/types';
import { cn } from '@/lib/cn';
import { useAppDrawer } from '@/lib/hooks';

const ICON = { pass: CheckCircle2, fail: XCircle, warn: AlertTriangle } as const;
const TONE = { pass: 'text-st-approved', fail: 'text-st-rejected', warn: 'text-st-hold' } as const;

/**
 * The checks agent: audits every decision against the Build Spec after each change.
 * Rule checks are deterministic; the optional Gemini pass recomputes the rubric independently and only flags disagreements.
 */
export default function ChecksPage() {
  const auto = useEngineQuery('checks', () => engine.runChecks(false));
  const deep = useRunChecks();
  const ai = useAiStatus();
  const [report, setReport] = useState<CheckReport | null>(null);
  const shown = report ?? auto.data;
  const { openApp } = useAppDrawer();

  return (
    <div className="pb-10">
      <PageHeader
        title="Checks agent"
        question="Is every decision by the rules?"
        actions={
          <Button variant="primary" disabled={deep.loading} onClick={async () => setReport(await deep.run(true))}>
            {deep.loading ? <Sparkles className="animate-pulse" /> : <Play />}
            {deep.loading ? 'Checking with Gemini…' : ai?.enabled ? 'Run full audit (rules + Gemini)' : 'Run full audit'}
          </Button>
        }
      />
      <div className="space-y-4 px-4 md:px-6">
        {!shown ? (
          <div className="card p-5">
            <ListSkeleton />
          </div>
        ) : (
          <>
            <div className="card flex flex-wrap items-center gap-4 p-4">
              <ShieldCheck className={cn('h-8 w-8', shown.failed ? 'text-st-rejected' : 'text-st-approved')} aria-hidden />
              <div>
                <div className="text-lg font-semibold tnum">
                  {shown.passed}/{shown.items.length} checks passed
                </div>
                <div className="text-xs text-muted">
                  {shown.failed ? `${shown.failed} failed` : 'No rule violations'} · {shown.warned} to review · runs automatically after every change
                </div>
              </div>
              <div className="ml-auto text-2xs text-subtle">
                {ai?.enabled ? `Gemini cross-check available (${ai.model}) — it never changes a decision` : 'Gemini not configured — rule checks run in full'}
              </div>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {shown.items.map((it, i) => {
                const Icon = ICON[it.status];
                return (
                  <motion.li key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="card p-3.5">
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[it.status])} aria-label={it.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{it.title}</span>
                          <span className="text-2xs text-subtle">Spec {it.rule}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted">{it.detail}</p>
                        {it.offenders.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {it.offenders.slice(0, 12).map((o) => {
                              const id = o.split('@')[0];
                              return /^APP/.test(id) ? (
                                <button key={o} type="button" onClick={() => openApp(id)} className="rounded-full border px-2 py-0.5 text-2xs tnum hover:bg-raised focus-ring">
                                  {o}
                                </button>
                              ) : (
                                <span key={o} className="rounded-full border px-2 py-0.5 text-2xs tnum">
                                  {o}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
