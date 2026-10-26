import { beforeEach, describe, expect, it } from 'vitest';
import { cannedScenarios } from '@/data/mock/scenarios';
import { pincodes } from '@/data/mock/pincodes';
import { mockEngine } from './mockEngine';
import { Application, Decision, Store, Territory } from './types';

async function assertOneStorePerPin() {
  const [ds, decisions] = await Promise.all([mockEngine.getDataset(), mockEngine.getDecisions()]);
  const storePins = new Set(ds.stores.map((s) => s.pin));
  const approvedPins = decisions
    .filter((d) => d.status === 'Approved')
    .map((d) => ds.applications.find((a) => a.id === d.applicationId)!.pin);
  // no two approved / planned applicants share a PIN
  expect(new Set(approvedPins).size).toBe(approvedPins.length);
  // none share a PIN with an existing store
  approvedPins.forEach((p) => expect(storePins.has(p), `approved PIN ${p} has a store`).toBe(false));
  // no territory is over-allocated
  const ts = await mockEngine.getTerritoryState();
  ts.forEach((t) => expect(t.filled, t.territoryId).toBeLessThanOrEqual(t.openSlots));
}

describe('mock engine fixtures', () => {
  beforeEach(async () => {
    await mockEngine.reset();
  });

  it('match the zod schemas', async () => {
    const ds = await mockEngine.getDataset();
    ds.applications.forEach((a) => Application.parse(a));
    ds.territories.forEach((t) => Territory.parse(t));
    ds.stores.forEach((s) => Store.parse(s));
    (await mockEngine.getDecisions()).forEach((d) => Decision.parse(d));
  });

  it('has the expected shape: 40 apps, 8 territories, 10 stores', async () => {
    const ds = await mockEngine.getDataset();
    expect(ds.applications).toHaveLength(40);
    expect(ds.territories).toHaveLength(8);
    expect(ds.stores).toHaveLength(10);
  });

  it('never puts two stores in the same PIN', assertOneStorePerPin);

  it.each(cannedScenarios.map((s) => [s.key, s] as const))('keeps one store per PIN after applying %s', async (_k, s) => {
    const r = await mockEngine.simulate({ applicationId: s.applicationId, ...s.preset });
    expect(r.canned).toBe(true);
    await mockEngine.applyScenario(r);
    await assertOneStorePerPin();
    await mockEngine.revertScenario(r.id);
  });

  it('locks every store / allocated PIN on the map', async () => {
    const pins = await mockEngine.getPinStates();
    pins.filter((p) => p.storeId || p.allocatedTo).forEach((p) => expect(p.locked).toBe(true));
  });

  it('has an approximate centroid for every PIN used', async () => {
    const pins = await mockEngine.getPinStates();
    const known = new Set(pincodes.map((p) => p.pin));
    pins.forEach((p) => expect(known.has(p.pin), p.pin).toBe(true));
  });

  it('APP-012 ground-floor scenario improves the decision and ripples', async () => {
    const r = await mockEngine.simulate({ applicationId: 'APP-012', space: 'Rented', floor: 'Ground', spaceSqft: 450 });
    expect(r.before.status).toBe('On hold');
    expect(r.after.status).toBe('Approved');
    expect(r.ripples.some((x) => x.applicationId === 'APP-021')).toBe(true);
  });

  it('answers the canned question about APP-007', async () => {
    const a = await mockEngine.ask('Why is APP-007 on hold?');
    expect(a.status).toBe('On hold');
    expect(a.reasons).toHaveLength(3);
  });
});
