import type { Application, Decision, Stage, Territory } from '@/engine/types';
import type { Filters, ListKey } from '@/store/filters';
import { daysAgo } from './time';

export interface ApplicantRow {
  app: Application;
  decision: Decision;
  territory: Territory | null;
}

/** "Reached this stage" semantics used by the funnel and the stage filter. */
export function reachedStage(stage: Stage, d: Decision): boolean {
  switch (stage) {
    case 'Applied':
      return true;
    case 'Screened':
      return d.stage !== 'Applied';
    case 'Approved':
      return d.status === 'Approved';
    case 'On hold':
      return d.stage === 'On hold';
    case 'In onboarding':
      return d.stage === 'In onboarding' || d.stage === 'Open';
    case 'Open':
      return d.stage === 'Open';
  }
}

const WINDOW_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

/** Filter keys a widget can ignore (its own dimension), incl. the timeline range. */
export type IgnoreKey = ListKey | 'range';

export function applyFilters(rows: ApplicantRow[], f: Filters, ignore?: IgnoreKey | IgnoreKey[]): ApplicantRow[] {
  const skip = new Set<IgnoreKey>(Array.isArray(ignore) ? ignore : ignore ? [ignore] : []);
  const on = (k: ListKey) => !skip.has(k) && f[k].length > 0;

  return rows.filter(({ app, decision, territory }) => {
    if (on('city') && !f.city.includes(app.city)) return false;
    if (on('territory') && !(decision.territoryId && f.territory.includes(decision.territoryId))) return false;
    if (on('status') && !f.status.includes(decision.status)) return false;
    if (on('stage') && !f.stage.some((s) => reachedStage(s, decision))) return false;
    if (on('priority') && !(territory && f.priority.includes(territory.priority))) return false;
    if (on('language') && !f.language.includes(app.language)) return false;
    if (on('pin') && !f.pin.includes(app.pin)) return false;
    if (f.window !== 'all' && daysAgo(app.submittedAt) > WINDOW_DAYS[f.window]) return false;
    if (f.range && !skip.has('range') && (app.submittedAt < f.range[0] || app.submittedAt > f.range[1])) return false;
    return true;
  });
}
