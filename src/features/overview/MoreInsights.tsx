import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Avatar } from '@/components/chips';
import { ChartCard, ChartSkeleton, DataTable } from '@/components/data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { useFilteredApplicants } from '@/engine/hooks';
import { CITIES, DECISION_STATUSES, type DecisionStatus } from '@/engine/types';
import { CAPACITY_BUCKETS } from '@/lib/aggregate';
import { cn } from '@/lib/cn';
import type { ApplicantRow } from '@/lib/filtering';
import { inrLakh, pct } from '@/lib/format';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { STATUS_META } from '@/lib/tokens';
import { useFilters } from '@/store/filters';

const axis = { fontSize: 11, tickLine: false, axisLine: false } as const;

function CapacityHistogram({ rows }: { rows: ApplicantRow[] }) {
  const c = useColors();
  const { openApp } = useAppDrawer();
  const [sel, setSel] = useState<string | null>(null);
  const data = CAPACITY_BUCKETS.map((b) => {
    const list = rows.filter((r) => (r.app.investmentLakh ?? -1) >= b.min && (r.app.investmentLakh ?? -1) < b.max);
    return { key: b.key, label: b.label, n: list.length, share: rows.length ? list.length / rows.length : 0, list };
  });
  const active = data.find((d) => d.key === sel);
  return (
    <ChartCard
      title="Investment capacity"
      info="Applicants by investment capacity. Click a bar to list them."
      table={<DataTable columns={['Capacity', 'Applicants', 'Share']} rows={data.map((d) => [d.label, d.n, pct(d.share)])} />}
    >
      <div className="h-44" role="img" aria-label={`Capacity distribution: ${data.map((d) => `${d.label} ${d.n}`).join(', ')}`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c('border')} />
            <XAxis dataKey="label" {...axis} tick={{ fill: c('subtle'), fontSize: 10 }} interval={0} />
            <YAxis allowDecimals={false} {...axis} tick={{ fill: c('subtle'), fontSize: 10 }} />
            <RTooltip
              cursor={{ fill: c('raised') }}
              content={({ active: a, payload }) =>
                a && payload?.length ? (
                  <div className="rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-pop tnum">
                    <b>{payload[0].payload.label}</b> · {payload[0].payload.n} · {pct(payload[0].payload.share)}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="n" radius={[6, 6, 2, 2]} onClick={(d: { key?: string }) => setSel((s) => (s === d.key ? null : d.key ?? null))} className="cursor-pointer">
              {data.map((d) => (
                <Cell key={d.key} fill={c('brand')} fillOpacity={!sel || sel === d.key ? 0.85 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {active && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
          {active.list.map((r) => (
            <button key={r.app.id} type="button" onClick={() => openApp(r.app.id)} className="inline-flex items-center gap-1.5 rounded-full border bg-surface py-0.5 pl-0.5 pr-2 text-xs hover:bg-raised focus-ring">
              <Avatar name={r.app.name} className="h-5 w-5 text-[9px]" />
              {r.app.name}
              <span className="text-subtle tnum">{inrLakh(r.app.investmentLakh)}</span>
            </button>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function ExperienceScatter({ rows }: { rows: ApplicantRow[] }) {
  const c = useColors();
  const { openApp } = useAppDrawer();
  const [hidden, setHidden] = useState<DecisionStatus[]>([]);
  return (
    <ChartCard
      title="Experience vs capacity"
      info="Each dot is an applicant. Click a dot to open them."
      table={<DataTable columns={['Applicant', 'Experience', 'Capacity']} rows={rows.map((r) => [r.app.name, r.app.experienceYears === null ? 'Not given' : `${r.app.experienceYears} yrs`, inrLakh(r.app.investmentLakh)])} />}
    >
      <div className="h-44" role="img" aria-label="Scatter of retail experience against investment capacity">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={c('border')} />
            <XAxis type="number" dataKey="x" name="Experience" unit="y" {...axis} tick={{ fill: c('subtle'), fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name="Capacity" {...axis} tick={{ fill: c('subtle'), fontSize: 10 }} tickFormatter={(v: number) => inrLakh(v)} />
            <ZAxis range={[60, 60]} />
            <RTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-pop tnum">
                    <b>{payload[0].payload.name}</b> · {payload[0].payload.x} yrs · {inrLakh(payload[0].payload.y)}
                  </div>
                ) : null
              }
            />
            {DECISION_STATUSES.filter((s) => !hidden.includes(s)).map((s) => (
              <Scatter
                key={s}
                name={s}
                data={rows.filter((r) => r.decision.status === s).map((r) => ({ x: r.app.experienceYears, y: r.app.investmentLakh, name: r.app.name, id: r.app.id }))}
                fill={c(STATUS_META[s].token)}
                fillOpacity={0.85}
                onClick={(d: { id?: string }) => d.id && openApp(d.id)}
                className="cursor-pointer"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {DECISION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={!hidden.includes(s)}
            onClick={() => setHidden((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]))}
            className={cn('flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs text-muted hover:bg-raised focus-ring', hidden.includes(s) && 'opacity-35')}
          >
            <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />
            {STATUS_META[s].short}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

function LaunchHeatmap({ rows }: { rows: ApplicantRow[] }) {
  const f = useFilters();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const cities = CITIES.filter((city) => rows.some((r) => r.app.city === city));
  const cell = (city: string, m: number) => rows.filter((r) => r.app.city === city && r.app.launchMonths === m).length;
  const max = Math.max(1, ...cities.flatMap((city) => months.map((m) => cell(city, m))));
  return (
    <ChartCard
      title="Launch timeline"
      info="Target launch month by city. Click a cell to filter by city."
      table={<DataTable columns={['City', ...months.map((m) => `M${m}`)]} rows={cities.map((city) => [city, ...months.map((m) => cell(city, m))])} />}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-separate border-spacing-[3px] text-2xs" aria-label="Launch month heatmap">
          <thead>
            <tr>
              <th />
              {months.map((m) => (
                <th key={m} className="font-medium text-subtle tnum">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city}>
                <th className="whitespace-nowrap pr-1 text-left font-medium text-muted">{city.replace('Hubballi-Dharwad', 'Hubballi')}</th>
                {months.map((m) => {
                  const n = cell(city, m);
                  return (
                    <td key={m} className="p-0">
                      <Tooltip content={`${city} · launch in ${m} mo · ${n} applicant${n === 1 ? '' : 's'}`}>
                        <button
                          type="button"
                          disabled={n === 0}
                          onClick={() => f.only('city', city)}
                          aria-label={`${city}, month ${m}: ${n}`}
                          className="block h-6 w-full min-w-5 rounded-[5px] focus-ring disabled:cursor-default"
                          style={{ background: n ? `hsl(var(--brand) / ${0.15 + 0.75 * (n / max)})` : 'hsl(var(--raised))' }}
                        >
                          {n > 0 && <span className={cn('font-semibold tnum', n / max > 0.5 ? 'text-brand-fg' : 'text-fg')}>{n}</span>}
                        </button>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-2xs text-subtle">Months from today</p>
      </div>
    </ChartCard>
  );
}

export function MoreInsights() {
  const q = useFilteredApplicants();
  return (
    <Accordion type="single" collapsible className="card px-4">
      <AccordionItem value="more">
        <AccordionTrigger className="py-3">More insights</AccordionTrigger>
        <AccordionContent>
          {!q.data ? (
            <ChartSkeleton className="h-44" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              <CapacityHistogram rows={q.data} />
              <ExperienceScatter rows={q.data} />
              <LaunchHeatmap rows={q.data} />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

