import { Bell, CalendarClock, Database, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/controls';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/overlay';
import { TIME_SLIDER_MAX_DAYS } from '@/config';
import { engine } from '@/engine';
import { useAlerts, useEngineQuery } from '@/engine/hooks';
import type { Alert } from '@/engine/types';
import { setDemoDayAction } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { aiStatus, type AiStatus } from '@/lib/gemini';
import { useAppDrawer } from '@/lib/hooks';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { useData } from '@/store/data';

/** Spec §15.6 — "Simulate: Day 0 → Week 14". Moving it changes "today" for due tasks, reservations and health. */
export function TimeSlider() {
  useData((s) => s.version);
  const day = engine.getDay();
  const [draft, setDraft] = useState(day);
  useEffect(() => setDraft(day), [day]);
  const label = draft === 0 ? 'Day 0' : draft % 7 === 0 ? `Week ${draft / 7}` : `Day ${draft}`;
  return (
    <Popover>
      <Tooltip content="Simulate time: deadlines, overdue tasks and health move with it">
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className={cn('tnum', day > 0 && 'border-brand/40 bg-brand-soft text-brand')} aria-label={`Demo clock: ${label}`}>
            <CalendarClock /> <span className="hidden sm:inline">{day === 0 ? 'Day 0' : day % 7 === 0 ? `Wk ${day / 7}` : `Day ${day}`}</span>
            <span className="hidden text-2xs text-subtle lg:inline">· {fmtDate(iso(DEMO_TODAY))}</span>
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Simulate time</span>
          <span className="text-xs text-muted tnum">{label}</span>
        </div>
        <p className="mt-0.5 text-2xs text-subtle">Day 0 is the decision date. Only “today” moves — your data stays the same.</p>
        <div className="mt-4">
          <Slider
            min={0}
            max={TIME_SLIDER_MAX_DAYS}
            step={1}
            value={[draft]}
            onValueChange={([v]) => setDraft(v)}
            onValueCommit={([v]) => void setDemoDayAction(v)}
            thumbLabel="Days since the decision date"
          />
          <div className="mt-1.5 flex justify-between text-2xs text-subtle tnum">
            <span>Day 0</span>
            <span>Wk 4</span>
            <span>Wk 8</span>
            <span>Wk 14</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[0, 3, 7, 8, 31, 42, 84, 98].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => void setDemoDayAction(d)}
              className={cn('rounded-full border px-2 py-0.5 text-2xs tnum hover:bg-raised focus-ring', day === d && 'border-brand/50 bg-brand-soft text-brand')}
            >
              {d === 0 ? 'Day 0' : d % 7 === 0 ? `Wk ${d / 7}` : `Day ${d}`}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const SEV: Record<Alert['severity'], string> = { high: 'bg-st-rejected', medium: 'bg-st-hold', low: 'bg-subtle' };
const KIND: Record<Alert['kind'], string> = {
  RESERVATION_EXPIRING: 'Reservation expiring',
  TASK_OVERDUE: 'Overdue tasks',
  TASK_AWAITING: 'Awaiting your check',
  NOTES_REVIEW: 'Notes to review',
  DEMAND_SIGNAL: 'Demand signal',
  DUPLICATE_PIN: 'Duplicate PIN',
  PARSE: 'From the file',
};

/** Spec §15.2 alerts: expiring reservations, overdue / awaiting tasks, notes to review, demand signals, duplicate pins. */
export function AlertsBell() {
  const alerts = useAlerts();
  const { openApp } = useAppDrawer();
  const navigate = useNavigate();
  const list = [...(alerts.data ?? [])].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity));
  const urgent = list.filter((a) => a.severity !== 'low').length;
  return (
    <Popover>
      <Tooltip content="Alerts">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Alerts: ${list.length}`} className="relative">
            <Bell />
            {list.length > 0 && (
              <span className={cn('absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tnum', urgent ? 'bg-st-rejected' : 'bg-subtle')}>
                {list.length > 99 ? '99+' : list.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="border-b px-3 py-2 text-sm font-semibold">Alerts</div>
        {list.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">Nothing needs you right now.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
            {list.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => (a.applicationId ? openApp(a.applicationId, a.kind.startsWith('TASK') || a.kind === 'RESERVATION_EXPIRING' ? 'next' : 'decision') : a.kind === 'DEMAND_SIGNAL' ? navigate('/map') : undefined)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-raised focus-ring"
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEV[a.severity])} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-2xs font-medium uppercase tracking-wide text-subtle">{KIND[a.kind]}</span>
                    <span className="block text-sm">{a.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** The checks agent, always on: re-audits every decision after each change. */
export function ChecksBadge() {
  const navigate = useNavigate();
  const q = useEngineQuery('checks', () => engine.runChecks(false));
  if (!q.data) return null;
  const { passed, failed, items } = q.data;
  return (
    <Tooltip content={failed ? `${failed} rule check${failed === 1 ? '' : 's'} failed — open the checks agent` : 'Every decision passes the rule checks'}>
      <button
        type="button"
        onClick={() => navigate('/checks')}
        className={cn(
          'hidden h-7 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium tnum focus-ring sm:inline-flex',
          failed ? 'border-st-rejected/40 bg-st-rejected/10 text-st-rejected' : 'border-st-approved/30 bg-st-approved/10 text-st-approved',
        )}
      >
        {failed ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
        Checks {passed}/{items.length}
      </button>
    </Tooltip>
  );
}

export function useAiStatus() {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void aiStatus().then((x) => alive && setS(x));
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

export function SourcePill() {
  const source = useData((s) => s.source);
  const fileName = useData((s) => s.fileName);
  const ai = useAiStatus();
  return (
    <Tooltip
      content={
        <span>
          {source === 'upload' ? `Uploaded: ${fileName ?? 'file'}` : 'Built-in sample data'} · decisions by the rule engine (Build Spec)
          <br />
          {ai?.enabled ? `Gemini on (${ai.model}) — parsing follow-ups, reply drafts, rubric cross-check` : 'Gemini off — rule-based parsing only'}
        </span>
      }
    >
      <span className="hidden h-7 max-w-[180px] items-center gap-1.5 rounded-full border border-dashed border-brand/40 bg-brand-soft px-2.5 text-2xs font-medium text-brand lg:inline-flex">
        <Database className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{source === 'upload' ? fileName ?? 'Uploaded file' : 'Sample data'}</span>
        {ai?.enabled && <Sparkles className="h-3 w-3 shrink-0" aria-label="Gemini on" />}
      </span>
    </Tooltip>
  );
}
