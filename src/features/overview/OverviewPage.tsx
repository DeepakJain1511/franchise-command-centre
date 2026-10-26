import { PageHeader } from '@/app/AppShell';
import { ErrorState } from '@/components/data';
import { useApplicants } from '@/engine/hooks';
import { useData } from '@/store/data';
import { AttentionQueue } from './AttentionQueue';
import { DecisionDonut } from './DecisionDonut';
import { Funnel } from './Funnel';
import { KpiStrip } from './KpiStrip';
import { MoreInsights } from './MoreInsights';
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
          <KpiStrip />
          <div className="grid gap-4 lg:grid-cols-12">
            <Funnel />
            <DecisionDonut />
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <TerritoryFill />
            <AttentionQueue />
          </div>
          <MoreInsights />
        </div>
      )}
    </div>
  );
}
