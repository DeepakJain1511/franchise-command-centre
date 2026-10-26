/**
 * The ONLY way components talk to the engine. Each hook caches by (data version, key)
 * and keeps the previous value while refetching so widgets crossfade instead of blanking.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { applyFilters, type ApplicantRow } from '@/lib/filtering';
import { engine } from './index';
import type {
  Alert, Change, CheckReport, Dataset, Decision, Explanation, InboxThread, Language, Override, PartnerProfile, PinState, PipelineResult, ScenarioChange,
  ScenarioPreset, ScenarioResult, StaffRole, StaffRoster, TaskStatus, TerritoryState,
} from './types';

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
export const usePartnerProfile = (id: string | null) =>
  useEngineQuery<PartnerProfile>(`partner:${id}`, () => engine.getPartnerProfile(id!), !!id);

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

/** Ask may apply an update (follow-ups, spec §16) — refresh every screen when it does. */
export const useAsk = () =>
  useAction(async (q: string) => {
    const a = await engine.ask(q);
    if (a.kind === 'update') useData.getState().bump();
    return a;
  });
export const useSimulate = () => useAction((c: ScenarioChange) => engine.simulate(c));
export const useSendPartnerMessage = () =>
  useAction(async (id: string, text: string) => {
    const m = await engine.sendPartnerMessage(id, text);
    useData.getState().bump();
    return m;
  });
export const useStaffRoster = (id: string | null) => useEngineQuery<StaffRoster>(`staff:${id}`, () => engine.getStaff(id!), !!id);
/** Staff actions resolve with the updated roster. */
export function useStaffActions() {
  const add = useAction((id: string, s: { name: string; role: StaffRole; language: Language }) => engine.addStaff(id, s));
  const assign = useAction((id: string, staffId: string, moduleId: string) => engine.assignStaffModule(id, staffId, moduleId));
  const complete = useAction((id: string, staffId: string, moduleId: string) => engine.completeStaffModule(id, staffId, moduleId));
  const remove = useAction((id: string, staffId: string) => engine.removeStaff(id, staffId));
  return { add: add.run, assign: assign.run, complete: complete.run, remove: remove.run, busy: add.loading || assign.loading || complete.loading || remove.loading };
}

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

/* ---------------- Spec §15–§16: company actions, follow-ups, inbox, checks ---------------- */

export const usePipeline = () => useEngineQuery<PipelineResult>('pipeline', () => engine.getPipeline());
export const useAlerts = () => useEngineQuery<Alert[]>('alerts', () => engine.getAlerts());
export const useInbox = () => useEngineQuery<InboxThread[]>('inbox', () => engine.getInbox());
export function useOverrides(): Override[] {
  const version = useData((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => engine.getOverrides(), [version]);
}

/** Every mutating engine call goes through here so all screens refetch afterwards. */
export function useEngineActions() {
  const act = useAction(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const r = await fn();
    useData.getState().bump();
    return r;
  });
  const run = act.run as <T>(fn: () => Promise<T>) => Promise<T>;
  return {
    busy: act.loading,
    setTask: (id: string, taskId: string, status: TaskStatus, by: 'partner' | 'company') => run(() => engine.setTaskStatus(id, taskId, status, by)),
    extend: (id: string, reason: string) => run(() => engine.extendDeadline(id, reason)),
    release: (id: string, reason: string) => run(() => engine.releaseReservation(id, reason)),
    applyChanges: (changes: Change[], reason?: string) => run(() => engine.applyChanges(changes, 'form', reason)),
    undoLast: () => run(() => engine.undoLast()),
    removeOverrides: (ids: string[]) => run(() => engine.removeOverrides(ids)),
    resetOverrides: () => run(() => engine.resetOverrides()),
    sendBrand: (id: string, text: string) => run(() => engine.sendBrandMessage(id, text)),
    markRead: (id: string) => run(() => engine.markThreadRead(id)),
    applyDetected: (id: string, messageId: string) => run(() => engine.applyDetectedUpdate(id, messageId)),
  };
}

export const useSuggestReply = () => useAction((id: string) => engine.suggestReply(id));
export const useRunChecks = () => useAction((withGemini: boolean): Promise<CheckReport> => engine.runChecks(withGemini));
