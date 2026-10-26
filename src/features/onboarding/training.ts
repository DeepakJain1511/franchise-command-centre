import { TRAINING_MODULES } from '@/data/mock/decisions';
import { ONBOARDING_STEPS, type OnboardingPlan } from '@/engine/types';

export interface ModuleProgress {
  id: string;
  title: string;
  week: number;
  hours: number;
  progress: number; // 0..1
}

/**
 * Training progress for a partner (fixture-driven presentation).
 * PHASE-2: real logic goes here — read completion from the LMS.
 */
export function trainingFor(plan: OnboardingPlan | null): ModuleProgress[] {
  if (!plan) return [];
  const idx = ONBOARDING_STEPS.indexOf(plan.current);
  const trainingIdx = ONBOARDING_STEPS.indexOf('Training');
  return TRAINING_MODULES.map((m, i) => {
    let progress = 0;
    if (idx > trainingIdx) progress = 1;
    else if (idx === trainingIdx) progress = i < 2 ? 1 : i < 4 ? 0.5 : 0;
    return { ...m, progress };
  });
}
