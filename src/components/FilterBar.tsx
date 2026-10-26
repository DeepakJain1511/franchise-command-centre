import { ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CITIES, DECISION_STATUSES, type Language, type Priority } from '@/engine/types';
import { useDataset } from '@/engine/hooks';
import { cn } from '@/lib/cn';
import {
  activeFilterCount, filtersToParams, LIST_KEYS, paramsToFilters, useFilters, type Filters, type ListKey, type TimeWindow,
} from '@/store/filters';
import { Button } from './ui/button';
import { Segmented } from './ui/controls';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from './ui/overlay';

const LABEL: Record<ListKey, string> = {
  city: 'City', territory: 'Territory', status: 'Status', stage: 'Reached', priority: 'Priority', language: 'Language', pin: 'PIN',
};

/** Keeps the global filters and the URL query string in sync (shareable views). */
export function FilterUrlSync() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const filters = useFilters();
  const replaceAll = useFilters((s) => s.replaceAll);
  const lastWritten = useRef<string | null>(null);
  const lastPath = useRef<string | null>(null);

  // URL -> store (on load, deep links, back/forward). Moving to another screen via a plain
  // link (no filter params) keeps the current filters instead of clearing them.
  useEffect(() => {
    const fromUrl = paramsToFilters(params);
    const key = JSON.stringify(fromUrl);
    const navigatedWithoutFilters = lastPath.current !== null && lastPath.current !== pathname && activeFilterCount(fromUrl) === 0;
    lastPath.current = pathname;
    if (navigatedWithoutFilters) {
      lastWritten.current = null; // force store -> URL below
      return;
    }
    if (key !== lastWritten.current) {
      lastWritten.current = key;
      replaceAll(fromUrl);
    }
  }, [params, pathname, replaceAll]);

  // store -> URL
  const current: Filters = {
    city: filters.city, territory: filters.territory, status: filters.status, stage: filters.stage,
    priority: filters.priority, language: filters.language, pin: filters.pin, window: filters.window,
  };
  const key = JSON.stringify(current);
  useEffect(() => {
    if (key === lastWritten.current) return;
    lastWritten.current = key;
    setParams((p) => filtersToParams(JSON.parse(key) as Filters, p), { replace: true });
  }, [key, setParams, pathname]);

  return null;
}

function MultiSelect<K extends ListKey>({ k, options }: { k: K; options: Array<{ value: Filters[K][number]; label: string }> }) {
  const selected = useFilters((s) => s[k]) as string[];
  const toggle = useFilters((s) => s.toggle);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={selected.length ? 'subtle' : 'ghost'} className={cn('shrink-0', selected.length && 'text-fg')}>
          {LABEL[k]}
          {selected.length > 0 && <span className="rounded-full bg-brand px-1.5 text-2xs text-brand-fg tnum">{selected.length}</span>}
          <ChevronDown className="!size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(k, o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterBar() {
  const filters = useFilters();
  const ds = useDataset();
  const count = activeFilterCount(filters);
  const territoryOpts = (ds.data?.territories ?? []).map((t) => ({ value: t.id, label: `${t.id} · ${t.name}` }));

  return (
    <div className="sticky top-14 z-30 border-b bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-thin md:px-6">
        <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-subtle" aria-hidden />
        <MultiSelect k="city" options={CITIES.map((c) => ({ value: c, label: c }))} />
        <MultiSelect k="territory" options={territoryOpts} />
        <MultiSelect k="status" options={DECISION_STATUSES.map((s) => ({ value: s, label: s }))} />
        <MultiSelect k="priority" options={(['High', 'Medium', 'Low'] as Priority[]).map((p) => ({ value: p, label: p }))} />
        <MultiSelect k="language" options={(['Kannada', 'English', 'Hindi'] as Language[]).map((l) => ({ value: l, label: l }))} />
        <div className="mx-1 h-5 w-px shrink-0 bg-border" />
        <Segmented<TimeWindow>
          ariaLabel="Time window"
          value={filters.window}
          onChange={filters.setWindow}
          className="shrink-0"
          options={[
            { value: '7d', label: '7d', title: 'Last 7 days' },
            { value: '30d', label: '30d', title: 'Last 30 days' },
            { value: '90d', label: '90d', title: 'Last 90 days' },
            { value: 'all', label: 'All', title: 'All time' },
          ]}
        />

        {count > 0 && (
          <>
            <div className="mx-1 h-5 w-px shrink-0 bg-border" />
            <div className="flex shrink-0 items-center gap-1">
              {LIST_KEYS.flatMap((k) =>
                (filters[k] as string[]).map((v) => (
                  <FilterChip key={`${k}:${v}`} label={LABEL[k]} value={v} onRemove={() => filters.toggle(k, v as Filters[typeof k][number])} />
                )),
              )}
            </div>
            <Button size="sm" variant="ghost" className="ml-auto shrink-0" onClick={filters.reset}>
              <RotateCcw /> Reset
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-brand/30 bg-brand-soft pl-2.5 pr-1 text-xs text-fg">
      <span className="text-muted">{label}:</span>
      <span className="font-medium">{value}</span>
      <button type="button" onClick={onRemove} className="ml-0.5 rounded-full p-0.5 text-muted hover:bg-brand/15 hover:text-fg focus-ring" aria-label={`Remove ${label} ${value}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

