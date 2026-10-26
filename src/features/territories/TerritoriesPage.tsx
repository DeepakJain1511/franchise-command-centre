import { Flame, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/app/AppShell';
import { PriorityChip, TierChip } from '@/components/chips';
import { EmptyState, ErrorState, Gauge, Skeleton } from '@/components/data';
import { Segmented } from '@/components/ui/controls';
import { useDataset, usePinStates, useTerritoryStates } from '@/engine/hooks';
import type { PinState, Priority } from '@/engine/types';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { PinStrip } from './PinStrip';

type Sort = 'priority' | 'city' | 'fill';
const PR: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

export default function TerritoriesPage() {
  const ds = useDataset();
  const ts = useTerritoryStates();
  const pins = usePinStates();
  const f = useFilters();
  const bump = useData((s) => s.bump);
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>('priority');

  const loading = !ds.data || !ts.data || !pins.data;
  const pinMap = new Map((pins.data ?? []).map((p) => [p.pin, p]));
  const list = (ds.data?.territories ?? [])
    .filter(
      (t) =>
        (!f.city.length || f.city.includes(t.city)) &&
        (!f.priority.length || f.priority.includes(t.priority)) &&
        (!f.territory.length || f.territory.includes(t.id)),
    )
    .map((t) => ({ t, s: ts.data?.find((x) => x.territoryId === t.id) }))
    .filter((x): x is { t: typeof x.t; s: NonNullable<typeof x.s> } => !!x.s)
    .sort((a, b) => {
      if (sort === 'city') return a.t.city.localeCompare(b.t.city) || a.t.id.localeCompare(b.t.id);
      if (sort === 'fill') return a.s.filled / a.s.openSlots - b.s.filled / b.s.openSlots || a.t.id.localeCompare(b.t.id);
      return PR[a.t.priority] - PR[b.t.priority] || a.t.id.localeCompare(b.t.id);
    });

  return (
    <div className="pb-10">
      <PageHeader
        title="Territories"
        question="How full is each territory?"
        actions={
          <Segmented<Sort>
            ariaLabel="Sort territories"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'city', label: 'City' },
              { value: 'fill', label: 'Fill' },
            ]}
          />
        }
      />
      <div className="px-4 md:px-6">
        {ds.error || ts.error ? (
          <ErrorState onRetry={bump} />
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState title="No territories match these filters" onReset={f.reset} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.map(({ t, s }) => {
              const tPins = t.pins.map((p) => pinMap.get(p)).filter((p): p is PinState => !!p);
              const full = s.filled >= s.openSlots;
              return (
                <li key={t.id}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/territories/${t.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/territories/${t.id}`)}
                    aria-label={`${t.id} ${t.name}: ${s.filled} of ${s.openSlots} slots filled`}
                    className="card flex h-full cursor-pointer flex-col gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-ring"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-2xs font-semibold text-subtle tnum">{t.id}</div>
                        <div className="truncate text-base font-semibold tracking-tight">{t.name}</div>
                        <div className="text-xs text-muted">{t.city}</div>
                      </div>
                      <Gauge value={s.filled} max={s.openSlots} size={56} token={full ? 'st-approved' : 'brand'} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <PriorityChip priority={t.priority} size="sm" active={f.priority.includes(t.priority)} onClick={() => f.toggle('priority', t.priority)} />
                      </span>
                      <TierChip tier={t.tier} size="sm" />
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted tnum">
                        <Users className="h-3.5 w-3.5" aria-hidden /> {s.applicants}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center gap-2 border-t pt-3">
                      <PinStrip pins={tPins} />
                      {s.oversubscribed && full && (
                        <span className="ml-auto flex shrink-0 items-center gap-1 text-2xs font-medium text-st-rejected">
                          <Flame className="h-3 w-3" aria-hidden /> In demand
                        </span>
                      )}
                      {s.applicants === 0 && <span className="ml-auto shrink-0 text-2xs font-medium text-subtle">No applicants</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
