import { PageHeader } from '@/app/AppShell';
import { ErrorState, Reveal } from '@/components/data';
import { useApplicants } from '@/engine/hooks';
import { useData } from '@/store/data';
import { AttentionQueue } from './AttentionQueue';
import { DecisionDonut } from './DecisionDonut';
import { Funnel } from './Funnel';
import { KpiStrip } from './KpiStrip';
import { MoreInsights } from './MoreInsights';
import { ReceivedTimeline } from './ReceivedTimeline';
import { TerritoryFill } from './TerritoryFill';

export default function OverviewPage() {
  const q = useApplicants();
  const bump = useData((s) => s.bump);
  return (
    <div className="pb-10">
      <PageHeader title="Overview" question="Where do we stand?" />
      {q.error ? (
        <ErrorState onRetry={bump} />
      ) : (
        <div className="space-y-4 px-4 md:px-6">
          <Reveal>
            <KpiStrip />
          </Reveal>
          <Reveal delay={0.06} className="grid gap-4 lg:grid-cols-12">
            <ReceivedTimeline />
          </Reveal>
          <Reveal delay={0.12} className="grid gap-4 lg:grid-cols-12">
            <Funnel />
            <DecisionDonut />
          </Reveal>
          <Reveal delay={0.18} className="grid gap-4 lg:grid-cols-12">
            <TerritoryFill />
            <AttentionQueue />
          </Reveal>
          <Reveal delay={0.24}>
            <MoreInsights />
          </Reveal>
        </div>
      )}
    </div>
  );
}
