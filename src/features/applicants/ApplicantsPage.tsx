import {
  createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, BellRing, Clock, Columns3, Search, Swords, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/AppShell';
import { Avatar, DecisionBadge, LanguageBadge } from '@/components/chips';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlay';
import { useFilteredApplicants, useTerritoryStates } from '@/engine/hooks';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { inrLakh, num } from '@/lib/format';
import { useAppDrawer, useMediaQuery } from '@/lib/hooks';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';

type View = 'all' | 'attention' | 'hold' | 'competing';

const VIEWS: Array<{ key: View; label: string; icon: typeof Users }> = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'attention', label: 'Needs attention', icon: BellRing },
  { key: 'hold', label: 'On hold', icon: Clock },
  { key: 'competing', label: 'Competing for a territory', icon: Swords },
];

const col = createColumnHelper<ApplicantRow>();
const SPACE_FIELDS = new Set(['space', 'spaceSqft', 'floor']);
const today = iso(DEMO_TODAY);

function nextStep(r: ApplicantRow) {
  return r.decision.nextSteps.find((s) => !s.done) ?? null;
}

const columns = [
  col.accessor((r) => r.app.id, {
    id: 'id',
    header: 'ID',
    cell: (c) => <span className="whitespace-nowrap text-xs text-muted tnum">{c.getValue()}</span>,
  }),
  col.accessor((r) => r.app.name, {
    id: 'name',
    header: 'Applicant',
    cell: (c) => (
      <span className="flex items-center gap-2">
        <Avatar name={c.getValue()} className="h-7 w-7 text-[10px]" />
        <span className="truncate font-medium">{c.getValue()}</span>
        {c.row.original.decision.dataFlags.length > 0 && (
          <Tooltip content={c.row.original.decision.dataFlags.map((f) => f.label).join(' · ')}>
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-st-needs" aria-label="Data-quality flags" />
          </Tooltip>
        )}
      </span>
    ),
  }),
  col.accessor((r) => `${r.app.city} ${r.app.pin}`, {
    id: 'where',
    header: 'City · PIN',
    cell: (c) => (
      <span className="whitespace-nowrap">
        {c.row.original.app.city.replace('Hubballi-Dharwad', 'Hubballi')} <span className="text-subtle tnum">{c.row.original.app.pin}</span>
      </span>
    ),
  }),
  col.accessor((r) => r.app.investmentLakh, {
    id: 'capacity',
    header: 'Capacity',
    meta: { align: 'right' },
    cell: (c) => <span className="tnum">{inrLakh(c.getValue())}</span>,
  }),
  col.accessor((r) => r.app.experienceYears, {
    id: 'experience',
    header: 'Exp.',
    meta: { align: 'right' },
    cell: (c) => <span className="tnum">{c.getValue()} y</span>,
  }),
  col.accessor((r) => r.app.space, {
    id: 'space',
    header: 'Space',
    cell: (c) => {
      const a = c.row.original.app;
      const flagged = c.row.original.decision.dataFlags.some((f) => SPACE_FIELDS.has(f.field));
      return (
        <span className={cn('whitespace-nowrap text-xs', flagged && 'text-st-needs')}>
          {a.space === 'Not yet identified' ? 'No space' : a.space}
          {a.spaceSqft != null && <span className="text-subtle tnum"> · {num(a.spaceSqft)} ft²</span>}
          {a.floor !== 'Not known' && <span className="text-subtle"> · {a.floor}</span>}
        </span>
      );
    },
  }),
  col.accessor((r) => r.app.launchMonths, {
    id: 'launch',
    header: 'Launch',
    meta: { align: 'right' },
    cell: (c) => <span className="tnum">{c.getValue()} mo</span>,
  }),
  col.accessor((r) => r.app.language, {
    id: 'language',
    header: 'Language',
    cell: (c) => <LanguageBadge language={c.getValue()} size="sm" native={false} />,
  }),
  col.accessor((r) => r.decision.status, {
    id: 'decision',
    header: 'Decision',
    cell: (c) => <DecisionBadge decision={c.row.original.decision} size="sm" />,
  }),
  col.accessor((r) => nextStep(r)?.dueDate ?? '9999', {
    id: 'next',
    header: 'Next step',
    cell: (c) => {
      const s = nextStep(c.row.original);
      if (!s) return <span className="text-subtle">—</span>;
      return (
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate">{s.label}</span>
          <span className={cn('shrink-0 tnum', s.dueDate < today ? 'font-semibold text-st-rejected' : 'text-subtle')}>{fmtDate(s.dueDate)}</span>
        </span>
      );
    },
  }),
];

const COL_LABEL: Record<string, string> = {
  id: 'ID', name: 'Applicant', where: 'City · PIN', capacity: 'Capacity', experience: 'Experience', space: 'Space',
  launch: 'Launch', language: 'Language', decision: 'Decision', next: 'Next step',
};

