import { motion } from 'framer-motion';
import { Flame, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PriorityChip } from '@/components/chips';
import { ChartCard, ChartSkeleton, DataTable, EmptyState } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlay';
import { useDataset, useTerritoryStates } from '@/engine/hooks';
import { cn } from '@/lib/cn';
import { useFilters } from '@/store/filters';

const BAR: Record<string, string> = { High: 'bg-pr-high', Medium: 'bg-pr-medium', Low: 'bg-pr-low' };

export function TerritoryFill() {
  const ds = useDataset();
  const ts = useTerritoryStates();
  const f = useFilters();
  const navigate = useNavigate();

  const list = (ds.data?.territories ?? [])
    .filter((t) => (!f.city.length || f.city.includes(t.city)) && (!f.priority.length || f.priority.includes(t.priority)))
    .map((t) => ({ t, s: ts.data?.find((x) => x.territoryId === t.id) }))
    .filter((x): x is { t: typeof x.t; s: NonNullable<typeof x.s> } => !!x.s);
  const maxSlots = Math.max(1, ...list.map((x) => Math.max(x.s.openSlots, x.s.filled)));
  const sel = f.territory.length === 1 ? f.territory[0] : null;

  return (
    <ChartCard
      title="Territory fill"
      info="Slots filled vs open per territory, coloured by priority. Click to filter, double-click for detail."
      className="lg:col-span-7"
      onDrill={() => navigate(sel ? `/territories/${sel}` : '/territories')}
      drillLabel="Open territory detail"
      actions={
        sel && (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/map?territory=${sel}`)}>
            <Map /> Open on map
          </Button>
        )
      }
      table={
        <DataTable
          columns={['Territory', 'Priority', 'Filled', 'Slots', 'Applicants']}
          rows={list.map(({ t, s }) => [`${t.id} ${t.name}`, t.priority, s.filled, s.openSlots, s.applicants])}
        />
      }
    >
      {!ds.data || !ts.data ? (
        <ChartSkeleton className="h-56" />
      ) : list.length === 0 ? (
        <EmptyState title="No territories match these filters" onReset={f.reset} />
      ) : (
        <>
          <ul className="space-y-1" aria-label="Territories">
            {list.map(({ t, s }, i) => {
              const dim = sel && sel !== t.id;
              return (
                <li key={t.id}>
                  <Tooltip
                    content={
                      <span className="tnum">
                        <b>{t.id}</b> {t.name} · {s.filled}/{s.openSlots} filled · {s.applicants} applicants{s.oversubscribed ? ' · oversubscribed' : ''}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => f.only('territory', t.id)}
                      onDoubleClick={() => navigate(`/territories/${t.id}`)}
                      aria-pressed={sel === t.id}
                      aria-label={`${t.id} ${t.name}: ${s.filled} of ${s.openSlots} slots filled`}
                      className={cn(
                        'grid w-full grid-cols-[minmax(0,150px)_1fr_64px] items-center gap-3 rounded-md px-1.5 py-1 text-left transition-opacity hover:bg-raised/60 focus-ring sm:grid-cols-[minmax(0,190px)_1fr_76px]',
                        dim && 'opacity-35',
                        sel === t.id && 'bg-raised',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 whitespace-nowrap text-2xs font-semibold text-subtle tnum">{t.id}</span>
                        <span className="truncate text-xs font-medium">{t.name}</span>
                      </span>
                      <span className="flex h-5 items-center gap-[3px]" aria-hidden>
                        {Array.from({ length: s.openSlots }).map((_, k) => (
                          <motion.span
                            key={k}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3, delay: i * 0.03 + k * 0.04 }}
                            style={{ width: `${100 / maxSlots}%`, originX: 0 }}
                            className={cn('h-full rounded-[5px]', k < s.filled ? BAR[t.priority] : 'border border-dashed border-border bg-raised')}
                          />
                        ))}
                      </span>
                      <span className="flex items-center justify-end gap-1.5 text-xs tnum">
                        {s.oversubscribed && s.filled >= s.openSlots && <Flame className="h-3.5 w-3.5 text-st-rejected" aria-label="oversubscribed" />}
                        <b>{s.filled}</b>
                        <span className="text-subtle">/ {s.openSlots}</span>
                      </span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-2xs text-subtle">
            {(['High', 'Medium', 'Low'] as const).map((p) => (
              <PriorityChip key={p} priority={p} size="sm" active={f.priority.includes(p)} onClick={() => f.toggle('priority', p)} />
            ))}
            <span className="ml-auto flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-border bg-raised" /> open slot
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-st-rejected" /> full, still in demand
            </span>
          </div>
        </>
      )}
    </ChartCard>
  );
}

