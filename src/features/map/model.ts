import { useMemo } from 'react';
import { create } from 'zustand';
import { useApplicants, useDataset, usePinStates, useTerritoryStates } from '@/engine/hooks';
import type { City, PinState, Priority, Territory, TerritoryState } from '@/engine/types';
import { haversineKm } from '@/lib/geo';
import { layoutHexes, overlapsRing, type HexCell, type HexLayout } from '@/lib/hex';
import type { ApplicantRow } from '@/lib/filtering';

/* ---------------- Map UI state ---------------- */

export interface Layers {
  stores: boolean;
  planned: boolean;
  interest: boolean;
  outlines: boolean;
  rings: boolean;
  labels: boolean;
}

interface MapUi {
  layers: Layers;
  ringKm: number;
  view: 'map' | 'table';
  selecting: boolean;
  area: string[]; // PINs picked with the rectangle tool
  setLayer: (k: keyof Layers, v: boolean) => void;
  setRingKm: (n: number) => void;
  setView: (v: 'map' | 'table') => void;
  setSelecting: (v: boolean) => void;
  setArea: (pins: string[]) => void;
}

export const useMapUi = create<MapUi>((set) => ({
  layers: { stores: true, planned: true, interest: true, outlines: true, rings: false, labels: true },
  ringKm: 3,
  view: 'map',
  selecting: false,
  area: [],
  setLayer: (k, v) => set((s) => ({ layers: { ...s.layers, [k]: v } })),
  setRingKm: (ringKm) => set({ ringKm }),
  setView: (view) => set({ view }),
  setSelecting: (selecting) => set({ selecting }),
  setArea: (area) => set({ area }),
}));

/* ---------------- Assembled model ---------------- */

export interface CitySummary {
  city: City;
  lat: number;
  lng: number;
  slots: number;
  filled: number;
  stores: number;
  territories: Territory[];
  topPriority: Priority | null;
}

export interface MapModel {
  pins: PinState[];
  byPin: Map<string, PinState>;
  layout: HexLayout;
  territories: Territory[];
  tStates: Map<string, TerritoryState>;
  rows: ApplicantRow[];
  rowById: Map<string, ApplicantRow>;
  cities: CitySummary[];
  storeCells: Array<{ storeId: string; pin: string; openedYear: number; cell: HexCell }>;
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

export function useMapModel(): { model: MapModel | null; loading: boolean; error: Error | null } {
  const pinsQ = usePinStates();
  const ds = useDataset();
  const ts = useTerritoryStates();
  const apps = useApplicants();

  const layoutInputs = pinsQ.data;
  // Layout only depends on geography, so recompute only when the PIN list changes.
  const layoutKey = layoutInputs?.map((p) => `${p.pin}:${p.territoryId}`).join('|');
  const layout = useMemo(
    () => (layoutInputs ? layoutHexes(layoutInputs.map((p) => ({ pin: p.pin, city: p.city, lat: p.lat, lng: p.lng, territoryId: p.territoryId }))) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );

  const model = useMemo<MapModel | null>(() => {
    if (!pinsQ.data || !ds.data || !ts.data || !apps.data || !layout) return null;
    const byPin = new Map(pinsQ.data.map((p) => [p.pin, p]));
    const tStates = new Map(ts.data.map((t) => [t.territoryId, t]));
    const acc = new Map<City, { lat: number; lng: number; n: number; stores: number }>();
    for (const p of pinsQ.data) {
      const cell = layout.cells.get(p.pin);
      if (!cell) continue;
      const a = acc.get(p.city) ?? { lat: 0, lng: 0, n: 0, stores: 0 };
      a.lat += cell.center[0];
      a.lng += cell.center[1];
      a.n += 1;
      if (p.status === 'store') a.stores += 1;
      acc.set(p.city, a);
    }
    const cities: CitySummary[] = [...acc.entries()].map(([city, a]) => {
      const territories = ds.data!.territories.filter((t) => t.city === city);
      return {
        city,
        lat: a.lat / a.n,
        lng: a.lng / a.n,
        stores: a.stores,
        territories,
        slots: territories.reduce((n, t) => n + t.openSlots, 0),
        filled: territories.reduce((n, t) => n + (tStates.get(t.id)?.filled ?? 0), 0),
        topPriority: territories.length ? [...territories].sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority])[0].priority : null,
      };
    });
    const storeCells = ds.data.stores
      .map((s) => ({ storeId: s.id, pin: s.pin, openedYear: s.openedYear, cell: layout.cells.get(s.pin)! }))
      .filter((s) => !!s.cell);
    return {
      pins: pinsQ.data,
      byPin,
      layout,
      territories: ds.data.territories,
      tStates,
      rows: apps.data,
      rowById: new Map(apps.data.map((r) => [r.app.id, r])),
      cities,
      storeCells,
    };
  }, [pinsQ.data, ds.data, ts.data, apps.data, layout]);

  return { model, loading: !model && (pinsQ.loading || ds.loading || ts.loading || apps.loading), error: pinsQ.error ?? ds.error ?? ts.error ?? apps.error };
}

/** Nearest existing store to a PIN (on the demo hex layout — approximate). */
export function nearestStore(model: MapModel, pin: string) {
  const cell = model.layout.cells.get(pin);
  if (!cell) return null;
  let best: { storeId: string; pin: string; km: number } | null = null;
  for (const s of model.storeCells) {
    const km = haversineKm({ lat: cell.center[0], lng: cell.center[1] }, { lat: s.cell.center[0], lng: s.cell.center[1] });
    if (!best || km < best.km) best = { storeId: s.storeId, pin: s.pin, km };
  }
  return best;
}

/** PINs whose hex overlaps a catchment ring of any existing store (geometry only, no analysis). */
export function cannibalisationPins(model: MapModel, ringKm: number): Set<string> {
  const out = new Set<string>();
  for (const p of model.pins) {
    if (p.status === 'store') continue;
    const cell = model.layout.cells.get(p.pin);
    if (!cell) continue;
    if (model.storeCells.some((s) => s.cell.city === cell.city && overlapsRing(cell, s.cell.center, ringKm))) out.add(p.pin);
  }
  return out;
}
