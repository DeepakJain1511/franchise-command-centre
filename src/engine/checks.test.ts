/** The checks agent must find zero rule violations on the sample data, after every what-if preset, and over time. */
import { describe, expect, it } from 'vitest';
import { applications } from '@/data/mock/applications';
import { stores } from '@/data/mock/stores';
import { territories } from '@/data/mock/territories';
import { runChecks } from './checks';
import type { BaseData, Override } from './model';
import { runPipeline } from './pipeline';

const base: BaseData = { applications, territories, stores, parseWarnings: [] };
const D0 = '2026-10-26';
const ov = (targetId: string, field: Override['field'], value: Override['value']): Override => ({
  id: `${targetId}-${field}`, target: 'app', targetId, field, value, timestamp: 't', effectiveDate: D0, source: 'form', label: '',
});

const scenarios: Array<[string, Override[]]> = [
  ['base', []],
  ['APP-012 finds a 450 sq ft ground-floor space', [ov('APP-012', 'space', 'Rented'), ov('APP-012', 'floor', 'Ground'), ov('APP-012', 'spaceSqft', 450)]],
  ['APP-019 shares its size', [ov('APP-019', 'spaceSqft', 400)]],
  ['APP-002 withdraws', [ov('APP-002', 'withdrawn', true)]],
  ['APP-007 moves to a ground floor', [ov('APP-007', 'floor', 'Ground')]],
];

describe('checks agent', () => {
  for (const [name, overrides] of scenarios) {
    for (const day of [0, 8, 31, 36, 98]) {
      it(`${name} · day ${day}: no rule violations`, () => {
        const today = new Date(Date.UTC(2026, 9, 26 + day)).toISOString().slice(0, 10);
        const res = runPipeline(base, overrides, { decisionDate: D0, today });
        const report = runChecks(base, overrides, res);
        expect(report.items.filter((i) => i.status === 'fail').map((i) => `${i.title}: ${i.detail}`)).toEqual([]);
      });
    }
  }
});
