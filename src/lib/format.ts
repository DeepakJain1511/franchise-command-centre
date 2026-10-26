const nf = new Intl.NumberFormat('en-IN');
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/** Indian grouping: 1,20,000 */
export const num = (n: number) => nf.format(n);

/** Capacity in lakh -> "₹25 L" / "₹1.2 Cr" */
export function inrLakh(lakh: number | null): string {
  if (lakh === null || Number.isNaN(lakh)) return 'Not given';
  if (lakh >= 100) return `₹${nf1.format(lakh / 100)} Cr`;
  return `₹${nf1.format(lakh)} L`;
}

/** Full rupees from lakh, e.g. ₹25,00,000 */
export const inrFull = (lakh: number) => `₹${nf.format(Math.round(lakh * 100000))}`;

export const sqft = (n: number | null) => (n == null ? null : `${nf.format(n)} sq ft`);

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${num(n)} ${n === 1 ? word : pluralWord}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
