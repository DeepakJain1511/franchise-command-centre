/**
 * The active DecisionEngine — the rule engine from the Build Spec (runPipeline), wrapped with per-browser state.
 */
import { setDemoDay } from '@/lib/time';
import { useData } from '@/store/data';
import { realEngine } from './realEngine';
import type { DecisionEngine } from './types';

export const engine: DecisionEngine & Pick<typeof realEngine, 'inspectFile' | 'sessionInfo'> = realEngine;
setDemoDay(realEngine.getDay());

// A partner tab and a company tab in the same browser stay in sync (state is per-browser localStorage).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'fcc:state:v1') return;
    realEngine.restore();
    setDemoDay(realEngine.getDay());
    useData.getState().bump();
  });
}

export * from './types';