export default function ApplicantsPage() {
  const q = useFilteredApplicants();
  const ts = useTerritoryStates();
  const reset = useFilters((s) => s.reset);
  const bump = useData((s) => s.bump);
  const { openApp } = useAppDrawer();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View | null) ?? 'all';
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({ experience: false, language: false });
  const wide = useMediaQuery('(min-width: 900px)');

  const setView = (v: View) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v === 'all') n.delete('view');
      else n.set('view', v);
      return n;
    });

  const oversubscribed = useMemo(() => new Set((ts.data ?? []).filter((t) => t.oversubscribed).map((t) => t.territoryId)), [ts.data]);

  const inView = (r: ApplicantRow, v: View) => {
    switch (v) {
      case 'attention':
        return !!r.decision.attention;
      case 'hold':
        return r.decision.status === 'On hold';
      case 'competing':
        return !!r.decision.territoryId && oversubscribed.has(r.decision.territoryId) && r.decision.status !== 'Rejected' && r.decision.status !== 'Approved';
      default:
        return true;
    }
  };

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = (q.data ?? []).filter((r) => inView(r, view));
    if (s) list = list.filter((r) => `${r.app.id} ${r.app.name} ${r.app.pin} ${r.app.city}`.toLowerCase().includes(s));
    if (view === 'attention' && !sorting.length) list = [...list].sort((a, b) => (a.decision.attentionPriority ?? 99) - (b.decision.attentionPriority ?? 99));
    return list;
    // inView depends on oversubscribed only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, view, search, oversubscribed, sorting.length]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (r) => r.app.id,
  });

  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, (q.data ?? []).filter((r) => inView(r, v.key)).length])) as Record<View, number>;

  return (
    <div className="pb-10">
      <PageHeader
        title="Applicants"
        question="Who are they, and what happened to them?"
        actions={
          <span className="text-sm text-muted tnum">
            {rows.length} of {q.all?.length ?? 0}
          </span>
        }
      />
      <div className="space-y-3 px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Saved views">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-ring',
                  view === v.key ? 'border-brand/50 bg-brand-soft text-fg' : 'bg-surface text-muted hover:bg-raised hover:text-fg',
                )}
              >
                <v.icon className="h-3.5 w-3.5" aria-hidden />
                {v.label}
                <span className="rounded-full bg-raised px-1.5 text-2xs tnum">{counts[v.key]}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search applicants</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID or PIN"
                className="h-8 w-48 rounded-md border bg-surface pl-8 pr-2 text-sm shadow-soft placeholder:text-subtle focus-ring"
              />
            </label>
            {wide && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Columns3 /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {table.getAllLeafColumns().map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                      {COL_LABEL[c.id]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {q.error ? (
          <ErrorState onRetry={bump} />
        ) : !q.data ? (
          <div className="card p-4">
            <ListSkeleton rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState
              onReset={() => {
                reset();
                setSearch('');
                setView('all');
              }}
            />
          </div>
        ) : wide ? (
          <div className="card overflow-hidden">
            <div className="max-h-[calc(100vh-260px)] overflow-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_hsl(var(--border))]">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const right = (h.column.columnDef.meta as { align?: string } | undefined)?.align === 'right';
                        const dir = h.column.getIsSorted();
                        return (
                          <th key={h.id} className={cn('whitespace-nowrap px-3 py-2.5 text-xs font-medium text-subtle', right ? 'text-right' : 'text-left')} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
                            <button type="button" onClick={h.column.getToggleSortingHandler()} className={cn('inline-flex items-center gap-1 hover:text-fg focus-ring', right && 'flex-row-reverse')}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openApp(row.id)}
                      onKeyDown={(e) => e.key === 'Enter' && openApp(row.id)}
                      className="cursor-pointer border-t border-border/70 transition-colors hover:bg-raised/50 focus-visible:bg-raised/60 focus-visible:outline-none"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const right = (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right';
                        return (
                          <td key={cell.id} className={cn('max-w-[260px] px-3 py-2', right && 'text-right')}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const s = nextStep(r);
              return (
                <li key={r.app.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openApp(r.app.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openApp(r.app.id)}
                    className="card flex items-center gap-3 p-3 focus-ring"
                  >
                    <Avatar name={r.app.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{r.app.name}</span>
                        <span className="shrink-0 whitespace-nowrap text-2xs text-subtle tnum">{r.app.id}</span>
                      </div>
                      <div className="text-xs text-muted tnum">
                        {r.app.city} · {r.app.pin} · {inrLakh(r.app.investmentLakh)}
                      </div>
                      {s && <div className="mt-0.5 truncate text-2xs text-subtle">Next: {s.label}</div>}
                    </div>
                    <DecisionBadge decision={r.decision} size="sm" />
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
