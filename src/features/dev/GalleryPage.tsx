import { CheckCircle2, Clock, Command, FileStack, PanelRight, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';
import { PageHeader } from '@/app/AppShell';
import {
  Avatar, DecisionBadge, FlagChip, LanguageBadge, PinChip, PriorityChip, ReasonChip, StageChip, StatusChip, TierChip,
} from '@/components/chips';
import {
  ChartCard, ChartSkeleton, DataTable, Delta, EmptyState, ErrorState, Gauge, KpiCard, ListSkeleton, Skeleton, Sparkline, Stat,
} from '@/components/data';
import { Button } from '@/components/ui/button';
import { Segmented, Select, Slider, Switch } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { useDecisions } from '@/engine/hooks';
import { DECISION_STATUSES, PIN_STATES, STAGES, type Reason } from '@/engine/types';
import { OnboardingStepper, Ring } from '@/features/onboarding/Stepper';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { useUi } from '@/store/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="label mb-3">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

const REASONS: Reason[] = [
  { id: 'g1', label: 'Capacity ₹85 L', sentiment: 'helped', topic: 'investment' },
  { id: 'g2', label: 'Upper floor', sentiment: 'hurt', topic: 'floor' },
  { id: 'g3', label: 'Space size missing', sentiment: 'missing', topic: 'size' },
];
const SPARK = [3, 5, 4, 7, 6, 9, 8, 11];
const BARS = [
  { k: 'A', v: 4 },
  { k: 'B', v: 7 },
  { k: 'C', v: 5 },
];

export default function GalleryPage() {
  const dec = useDecisions();
  const { openApp } = useAppDrawer();
  const setPalette = useUi((s) => s.setPaletteOpen);
  const toast = useUi((s) => s.toast);
  const c = useColors();
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [val, setVal] = useState(3);
  const [sel, setSel] = useState<'Kannada' | 'English' | 'Hindi'>('Kannada');

  const d007 = dec.data?.find((d) => d.applicationId === 'APP-007');
  const d001 = dec.data?.find((d) => d.applicationId === 'APP-001');
  const plan = dec.data?.find((d) => d.onboarding?.atRisk)?.onboarding ?? dec.data?.find((d) => d.onboarding)?.onboarding;

  return (
    <div className="pb-10">
      <PageHeader title="Component gallery" question="Every shared component, for review" />
      <div className="space-y-4 px-4 md:px-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Applications" icon={<FileStack />} value={40} delta={16} spark={SPARK} />
          <KpiCard label="Approved" icon={<CheckCircle2 className="text-st-approved" />} token="st-approved" value={11} delta={1} spark={SPARK} active />
          <KpiCard label="On hold" icon={<Clock className="text-st-hold" />} token="st-hold" value={9} delta={4} deltaInvert spark={SPARK} />
          <KpiCard label="Dimmed" value={5} delta={0} spark={SPARK} dimmed />
        </section>

        <Section title="Sparkline · Delta · Stat · Gauge · Ring">
          <div className="w-32">
            <Sparkline data={SPARK} />
          </div>
          <Delta value={4} />
          <Delta value={-3} />
          <Delta value={2} invert />
          <Delta value={0} />
          <Stat label="Slots filled" value="2/3" />
          <Gauge value={2} max={3} />
          <Gauge value={3} max={3} token="st-approved" />
          <Ring value={0} />
          <Ring value={0.5} />
          <Ring value={1} />
        </Section>

        <Section title="Decision badge (click for why)">
          {d007 && <DecisionBadge decision={d007} />}
          {d001 && <DecisionBadge decision={d001} size="lg" />}
          {!dec.data && <Skeleton className="h-6 w-32" />}
        </Section>

        <Section title="Status · Stage">
          {DECISION_STATUSES.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
          {STAGES.map((s) => (
            <StageChip key={s} stage={s} size="sm" />
          ))}
        </Section>

        <Section title="Reasons · Priority · Tier · Language · Flag · Avatar">
          {REASONS.map((r) => (
            <ReasonChip key={r.id} reason={r} />
          ))}
          <ReasonChip reason={REASONS[0]} size="lg" flipped />
          <PriorityChip priority="High" />
          <PriorityChip priority="Medium" />
          <PriorityChip priority="Low" />
          <TierChip tier="Tier 1" />
          <LanguageBadge language="Kannada" />
          <LanguageBadge language="Hindi" />
          <LanguageBadge language="English" />
          <FlagChip>Space size missing</FlagChip>
          <Avatar name="Kavya Rao" />
          <Avatar name="Vikram Singh" />
        </Section>

        <Section title="PIN states">
          {PIN_STATES.map((s, i) => (
            <PinChip key={s} pin={`56000${i}`} status={s} count={s === 'interest' ? 2 : undefined} />
          ))}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Chart card" info="Header, info, show-data toggle and ⋯ menu." table={<DataTable columns={['Key', 'Value']} rows={BARS.map((b) => [b.k, b.v])} />}>
            <div className="h-36">
              <ResponsiveContainer>
                <BarChart data={BARS}>
                  <XAxis dataKey="k" tickLine={false} axisLine={false} tick={{ fill: c('subtle'), fontSize: 11 }} />
                  <Bar dataKey="v" fill={c('brand')} radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <section className="card space-y-3 p-4">
            <h2 className="label">Skeletons</h2>
            <Skeleton className="h-4 w-1/2" />
            <ChartSkeleton className="h-24" />
            <ListSkeleton rows={2} />
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card">
            <EmptyState onReset={() => toast('Filters reset')} />
          </section>
          <section className="card">
            <ErrorState onRetry={() => toast('Retrying…')} />
          </section>
        </div>

        <Section title="Buttons">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <Button size="icon" aria-label="Add">
            <Plus />
          </Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Controls">
          <Segmented ariaLabel="Demo segmented" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Board' }, { value: 'b', label: 'Table' }, { value: 'c', label: 'Timeline' }]} />
          <Switch checked={on} onCheckedChange={setOn} aria-label="Demo switch" />
          <div className="w-40">
            <Slider min={1} max={8} step={0.5} value={[val]} onValueChange={([v]) => setVal(v)} thumbLabel="Demo slider" />
          </div>
          <span className="text-xs text-muted tnum">{val} km</span>
          <div className="w-40">
            <Select ariaLabel="Demo select" value={sel} onChange={setSel} options={[{ value: 'Kannada', label: 'Kannada' }, { value: 'English', label: 'English' }, { value: 'Hindi', label: 'Hindi' }]} />
          </div>
          <Tooltip content="A short tooltip">
            <Button variant="ghost">Hover me</Button>
          </Tooltip>
        </Section>

        <Section title="Overlays · Toasts">
          <Button onClick={() => openApp('APP-007')}>
            <PanelRight /> Open drawer
          </Button>
          <Button onClick={() => setPalette(true)}>
            <Command /> Open ⌘K
          </Button>
          <Button onClick={() => toast('Default toast')}>Toast</Button>
          <Button onClick={() => toast('Saved', 'success')}>Success toast</Button>
          <Button onClick={() => toast('Check this', 'warning')}>Warning toast</Button>
        </Section>

        <section className="card p-4">
          <h2 className="label mb-4">Onboarding stepper</h2>
          {plan ? <OnboardingStepper plan={plan} /> : <Skeleton className="h-10" />}
        </section>
      </div>
    </div>
  );
}
