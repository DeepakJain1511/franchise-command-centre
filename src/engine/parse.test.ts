/** Parser (Build Spec §3): sheets by headers, tolerant headers, combined columns, messy values, example row. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { applications } from '@/data/mock/applications';
import { stores } from '@/data/mock/stores';
import { territories } from '@/data/mock/territories';
import { runPipeline } from './pipeline';
import { parseLakh, parseWorkbook } from './parse';

const D0 = '2026-10-26';
const read = (file: string) => XLSX.read(readFileSync(path.join(__dirname, '../../public', file)), { cellStyles: true });
const opts = { decisionDate: D0, today: D0 };

describe('parseWorkbook', () => {
  it('the blank judges template is recognised, the grey example row skipped, and the empty sheets reported', () => {
    const { report, base } = parseWorkbook(read('Case1_Franchise_Test_Data_Format.xlsx'), XLSX.utils, { submittedAt: D0 });
    expect(base).toBeNull();
    expect(report.sheets.find((s) => s.kind === 'Applications')).toMatchObject({ found: true, rows: 0 });
    expect(report.errors.some((e) => /no rows yet/.test(e))).toBe(true);
    expect(report.warnings.some((w) => /grey example row/.test(w))).toBe(true);
  });

  it('sample_data.xlsx (template format) reproduces the built-in sample decisions exactly', () => {
    const { report, base } = parseWorkbook(read('sample_data.xlsx'), XLSX.utils, { submittedAt: D0 });
    expect(report.ok).toBe(true);
    expect(base!.applications).toHaveLength(applications.length);
    expect(base!.territories).toHaveLength(territories.length);
    expect(base!.stores).toHaveLength(10);
    const fromFile = runPipeline(base!, [], opts).results.map((r) => [r.id, r.outcome, r.slotPin, r.adjustedScore]);
    const builtIn = runPipeline({ applications, territories, stores, parseWarnings: [] }, [], opts).results.map((r) => [r.id, r.outcome, r.slotPin, r.adjustedScore]);
    expect(fromFile).toEqual(builtIn);
  });

  it('detects sheets by headers (any sheet name), tolerates header variants, combined City · State · Pin and messy values', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['What the columns mean'], ['Applications', 'Investment capacity', 'blah']]), 'Glossary');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['  APPLICATION ID ', 'Applicant Name', 'City · State · Pin code', 'Investment capacity', 'Retail experience', 'Current / past business', 'Space available', 'Space size', 'floor', 'Target launch', 'Preferred language', 'Notes'],
        ['APP-101', 'Asha', 'Mysore · Karnataka · 570002', '₹25 lakh', '', 'kirana', 'rented', '450 sq ft', 'ground', '3 months', 'kannada', ''],
        ['APP-102', 'Bala', 'Bangalore | Karnataka | 560200', '1.2 Cr', '6 yrs', 'Pharmacy', 'OWN', '', 'mall', '', 'hindi', 'before Diwali'],
        ['APP-103', 'Chitra', 'Mysuru, Karnataka, 560200', '20L', '2', '', 'Not yet identified', '300', 'Ground', 4, '', ''],
      ]),
      'Sheet A',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Territory ID', 'City · State', 'Pin codes covered', 'Tier', 'Open slots', 'Priority'],
        ['TER-01', 'Mysuru · Karnataka', '570002, 570050', 'Tier 2', 1, 'high'],
        ['TER-02', 'Bengaluru · Karnataka', '560200;560201', '1', '2', 'Medium'],
      ]),
      'Zones',
    );
    const { report, base } = parseWorkbook(wb, XLSX.utils, { submittedAt: D0 });
    expect(report.ok).toBe(true);
    expect(report.sheets.find((s) => s.kind === 'Existing stores')).toMatchObject({ builtIn: true, rows: 10 });
    const [a, b, c] = base!.applications;
    expect(a).toMatchObject({ city: 'Mysuru', pin: '570002', investmentLakh: 25, experienceYears: null, space: 'Rented', spaceSqft: 450, floor: 'Ground', launchMonths: 3, language: 'Kannada' });
    expect(b).toMatchObject({ city: 'Bengaluru', pin: '560200', investmentLakh: 120, experienceYears: 6, space: 'Owned', spaceSqft: null, floor: 'Mall unit', launchMonths: null, language: 'Hindi' });
    expect(c).toMatchObject({ city: 'Mysuru', pin: '560200', investmentLakh: 20, language: 'English' });
    expect(base!.territories[1]).toMatchObject({ city: 'Bengaluru', pins: ['560200', '560201'], tier: 'Tier 1', openSlots: 2, priority: 'Medium' });

    // Never crashes on bad data — it turns into flags.
    const res = runPipeline(base!, [], opts);
    const flags = (id: string) => res.results.find((r) => r.id === id)!.flags.map((f) => f.code);
    expect(flags('APP-101')).toContain('F_EXP_MISSING');
    expect(flags('APP-102')).toEqual(expect.arrayContaining(['F_SIZE_MISSING', 'F_LAUNCH_MISSING', 'F_NOTES_DATE']));
    expect(flags('APP-103')).toEqual(expect.arrayContaining(['F_PIN_CITY_MISMATCH', 'F_NO_SPACE', 'F_SPACE_CONTRADICTION']));
  });

  it('missing key columns give friendly, specific errors', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Application ID', 'Applicant name', 'City', 'Investment capacity (₹ lakh)'], ['APP-001', 'A', 'Mysuru', 25]]), 'Applications');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Territory ID', 'City', 'Pin codes covered', 'City tier', 'Priority'], ['TER-01', 'Mysuru', '570001', 'Tier 2', 'High']]), 'Territories');
    const { report } = parseWorkbook(wb, XLSX.utils, { submittedAt: D0 });
    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Applications sheet is missing the "Pin code" column.');
    expect(report.errors).toContain('Territories sheet is missing the "Open slots" column.');
  });

  it('parses ₹ lakh in the formats the spec lists', () => {
    expect(parseLakh(25)).toBe(25);
    expect(parseLakh('25L')).toBe(25);
    expect(parseLakh('₹25 lakh')).toBe(25);
    expect(parseLakh('25.5')).toBe(25.5);
    expect(parseLakh('25,00,000')).toBe(25);
    expect(parseLakh('')).toBeNull();
  });
});
