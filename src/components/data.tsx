import { animate, motion } from 'framer-motion';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Image, Info, Minus, MoreHorizontal, RotateCcw, SearchX, Table2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useColors, useReducedMotion } from '@/lib/hooks';
import { useUi } from '@/store/ui';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip } from './ui/overlay';

/* ---------------- CountUp (runs once) ---------------- */
export function CountUp({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduced || !first.current) {
      setShown(value);
      return;
    }
    first.current = false;
    const c = animate(0, value, { duration: 0.6, ease: 'easeOut', onUpdate: setShown });
    return () => c.stop();
  }, [value, reduced]);
  return <span className="tnum">{format(shown)}</span>;
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({ data, token = 'brand', className, height = 28 }: { data: number[]; token?: string; className?: string; height?: number }) {
  const c = useColors();
  const id = useId().replace(/:/g, '');
  if (data.length < 2) return null;
  const w = 100;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('w-full overflow-visible', className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c(token, 0.22)} />
          <stop offset="1" stopColor={c(token, 0)} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={c(token)} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Delta ---------------- */
export function Delta({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold tnum',
        value === 0 ? 'bg-raised text-muted' : good ? 'bg-st-approved/10 text-st-approved' : 'bg-st-rejected/10 text-st-rejected',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

/* ---------------- KPI card ---------------- */
export function KpiCard({
  label, value, format, delta, deltaInvert, spark, token = 'brand', icon, active, dimmed, onClick, hint, suffix,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  delta?: number;
  deltaInvert?: boolean;
  spark?: number[];
  token?: string;
  icon?: ReactNode;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  hint?: string;
  suffix?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        'card group relative flex min-w-0 flex-col gap-2 overflow-hidden p-4 text-left transition-all duration-200 focus-ring hover:-translate-y-0.5 hover:shadow-lift',
        active && 'border-brand/60 ring-2 ring-brand/30',
        dimmed && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-xs font-medium text-muted [&_svg]:size-3.5">
          {icon}
          {label}
        </span>
        {delta !== undefined && <Delta value={delta} invert={deltaInvert} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold leading-none tracking-tight">
          <CountUp value={value} format={format} />
        </span>
        {suffix}
      </div>
      {spark && <Sparkline data={spark} token={token} className="-mb-1 mt-auto" />}
    </button>
  );
}

/* ---------------- Stat ---------------- */
export function Stat({ label, value, className, tone }: { label: string; value: ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('text-xl font-semibold leading-tight tracking-tight tnum', tone)}>{value}</div>
      <div className="truncate text-2xs font-medium text-subtle">{label}</div>
    </div>
  );
}

/* ---------------- Radial gauge ---------------- */
export function Gauge({ value, max, size = 56, token = 'brand', label, stroke = 6 }: { value: number; max: number; size?: number; token?: string; label?: ReactNode; stroke?: number }) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${value} of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c('raised')} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c(token)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - frac) }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold tnum">{label ?? `${value}/${max}`}</span>
    </div>
  );
}

/* ---------------- Chart card ---------------- */
export function ChartCard({
  title, info, children, table, actions, className, bodyClassName, onDrill, drillLabel = 'Drill in',
}: {
  title: string;
  info: string;
  children: ReactNode;
  /** Compact table version of the chart ("Show data") */
  table?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  onDrill?: () => void;
  drillLabel?: string;
}) {
  const [showData, setShowData] = useState(false);
  const toast = useUi((s) => s.toast);
  return (
    <section className={cn('card flex min-w-0 flex-col', className)} aria-label={title}>
      <header className="flex items-center gap-2 px-4 pb-1 pt-3.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Tooltip content={info}>
          <button type="button" className="text-subtle hover:text-muted focus-ring" aria-label={`About ${title}`}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <div className="ml-auto flex items-center gap-1">
          {actions}
          {table && (
            <Tooltip content={showData ? 'Show chart' : 'Show data'}>
              <Button variant="ghost" size="iconSm" aria-pressed={showData} aria-label="Toggle data table" onClick={() => setShowData((v) => !v)} className={cn(showData && 'bg-raised text-fg')}>
                <Table2 />
              </Button>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label={`${title} menu`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {onDrill && (
                <DropdownMenuItem onSelect={onDrill}>
                  <SearchX className="rotate-90" /> {drillLabel}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => toast('PNG export is stubbed in the demo')}>
                <Image /> Export PNG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast('CSV export is stubbed in the demo')}>
                <Download /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className={cn('relative min-h-0 flex-1 px-4 pb-4', bodyClassName)}>
        {showData && table ? <div className="max-h-72 overflow-auto scrollbar-thin">{table}</div> : children}
      </div>
    </section>
  );
}

/** Compact data table used by every chart's "Show data" toggle. */
export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-left text-subtle">
          {columns.map((c, i) => (
            <th key={c} className={cn('py-1.5 font-medium', i > 0 && 'text-right')}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/60 last:border-0">
            {r.map((cell, j) => (
              <td key={j} className={cn('py-1.5', j > 0 && 'text-right tnum')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- States ---------------- */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-raised', className)} style={style} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface/60 to-transparent" />
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full min-h-40 items-end gap-2 pt-6', className)} aria-label="Loading">
      {[40, 70, 55, 85, 45, 65].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title = 'No applicants match these filters', onReset, icon, className, action }: {
  title?: string;
  onReset?: () => void;
  icon?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8 text-center', className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-subtle">{icon ?? <SearchX className="h-5 w-5" />}</div>
      <p className="text-sm font-medium text-muted">{title}</p>
      {onReset && (
        <Button size="sm" variant="secondary" onClick={onReset}>
          <RotateCcw /> Reset filters
        </Button>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Could not load this view', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center" role="alert">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-st-rejected/10 text-st-rejected">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-muted">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCcw /> Retry
        </Button>
      )}
    </div>
  );
}

/** Crossfade wrapper: re-keys on `k` so filtered content fades rather than re-animating from zero. */
export function Crossfade({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <motion.div key={k} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className={className}>
      {children}
    </motion.div>
  );
}
