import { describe, expect, it } from 'vitest';
import { pincodes } from '@/data/mock/pincodes';
import { territories } from '@/data/mock/territories';
import { haversineKm } from './geo';
import { layoutHexes } from './hex';

describe('layoutHexes', () => {
  const inputs = pincodes.map((p) => ({ ...p, territoryId: territories.find((t) => t.pins.includes(p.pin))?.id ?? null }));
  const layout = layoutHexes(inputs);

  it('places every PIN tile close to its real locality', () => {
    for (const p of pincodes) {
      const cell = layout.cells.get(p.pin)!;
      const km = haversineKm({ lat: p.lat, lng: p.lng }, { lat: cell.center[0], lng: cell.center[1] });
      // within ~2 tile widths of the true point
      expect(km, `${p.pin} ${p.area} is ${km.toFixed(2)} km off`).toBeLessThan(cell.sizeKm * 3.5);
    }
  });

  it('never stacks two PINs on one tile', () => {
    const keys = [...layout.cells.values()].map((c) => `${c.city}|${c.q},${c.r}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
