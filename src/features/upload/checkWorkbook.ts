/**
 * Upload PREVIEW only (Phase 1): detect sheets, count rows, check columns.
 * Parsed rows never drive decisions — those still come from the DecisionEngine.
 * PHASE-2: real logic goes here — map rows into Application / Territory and hand them to the engine.
 */
import type { WorkBook } from 'xlsx';

export const EXPECTED = {
  Applications: [
    'Application ID', 'Applicant name', 'City', 'State', 'Pin code', 'Investment capacity (₹ lakh)', 'Retail experience (years)',
    'Current / past business', 'Space available', 'Space size (sq ft)', 'Floor', 'Target launch (months)', 'Preferred language',
    'Notes from applicant',
  ],
  Territories: ['Territory ID', 'City', 'State', 'Pin codes covered', 'City tier', 'Open slots', 'Priority'],
  'Existing stores': ['Store ID', 'City', 'Pin code', 'Opened (year)'],
} as const;

export type SheetName = keyof typeof EXPECTED;

export interface SheetCheck {
  name: SheetName;
  found: boolean;
  rows: number;
  missingColumns: string[];
  builtIn: boolean;
}

export interface WorkbookCheck {
  ok: boolean;
  sheets: SheetCheck[];
  errors: string[];
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} /()₹]/gu, '').trim();

/** The template's grey example row (row 3) — skipped if left in place. */
const EXAMPLE_IDS: Record<SheetName, string> = { Applications: 'APP-001|Ravi Kumar', Territories: 'TER-01|Mysuru', 'Existing stores': '' };

export function checkWorkbook(wb: WorkBook, utils: typeof import('xlsx').utils): WorkbookCheck {
  const errors: string[] = [];
  const sheets: SheetCheck[] = (Object.keys(EXPECTED) as SheetName[]).map((name) => {
    const builtIn = name === 'Existing stores';
    const actual = wb.SheetNames.find((n) => norm(n) === norm(name));
    if (!actual) {
      if (!builtIn) errors.push(`The "${name}" sheet is missing. Use the template's sheet names.`);
      return { name, found: false, rows: 0, missingColumns: [], builtIn };
    }
    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[actual], { header: 1, defval: '', blankrows: false });
    const expected = EXPECTED[name];
    // Header row = first of the top 6 rows that contains the first expected column
    const headerIdx = rows.slice(0, 6).findIndex((r) => r.some((c) => norm(c) === norm(expected[0])));
    if (headerIdx < 0) {
      errors.push(`Couldn't find the header row in "${name}" — it should include "${expected[0]}".`);
      return { name, found: true, rows: 0, missingColumns: [...expected], builtIn };
    }
    const header = rows[headerIdx].map(norm);
    const missingColumns = expected.filter((col) => !header.includes(norm(col)));
    missingColumns.forEach((col) => errors.push(`${name} sheet is missing the "${col}" column.`));
    const data = rows.slice(headerIdx + 1).filter((r) => String(r[0] ?? '').trim() !== '');
    const [exId, exName] = EXAMPLE_IDS[name].split('|');
    const withoutExample = data.filter((r, i) => !(i === 0 && exId && String(r[0]).trim() === exId && String(r[1]).trim() === exName));
    if (!builtIn && withoutExample.length === 0) errors.push(`The "${name}" sheet has no rows yet — add data from row 4.`);
    return { name, found: true, rows: withoutExample.length, missingColumns, builtIn };
  });
  return { ok: errors.length === 0, sheets, errors };
}

export function fileTypeError(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return null;
  return `That's a .${ext || 'unknown'} file — upload the Excel template (.xlsx).`;
}
