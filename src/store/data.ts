import { create } from 'zustand';
import type { ScenarioResult } from '@/engine/types';

interface DataStore {
  /** Bumped whenever engine state changes (load, apply, revert, reset) so hooks refetch. */
  version: number;
  loaded: boolean;
  source: 'sample' | 'upload' | null;
  fileName: string | null;
  bump: () => void;
  setLoaded: (source: 'sample' | 'upload', fileName?: string) => void;
  clear: () => void;

  /* what-if history */
  simulations: ScenarioResult[];
  appliedIds: string[];
  addSimulation: (r: ScenarioResult) => void;
  markApplied: (id: string, applied: boolean) => void;
}

export const useData = create<DataStore>((set) => ({
  version: 0,
  loaded: false,
  source: null,
  fileName: null,
  bump: () => set((s) => ({ version: s.version + 1 })),
  setLoaded: (source, fileName) => set((s) => ({ loaded: true, source, fileName: fileName ?? null, version: s.version + 1 })),
  clear: () => set((s) => ({ simulations: [], appliedIds: [], version: s.version + 1 })),
  simulations: [],
  appliedIds: [],
  addSimulation: (r) => set((s) => ({ simulations: [r, ...s.simulations].slice(0, 8) })),
  markApplied: (id, applied) =>
    set((s) => ({ appliedIds: applied ? [...s.appliedIds, id] : s.appliedIds.filter((x) => x !== id) })),
}));
