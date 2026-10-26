/**
 * The ONLY way components talk to the engine. Each hook caches by (data version, key)
 * and keeps the previous value while refetching so widgets crossfade instead of blanking.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { applyFilters, type ApplicantRow } from '@/lib/filtering';
import { engine } from './index';
import type { Dataset, Decision, Explanation, PinState, ScenarioChange, ScenarioPreset, ScenarioResult, TerritoryState } from './types';

const cache = new Map<string, Promise<unknown>>();

export interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

export function useEngineQuery<T>(key: string, fn: () => Promise<T>, enabled = true): Query<T> {
  const version = useData((s) => s.version);
  const fullKey = `${version}|${key}`;
  const [state, setState] = useState<Query<T>>({ data: undefined, loading: enabled, error: null });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    if (!cache.has(fullKey)) cache.set(fullKey, fn());
    setState((s) => ({ ...s, loading: true, error: null }));
    (cache.get(fullKey) as Promise<T>)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => {
        cache.delete(fullKey);
        if (alive) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
      });
    return () => {
      alive = false;
    };
    // fn is intentionally excluded: the key identifies the request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, enabled]);

  return state;
}

export const useDataset = () => useEngineQuery<Dataset>('dataset', () => engine.getDataset());
export const useDecisions = () => useEngineQuery<Decision[]>('decisions', () => engine.getDecisions());
export const usePinStates = () => useEngineQuery<PinState[]>('pins', () => engine.getPinStates());
export const useTerritoryStates = () => useEngineQuery<TerritoryState[]>('territories', () => engine.getTerritoryState());
export const useExplanation = (id: string | null) =>
  useEngineQuery<Explanation>(`explain:${id}`, () => engine.explain(id!), !!id);

export const useScenarioPresets = () => useEngineQuery<ScenarioPreset[]>('presets', () => engine.getScenarioPresets());

/* ---------------- Actions (ask / simulate / apply / revert) ---------------- */

function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const run = useCallback(
    async (...args: A): Promise<R> => {
      setLoading(true);
      try {
        return await fn(...args);
      } finally {
        setLoading(false);
      }
    },
    // fn is a stable module-level engine call
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return { run, loading };
}

export const useAsk = () => useAction((q: string) => engine.ask(q));
export const useSimulate = () => useAction((c: ScenarioChange) => engine.simulate(c));

/** Commit / undo a simulated scenario; every screen refetches afterwards. */
export function useScenarioCommit() {
  const apply = useAction(async (r: ScenarioResult) => {
    await engine.applyScenario(r);
    useData.getState().markApplied(r.id, true);
    useData.getState().bump();
  });
  const revert = useAction(async (id: string) => {
    await engine.revertScenario(id);
    useData.getState().markApplied(id, false);
    useData.getState().bump();
  });
  return { apply: apply.run, revert: revert.run, busy: apply.loading || revert.loading };
}

/** Applications joined with their decision and territory (presentation join only). */
export function useApplicants(): Query<ApplicantRow[]> {
  const ds = useDataset();
  const dec = useDecisions();
  const data = useMemo(() => {
    if (!ds.data || !dec.data) return undefined;
    const byId = new Map(dec.data.map((d) => [d.applicationId, d]));
    return ds.data.applications.map((app) => {
      const decision = byId.get(app.id)!;
      const territory = ds.data!.territories.find((t) => t.id === decision.territoryId) ?? null;
      return { app, decision, territory };
    });
  }, [ds.data, dec.data]);
  return { data, loading: ds.loading || dec.loading, error: ds.error ?? dec.error };
}

/** Applicants after the global filter bar (optionally ignoring one key, for chart "own" dimension). */
export function useFilteredApplicants(ignore?: Parameters<typeof applyFilters>[2]): Query<ApplicantRow[]> & { all: ApplicantRow[] | undefined } {
  const q = useApplicants();
  const filters = useFilters();
  const data = useMemo(() => (q.data ? applyFilters(q.data, filters, ignore) : undefined), [q.data, filters, ignore]);
  return { ...q, data, all: q.data };
}
