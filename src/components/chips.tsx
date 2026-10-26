import { AlertCircle, Check, ChevronRight, Lock, Store as StoreIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Decision, DecisionStatus, Language, PinStatus, Priority, Reason, Stage, Tier } from '@/engine/types';
import { cn } from '@/lib/cn';
import { useAppDrawer } from '@/lib/hooks';
import { LANGUAGE_META, PIN_META, PRIORITY_META, STAGE_META, STATUS_META } from '@/lib/tokens';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from './ui/overlay';
import { Button } from './ui/button';

const chipBase = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium leading-none';
const sizes = { sm: 'h-5 px-1.5 text-2xs [&_svg]:size-3', md: 'h-6 px-2 text-xs [&_svg]:size-3.5', lg: 'h-8 px-3 text-sm [&_svg]:size-4' };

/* ---------------- Status ---------------- */

export function StatusChip({ status, size = 'md', className }: { status: DecisionStatus; size?: keyof typeof sizes; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={cn(chipBase, sizes[size], m.cls, className)}>
      <Icon aria-hidden />
      {status}
    </span>
  );
}

export function StageChip({ stage, size = 'md' }: { stage: Stage; size?: keyof typeof sizes }) {
  const m = STAGE_META[stage];
  const Icon = m.icon;
  return (
    <span className={cn(chipBase, sizes[size], m.cls)}>
      <Icon aria-hidden />
      {stage}
    </span>
  );
}

/**
 * Decision badge. When given a decision it is clickable and opens a short structured "why"
 * (3 reason chips + one sentence) with a link to the full drawer.
 */
export function DecisionBadge({ decision, status, size = 'md', className }: {
  decision?: Decision;
  status?: DecisionStatus;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { openApp } = useAppDrawer();
  const s = decision?.status ?? status!;
  if (!decision) return <StatusChip status={s} size={size} className={className} />;
  const m = STATUS_META[s];
  const Icon = m.icon;
  const top = [...decision.reasons].sort((a, b) => sentRank(a) - sentRank(b)).slice(0, 3);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`${s} — why?`}
          className={cn(chipBase, sizes[size], m.cls, 'cursor-pointer transition-shadow hover:shadow-soft focus-ring', className)}
        >
          <Icon aria-hidden />
          {s}
          <span className="ml-0.5 opacity-60">·</span>
          <span className="opacity-80">why</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <StatusChip status={s} />
          <span className="text-2xs text-subtle tnum">{decision.applicationId}</span>
        </div>
        <p className="mt-2.5 text-sm text-fg">{decision.summary}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {top.map((r) => (
            <ReasonChip key={r.id} reason={r} />
          ))}
        </div>
        <Button variant="link" size="sm" className="mt-3 text-xs" onClick={() => openApp(decision.applicationId, 'decision')}>
          Full reasoning <ChevronRight />
        </Button>
      </PopoverContent>
    </Popover>
  );
}

const sentRank = (r: Reason) => (r.sentiment === 'hurt' ? 0 : r.sentiment === 'missing' ? 1 : 2);

/* ---------------- Reasons ---------------- */

const SENT_META = {
  helped: { icon: Check, cls: 'border-st-approved/30 bg-st-approved/[0.07] text-fg', iconCls: 'bg-st-approved text-white', label: 'Helped' },
  hurt: { icon: X, cls: 'border-st-rejected/30 bg-st-rejected/[0.07] text-fg', iconCls: 'bg-st-rejected text-white', label: 'Hurt' },
  missing: { icon: AlertCircle, cls: 'border-st-hold/35 bg-st-hold/[0.08] text-fg', iconCls: 'bg-st-hold text-white', label: 'Missing / check' },
} as const;

export function ReasonChip({ reason, flipped, size = 'md' }: { reason: Reason; flipped?: boolean; size?: 'md' | 'lg' }) {
  const m = SENT_META[reason.sentiment];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border pr-2.5 font-medium',
        size === 'lg' ? 'h-8 pl-1 text-sm' : 'h-6 pl-0.5 text-xs',
        m.cls,
        flipped && 'ring-2 ring-brand/50 ring-offset-1 ring-offset-surface',
      )}
      title={m.label}
    >
      <span className={cn('flex items-center justify-center rounded-full', size === 'lg' ? 'h-6 w-6' : 'h-5 w-5', m.iconCls)}>
        <Icon className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={3} aria-label={m.label} />
      </span>
      {reason.label}
    </span>
  );
}

/* ---------------- Priority / Tier / Language ---------------- */

export function PriorityChip({ priority, size = 'md', onClick, active }: { priority: Priority; size?: keyof typeof sizes; onClick?: () => void; active?: boolean }) {
  const m = PRIORITY_META[priority];
  const content = (
    <>
      <span className="flex h-2.5 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cn('w-[3px] rounded-sm', b <= m.bars ? 'bg-current' : 'bg-current opacity-20')} style={{ height: `${3 + b * 2.5}px` }} />
        ))}
      </span>
      {priority}
    </>
  );
  const cls = cn(chipBase, sizes[size], m.cls, active && 'ring-2 ring-brand/50');
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'cursor-pointer focus-ring hover:shadow-soft')} aria-pressed={active}>
      {content}
    </button>
  ) : (
    <span className={cls}>{content}</span>
  );
}

export function TierChip({ tier, size = 'md' }: { tier: Tier; size?: keyof typeof sizes }) {
  return <span className={cn(chipBase, sizes[size], 'border-border bg-raised text-muted')}>{tier}</span>;
}

export function LanguageBadge({ language, native = true, size = 'md' }: { language: Language; native?: boolean; size?: keyof typeof sizes }) {
  const m = LANGUAGE_META[language];
  return (
    <span className={cn(chipBase, sizes[size], 'border-border bg-surface text-fg')} title={`Training in ${language}`}>
      <span className="rounded-sm bg-raised px-1 text-[9px] font-semibold tracking-wide text-muted">{m.code}</span>
      {native ? m.native : language}
    </span>
  );
}

/* ---------------- PIN ---------------- */

export function PinChip({ pin, status, onClick, size = 'md', count }: { pin: string; status: PinStatus; onClick?: () => void; size?: keyof typeof sizes; count?: number }) {
  const m = PIN_META[status];
  const locked = status === 'store' || status === 'allocated';
  const body = (
    <>
      {status === 'store' ? <StoreIcon aria-hidden /> : locked ? <Lock aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      <span className="tnum">{pin}</span>
      {count ? <span className="rounded-full bg-current/15 px-1 text-[9px] tnum">{count}</span> : null}
    </>
  );
  const cls = cn(chipBase, sizes[size], m.cls);
  const tip = `${m.label}${locked ? ' · one store per PIN' : ''}`;
  return (
    <Tooltip content={tip}>
      {onClick ? (
        <button type="button" onClick={onClick} className={cn(cls, 'cursor-pointer focus-ring hover:shadow-soft')} aria-label={`PIN ${pin}: ${tip}`}>
          {body}
        </button>
      ) : (
        <span className={cls} aria-label={`PIN ${pin}: ${tip}`}>
          {body}
        </span>
      )}
    </Tooltip>
  );
}

export function FlagChip({ children }: { children: ReactNode }) {
  return (
    <span className={cn(chipBase, sizes.sm, 'border-st-needs/30 bg-st-needs/10 text-st-needs')}>
      <AlertCircle aria-hidden />
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  // Neutral on purpose: colour is reserved for meaning (status, priority, PIN state).
  return (
    <span
      aria-hidden
      className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-raised text-xs font-semibold text-muted', className)}
    >
      {initials}
    </span>
  );
}
