/** Presentation-only aggregation helpers for charts (counts, buckets, trends). */
import { addDays, parseISO } from 'date-fns';
import type { ApplicantRow } from './filtering';
import { DEMO_TODAY, iso } from './time';

/** Weekly counts of applications received for the last `weeks` weeks (oldest first). */
export function weeklyReceived(rows: ApplicantRow[], weeks = 8, pick: (r: ApplicantRow) => boolean = () => true): number[] {
  const out = Array.from({ length: weeks }, () => 0);
  for (const r of rows) {
    if (!pick(r)) continue;
    const days = (DEMO_TODAY.getTime() - parseISO(r.app.submittedAt).getTime()) / 86_400_000;
    const w = Math.floor(days / 7);
    if (w >= 0 && w < weeks) out[weeks - 1 - w] += 1;
  }
  return out;
}

/** Cumulative series: how many matching rows existed at the end of each week. */
export function weeklyCumulative(rows: ApplicantRow[], weeks = 8, pick: (r: ApplicantRow) => boolean = () => true): number[] {
  return Array.from({ length: weeks }, (_, i) => {
    const cutoff = iso(addDays(DEMO_TODAY, -7 * (weeks - 1 - i)));
    return rows.filter((r) => pick(r) && r.app.submittedAt <= cutoff).length;
  });
}

/** Rows that already existed `days` ago — used for "delta vs previous period". */
export const asOf = (rows: ApplicantRow[], days = 28) => {
  const cutoff = iso(addDays(DEMO_TODAY, -days));
  return rows.filter((r) => r.app.submittedAt <= cutoff);
};

export function countBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const i of items) {
    const k = key(i);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const CAPACITY_BUCKETS = [
  { key: '<25L', label: '< ₹25 L', min: 0, max: 25 },
  { key: '25-50L', label: '₹25–50 L', min: 25, max: 50 },
  { key: '50-75L', label: '₹50–75 L', min: 50, max: 75 },
  { key: '75L-1Cr', label: '₹75 L–1 Cr', min: 75, max: 100 },
  { key: '1Cr+', label: '₹1 Cr +', min: 100, max: Infinity },
] as const;
