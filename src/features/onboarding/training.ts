import type { OnboardingPlan } from '@/engine/types';

export type ModuleProgress = OnboardingPlan['training'][number];

/** Training modules for a partner, as reported by the engine. */
export function trainingFor(plan: OnboardingPlan | null): ModuleProgress[] {
  return plan?.training ?? [];
}
