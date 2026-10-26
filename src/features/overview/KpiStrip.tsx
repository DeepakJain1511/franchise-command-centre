import { CheckCircle2, Clock, FileStack, Store, XCircle } from 'lucide-react';
import { KpiCard, Skeleton } from '@/components/data';
import { useDataset, useFilteredApplicants } from '@/engine/hooks';
import type { DecisionStatus } from '@/engine/types';
import { asOf, weeklyCumulative } from '@/lib/aggregate';
import type { ApplicantRow } from '@/lib/filtering';
import { useFilters, type ListKey } from '@/store/filters';

const IGNORE: ListKey[] = ['status', 'stage'];

export function KpiStrip() {
  const q = useFilteredApplicants(IGNORE);
  const ds = useDataset();
  const status = useFilters((s) => s.status);
  const stage = useFilters((s) => s.stage);
  const setList = useFilters((s) => s.setList);
  const only = useFilters((s) => s.only);

  if (!q.data || !ds.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
    );
  }

  const rows = q.data;
  const prev = asOf(rows);
  const is = (...s: DecisionStatus[]) => (r: ApplicantRow) => s.includes(r.decision.status);
  const count = (list: ApplicantRow[], f: (r: ApplicantRow) => boolean) => list.filter(f).length;
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const toggleSet = (s: DecisionStatus[]) => setList('status', sameSet(status, s) ? [] : s);
  const anyStatus = status.length > 0;

  const openNew = rows.filter((r) => r.decision.stage === 'Open').length;
  const openTotal = ds.data.stores.length + openNew;
  const planned = rows.filter((r) => r.decision.status === 'Approved' && r.decision.stage !== 'Open').length;

  const cards = [
    {
      key: 'all', label: 'Applications', icon: <FileStack />, token: 'brand', value: rows.length, delta: rows.length - prev.length,
      spark: weeklyCumulative(rows), active: false, onClick: () => setList('status', []),
      hint: 'All applications in view. Click to clear status filter.',
    },
    {
      key: 'approved', label: 'Approved', icon: <CheckCircle2 className="text-st-approved" />, token: 'st-approved',
      value: count(rows, is('Approved')), delta: count(rows, is('Approved')) - count(prev, is('Approved')),
      spark: weeklyCumulative(rows, 8, is('Approved')), active: sameSet(status, ['Approved']), onClick: () => toggleSet(['Approved']),
    },
    {
      key: 'hold', label: 'On hold', icon: <Clock className="text-st-hold" />, token: 'st-hold', deltaInvert: true,
      value: count(rows, is('On hold')), delta: count(rows, is('On hold')) - count(prev, is('On hold')),
      spark: weeklyCumulative(rows, 8, is('On hold')), active: sameSet(status, ['On hold']), onClick: () => toggleSet(['On hold']),
    },
    {
      key: 'rw', label: 'Rejected / Waitlist', icon: <XCircle className="text-st-rejected" />, token: 'st-rejected', deltaInvert: true,
      value: count(rows, is('Rejected', 'Waitlisted')), delta: count(rows, is('Rejected', 'Waitlisted')) - count(prev, is('Rejected', 'Waitlisted')),
      spark: weeklyCumulative(rows, 8, is('Rejected', 'Waitlisted')), active: sameSet(status, ['Rejected', 'Waitlisted']),
      onClick: () => toggleSet(['Rejected', 'Waitlisted']),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <KpiCard {...c} key={c.key} dimmed={anyStatus && !c.active} />
      ))}
      <KpiCard
        label="Stores planned · open"
        icon={<Store className="text-st-open" />}
        token="st-open"
        value={planned}
        suffix={<span className="text-sm font-medium text-muted tnum">· {openTotal} open</span>}
        spark={weeklyCumulative(rows, 8, is('Approved'))}
        active={stage.includes('Approved')}
        dimmed={anyStatus}
        hint={`${planned} planned in the programme · ${ds.data.stores.length} existing + ${openNew} newly opened`}
        onClick={() => only('stage', 'Approved')}
      />
    </div>
  );
}
