import { motion } from 'framer-motion';
import { Check, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { CountUp } from '@/components/data';
import { KARNATAKA_OUTLINE } from '@/data/geo/karnataka';
import { useApplicants, useDataset } from '@/engine/hooks';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';

export const STAGES = ['Reading sheets', 'Checking data', 'Matching PINs to territories', 'Deciding', 'Preparing onboarding'];

// Simple equirectangular projection of the state outline into a 200 x 220 box.
const ring = KARNATAKA_OUTLINE[0];
const lats = ring.map((p) => p[0]);
const lngs = ring.map((p) => p[1]);
const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
const W = 200;
const H = ((maxLat - minLat) / ((maxLng - minLng) * kx)) * W;
const project = (lat: number, lng: number) => [((lng - minLng) / (maxLng - minLng)) * W, ((maxLat - lat) / (maxLat - minLat)) * H] as const;
const OUTLINE_PATH = ring.map(([lat, lng], i) => `${i ? 'L' : 'M'}${project(lat, lng).map((v) => v.toFixed(1)).join(',')}`).join(' ') + 'Z';

/** Live processing: stage list + progress, ticking counters and a mini Karnataka map lighting up. */
export function ProcessingView({ stage, fileName, fileSize }: { stage: number; fileName: string | null; fileSize: number | null }) {
  const ds = useDataset();
  const apps = useApplicants();
  const pct = Math.min(1, stage / STAGES.length);

  const perCity = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of ds.data?.applications ?? []) m.set(a.city, (m.get(a.city) ?? 0) + 1);
    return m;
  }, [ds.data]);
  const pins = new Set((ds.data?.applications ?? []).map((a) => a.pin)).size;
  const approved = (apps.data ?? []).filter((r) => r.decision.status === 'Approved').length;

  const counters = [
    { label: 'Applications read', value: ds.data?.applications.length ?? 0, from: 0 },
    { label: 'Territories', value: ds.data?.territories.length ?? 0, from: 1 },
    { label: 'PINs matched', value: pins, from: 2 },
    { label: 'Decisions', value: apps.data?.length ?? 0, from: 3 },
    { label: 'Onboarding plans', value: approved, from: 4 },
  ];

  return (
    <div className="grid w-full gap-5 text-left md:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-3 rounded-md border bg-surface/70 px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-st-approved/10 text-st-approved">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{fileName ?? 'Sample dataset'}</div>
            <div className="text-2xs text-subtle tnum">{fileSize ? `${num(Math.round(fileSize / 1024))} KB · Excel workbook` : '40 applications · 8 territories · 10 stores'}</div>
          </div>
          <span className="text-sm font-semibold tnum text-brand">{Math.round(pct * 100)}%</span>
        </div>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <ol className="space-y-3" aria-label="Processing">
          {STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={s} className={cn('flex items-center gap-3 text-sm transition-colors', done ? 'text-fg' : active ? 'font-medium text-fg' : 'text-subtle')}>
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
                    done ? 'border-st-approved bg-st-approved text-white' : active ? 'border-brand text-brand' : 'border-border',
                  )}
                >
                  {done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </motion.span>
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </span>
                <span className="flex-1">{s}</span>
                {(() => {
                  const c = counters[i];
                  return stage >= c.from ? (
                    <span className="text-xs text-muted tnum">
                      <CountUp value={done || active ? c.value : 0} /> {c.label.toLowerCase()}
                    </span>
                  ) : null;
                })()}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="hidden flex-col items-center md:flex" aria-hidden>
        <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className="w-full">
          <path d={OUTLINE_PATH} className="fill-brand/[0.06] stroke-brand/50" strokeWidth={1} />
          {(ds.data?.cities ?? []).map((c, i) => {
            const [x, y] = project(c.lat, c.lng);
            const lit = stage >= 2;
            const n = perCity.get(c.city) ?? 0;
            const r = 3 + Math.sqrt(n) * 1.6;
            return (
              <g key={c.city}>
                {lit && (
                  <motion.circle
                    cx={x}
                    cy={y}
                    r={r}
                    className="fill-brand/30"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.18 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                )}
                <motion.circle
                  cx={x}
                  cy={y}
                  initial={{ r: 2 }}
                  animate={{ r: lit ? r : 2 }}
                  transition={{ duration: 0.5, delay: lit ? i * 0.12 : 0 }}
                  className={cn('transition-colors duration-500', lit ? 'fill-brand' : 'fill-subtle/50')}
                />
                {lit && (
                  <motion.text
                    x={x > W * 0.7 ? x - r - 3 : x + r + 3}
                    textAnchor={x > W * 0.7 ? 'end' : 'start'}
                    y={y + 3}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.12 }}
                    className="fill-fg text-[8px] font-medium"
                  >
                    {c.city.replace('Hubballi-Dharwad', 'Hubballi')} · {n}
                  </motion.text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-2xs text-subtle">{stage >= 2 ? 'Applicants by city' : 'Karnataka'}</p>
      </div>
    </div>
  );
}
