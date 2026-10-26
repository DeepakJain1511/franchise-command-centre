import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { checkWorkbook, EXPECTED } from './checkWorkbook';

const template = () => XLSX.read(fs.readFileSync(path.resolve(__dirname, '../../../public/Case1_Franchise_Test_Data_Format.xlsx')));

function book(apps: unknown[][], terr: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['title'], ...apps]), 'Applications');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['title'], ...terr]), 'Territories');
  return wb;
}

describe('checkWorkbook', () => {
  it('recognises the judges template and skips its example row', () => {
    const r = checkWorkbook(template(), XLSX.utils);
    const apps = r.sheets.find((s) => s.name === 'Applications')!;
    expect(apps.found).toBe(true);
    expect(apps.missingColumns).toEqual([]);
    expect(apps.rows).toBe(0); // only the grey example row is present
    expect(r.sheets.find((s) => s.name === 'Existing stores')!.rows).toBe(10);
  });

  it('counts data rows', () => {
    const r = checkWorkbook(
      book(
        [[...EXPECTED.Applications], ['APP-001', 'A'], ['APP-002', 'B']],
        [[...EXPECTED.Territories], ['TER-02', 'Mysuru']],
      ),
      XLSX.utils,
    );
    expect(r.ok).toBe(true);
    expect(r.sheets[0].rows).toBe(2);
    expect(r.sheets[1].rows).toBe(1);
  });

  it('explains a missing column in plain words', () => {
    const r = checkWorkbook(
      book([[...EXPECTED.Applications], ['APP-002', 'x']], [EXPECTED.Territories.filter((c) => c !== 'Open slots'), ['TER-02']]),
      XLSX.utils,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Territories sheet is missing the "Open slots" column.');
  });
});
