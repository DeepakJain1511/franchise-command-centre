import { Lock, Store as StoreIcon } from 'lucide-react';
import { PinChip, PriorityChip, TierChip } from '@/components/chips';
import { EmptyState } from '@/components/data';
import type { PinState } from '@/engine/types';
import { useAppDrawer } from '@/lib/hooks';
import { PIN_META } from '@/lib/tokens';
import { useFilters } from '@/store/filters';
import type { MapModel } from './model';

/** Map ⇄ table: Territory -> PIN rows, with the same filters as the map. */
export function CoverageTable({ model }: { model: MapModel }) {
  const f = useFilters();
  const { openApp } = useAppDrawer();
  const territories = model.territories.filter(
    (t) =>
      (!f.city.length || f.city.includes(t.city)) &&
      (!f.priority.length || f.priority.includes(t.priority)) &&
      (!f.territory.length || f.territory.includes(t.id)),
  );
  const outside = model.pins.filter((p) => !p.territoryId && (!f.city.length || f.city.includes(p.city)) && !f.priority.length && !f.territory.length);
  const groups: Array<{ key: string; head: React.ReactNode; pins: PinState[] }> = [
    ...territories.map((t) => {
      const s = model.tStates.get(t.id);
      return {
        key: t.id,
        head: (
          <span className="flex flex-wrap items-center gap-2">
            <b className="tnum">{t.id}</b> {t.name}
            <PriorityChip priority={t.priority} size="sm" />
            <TierChip tier={t.tier} size="sm" />
            <span className="ml-auto text-xs font-normal text-muted tnum">
              {s?.filled ?? 0}/{t.openSlots} filled · {s?.applicants ?? 0} applicants
            </span>
          </span>
        ),
        pins: t.pins.map((p) => model.byPin.get(p)).filter((p): p is PinState => !!p),
      };
    }),
    ...(outside.length ? [{ key: 'outside', head: <span className="text-muted">Outside any territory</span>, pins: outside }] : []),
  ];
  const filtered = groups
    .map((g) => ({ ...g, pins: g.pins.filter((p) => !f.pin.length || f.pin.includes(p.pin)) }))
    .filter((g) => g.pins.length);

  if (!filtered.length) return <EmptyState title="No PINs match these filters" onReset={f.reset} />;

  return (
    <div className="h-full overflow-auto p-4 scrollbar-thin md:p-6">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 z-10 bg-bg text-left text-xs text-subtle">
          <tr>
            <th className="py-2 font-medium">PIN</th>
            <th className="py-2 font-medium">Area</th>
            <th className="py-2 font-medium">State</th>
            <th className="py-2 font-medium">Store / plan</th>
            <th className="py-2 text-right font-medium">Applicants</th>
          </tr>
        </thead>
        {filtered.map((g) => (
          <tbody key={g.key}>
            <tr>
              <th colSpan={5} className="border-b bg-raised/50 px-2 py-2 text-left text-sm font-medium">
                {g.head}
              </th>
            </tr>
            {g.pins.map((p) => {
              const m = PIN_META[p.status];
              return (
                <tr key={p.pin} className="cursor-pointer border-b border-border/60 hover:bg-raised/40" onClick={() => f.only('pin', p.pin)}>
                  <td className="py-2 pl-2">
                    <PinChip pin={p.pin} status={p.status} size="sm" />
                  </td>
                  <td className="py-2 text-muted">{p.area}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <m.icon className="h-3.5 w-3.5 text-muted" /> {m.label}
                    </span>
                  </td>
                  <td className="py-2 text-xs">
                    {p.storeId ? (
                      <span className="inline-flex items-center gap-1">
                        <StoreIcon className="h-3.5 w-3.5" /> {p.storeId}
                      </span>
                    ) : p.allocatedTo ? (
                      <button type="button" className="inline-flex items-center gap-1 text-brand hover:underline" onClick={(e) => (e.stopPropagation(), openApp(p.allocatedTo!))}>
                        <Lock className="h-3.5 w-3.5" /> {p.allocatedTo}
                      </button>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tnum">{p.applicantIds.length || <span className="text-subtle">0</span>}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
