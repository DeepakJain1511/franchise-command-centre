/** Compare two pipeline runs: every applicant whose outcome, score, slot or queue position changed (Build Spec §16). */
import { t } from '@/i18n';
import { renderReason } from './explain';
import type { AppResult, DiffEntry, PipelineResult } from './model';

export const outcomeLabel = (x: AppResult) => {
  const base = t('en', `O_${x.outcome}`);
  return x.outcome === 'WAITLIST' && x.waitlistType ? `${base} (${t('en', `WL_${x.waitlistType}`)})` : base;
};

export function diffResults(before: PipelineResult, after: PipelineResult): DiffEntry[] {
  const prev = new Map(before.results.map((r) => [r.id, r]));
  const out: DiffEntry[] = [];
  for (const a of after.results) {
    const b = prev.get(a.id);
    if (!b) continue;
    const changes: DiffEntry['changes'] = [];
    if (outcomeLabel(a) !== outcomeLabel(b)) changes.push({ what: 'outcome', before: outcomeLabel(b), after: outcomeLabel(a) });
    const sb = Math.round(b.adjustedPct);
    const sa = Math.round(a.adjustedPct);
    if (sa !== sb) changes.push({ what: 'score', before: String(sb), after: String(sa) });
    const slot = (x: AppResult) => (x.slotPin ? `${x.slotPin} (${x.slotTerritoryId})` : '—');
    if (slot(a) !== slot(b)) changes.push({ what: 'slot', before: slot(b), after: slot(a) });
    const q = (x: AppResult) => (x.queuePosition ? `#${x.queuePosition}` : '—');
    if (q(a) !== q(b)) changes.push({ what: 'queue', before: q(b), after: q(a) });
    if (!changes.length) continue;
    out.push({
      id: a.id,
      name: a.app.name,
      changes,
      reason: renderReason(a.mainReason, 'en', { flags: a.flags, deadline: a.reservation?.deadline, gapDate: String(a.mainReason.params.date ?? '') || null }),
    });
  }
  return out;
}
