import { format, parseISO } from 'date-fns';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/app/AppShell';
import { DecisionBadge, PinChip, PriorityChip, TierChip } from '@/components/chips';
import { ChartCard, ChartSkeleton, DataTable, EmptyState, ErrorState, Gauge, Skeleton, Stat } from '@/components/data';
import { Button } from '@/components/ui/button';
import { useApplicants, useDataset, usePinStates, useTerritoryStates } from '@/engine/hooks';
import { inrLakh } from '@/lib/format';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { PIN_META } from '@/lib/tokens';
import { useData } from '@/store/data';

const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM');

export default function TerritoryDetailPage() {
  const { id = '' } = useParams();
  const ds = useDataset();
  const ts = useTerritoryStates();
  const pins = usePinStates();
  const apps = useApplicants();
  const bump = useData((s) => s.bump);
  const navigate = useNavigate();
  const { openApp } = useAppDrawer();
  const c = useColors();

  if (ds.error || ts.error) return <ErrorState onRetry={bump} />;
  if (!ds.data || !ts.data || !pins.data || !apps.data) {
    return (
      <div className="space-y-4 p-6" aria-label="Loading">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const t = ds.data.territories.find((x) => x.id === id);
  const s = ts.data.find((x) => x.territoryId === id);
  if (!t || !s) {
    return (
      <div className="p-6">
        <EmptyState
          title={`No territory ${id}`}
          action={
            <Link to="/territories" className="text-sm font-medium text-brand hover:underline focus-ring">
              Back to territories
            </Link>
          }
        />
      </div>
    );
  }

  const tPins = t.pins.map((p) => pins.data!.find((x) => x.pin === p)).filter((p): p is NonNullable<typeof p> => !!p);
  const stores = tPins.filter((p) => p.status === 'store').length;
  const ranked = s.competingIds.map((aid) => apps.data!.find((r) => r.app.id === aid)).filter((r): r is NonNullable<typeof r> => !!r);
  const chart = s.fillHistory.map((h) => ({ month: monthLabel(h.month), filled: h.filled, slots: s.openSlots }));

  return (
    <div className="pb-10">
      <PageHeader
        crumbs={[{ label: 'Territories', to: '/territories' }, { label: t.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t.name}
            <PriorityChip priority={t.priority} size="sm" />
            <TierChip tier={t.tier} size="sm" />
          </span>
        }
        question={`${t.id} · ${t.city}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/territories')}>
              <ArrowLeft /> All territories
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate(`/map?territory=${t.id}`)}>
              <MapIcon /> Open on map
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 md:px-6">
        <section className="card flex flex-wrap items-center gap-x-8 gap-y-4 p-4" aria-label="Territory stats">
          <Gauge value={s.filled} max={s.openSlots} size={64} token={s.filled >= s.openSlots ? 'st-approved' : 'brand'} />
          <Stat label="Slots filled" value={`${s.filled}/${s.openSlots}`} />
          <Stat label="Applicants" value={s.applicants} />
          <Stat label="PINs" value={t.pins.length} />
          <Stat label="Existing stores" value={stores} />
          {s.oversubscribed && <Stat label="Demand" value="Oversubscribed" tone="text-st-rejected text-base" />}
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="card min-w-0 p-4 lg:col-span-5" aria-label="PINs">
            <h2 className="text-sm font-semibold tracking-tight">PINs</h2>
            <p className="mb-3 text-xs text-muted">Click a PIN to see it on the map.</p>
            <ul className="divide-y">
              {tPins.map((p) => {
                const m = PIN_META[p.status];
                return (
                  <li key={p.pin} className="flex items-center gap-3 py-2">
                    <PinChip pin={p.pin} status={p.status} size="sm" count={p.applicantIds.length || undefined} onClick={() => navigate(`/map?pin=${p.pin}`)} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{p.area}</span>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex">
                      <m.icon className="h-3.5 w-3.5" aria-hidden /> {m.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card min-w-0 p-4 lg:col-span-7" aria-label="Competing applicants">
            <h2 className="text-sm font-semibold tracking-tight">Competing applicants</h2>
            <p className="mb-3 text-xs text-muted">Ranked for this territory. Click a row for the full why.</p>
            {ranked.length === 0 ? (
              <EmptyState title="No applicants yet — an open opportunity" />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs text-subtle">
                    <tr className="border-b">
                      <th className="py-1.5 pr-2 font-medium">#</th>
                      <th className="py-1.5 font-medium">Applicant</th>
                      <th className="py-1.5 font-medium">PIN</th>
                      <th className="py-1.5 text-right font-medium">Capacity</th>
                      <th className="py-1.5 pl-3 font-medium">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map(({ app, decision }) => (
                      <tr
                        key={app.id}
                        tabIndex={0}
                        onClick={() => openApp(app.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openApp(app.id)}
                        className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-raised/50 focus-ring"
                      >
                        <td className="py-2 pr-2 text-muted tnum">{decision.territoryRank ?? '—'}</td>
                        <td className="py-2">
                          <span className="font-medium">{app.name}</span> <span className="text-xs text-subtle tnum">{app.id}</span>
                        </td>
                        <td className="py-2 text-muted tnum">{app.pin}</td>
                        <td className="py-2 text-right tnum">{inrLakh(app.investmentLakh)}</td>
                        <td className="py-2 pl-3">
                          <DecisionBadge decision={decision} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <ChartCard
          title="Fill timeline"
          info="Planned stores in this territory by month, against open slots."
          table={<DataTable columns={['Month', 'Filled', 'Slots']} rows={chart.map((d) => [d.month, d.filled, d.slots])} />}
        >
          {!chart.length ? (
            <ChartSkeleton className="h-48" />
          ) : (
            <div className="h-48" role="img" aria-label={`Fill timeline: ${chart.map((d) => `${d.month} ${d.filled} of ${d.slots}`).join(', ')}`}>
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c('border')} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: c('subtle'), fontSize: 11 }} />
                  <YAxis allowDecimals={false} domain={[0, Math.max(s.openSlots, ...chart.map((d) => d.filled)) + 1]} tickLine={false} axisLine={false} tick={{ fill: c('subtle'), fontSize: 11 }} />
                  <RTooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-pop tnum">
                          <b>{payload[0].payload.month}</b> · {payload[0].payload.filled}/{s.openSlots} filled
                        </div>
                      ) : null
                    }
                  />
                  <ReferenceLine y={s.openSlots} stroke={c('muted')} strokeDasharray="4 4" label={{ value: `${s.openSlots} slots`, position: 'insideTopRight', fill: c('muted'), fontSize: 11 }} />
                  <Area type="stepAfter" dataKey="filled" stroke={c('brand')} strokeWidth={2} fill={c('brand', 0.15)} animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
