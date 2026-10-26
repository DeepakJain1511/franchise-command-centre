import { ArrowRight, BellRing, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, DecisionBadge } from '@/components/chips';
import { EmptyState, ListSkeleton } from '@/components/data';
import { useFilteredApplicants } from '@/engine/hooks';
import { useAppDrawer } from '@/lib/hooks';

export function AttentionQueue() {
  const q = useFilteredApplicants();
  const { openApp } = useAppDrawer();
  const items = (q.data ?? [])
    .filter((r) => r.decision.attention)
    .sort((a, b) => (a.decision.attentionPriority ?? 99) - (b.decision.attentionPriority ?? 99));
  const top = items.slice(0, 5);

  return (
    <section className="card flex flex-col lg:col-span-5" aria-label="Needs attention">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <BellRing className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight">Needs you now</h2>
        {items.length > 0 && <span className="rounded-full bg-brand px-1.5 text-2xs font-semibold text-brand-fg tnum">{items.length}</span>}
        <Link to="/applicants?view=attention" className="ml-auto flex items-center gap-0.5 text-xs font-medium text-brand hover:underline focus-ring">
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>
      <div className="flex-1 px-2 pb-2">
        {!q.data ? (
          <div className="p-2">
            <ListSkeleton />
          </div>
        ) : top.length === 0 ? (
          <EmptyState title="Nothing needs attention here" />
        ) : (
          <ul>
            {top.map(({ app, decision }) => (
              <li key={app.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openApp(app.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openApp(app.id))}
                  className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-raised/70 focus-ring"
                >
                  <Avatar name={app.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{app.name}</span>
                      <span className="text-2xs text-subtle tnum">{app.id}</span>
                    </div>
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-st-hold/10 px-1.5 py-0.5 text-2xs font-medium text-st-hold">
                      {decision.attention}
                    </span>
                  </div>
                  <DecisionBadge decision={decision} size="sm" className="hidden sm:inline-flex" />
                  <ChevronRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
