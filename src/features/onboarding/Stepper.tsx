import { Check, TriangleAlert } from 'lucide-react';
import type { OnboardingPlan } from '@/engine/types';
import { cn } from '@/lib/cn';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { Tooltip } from '@/components/ui/overlay';

const SHORT: Record<string, string> = {
  Agreement: 'Agreement',
  'Space ready': 'Space',
  'Fit-out': 'Fit-out',
  Training: 'Training',
  'Stock & systems': 'Stock',
  'Soft launch': 'Soft launch',
  Open: 'Open',
};

/** Horizontal stepper: status dots + target dates. Overdue active step turns amber. */
export function OnboardingStepper({ plan, compact = false }: { plan: OnboardingPlan; compact?: boolean }) {
  const today = iso(DEMO_TODAY);
  return (
    <ol className="flex w-full items-start" aria-label="Onboarding stages">
      {plan.steps.map((s, i) => {
        const overdue = s.state === 'active' && s.targetDate < today;
        const risky = s.state === 'active' && (overdue || plan.atRisk);
        return (
          <li key={s.step} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute right-1/2 top-[9px] h-0.5 w-full -translate-x-[10px]', s.state === 'upcoming' ? 'bg-border' : 'bg-st-onboarding/70')}
              />
            )}
            <Tooltip content={`${s.step} · target ${fmtDate(s.targetDate)}${risky ? ` · ${plan.riskNote ?? 'overdue'}` : ''}`}>
              <span
                className={cn(
                  'relative z-[1] flex h-5 w-5 items-center justify-center rounded-full border-2 bg-surface',
                  s.state === 'done' && 'border-st-onboarding bg-st-onboarding text-white',
                  s.state === 'active' && !risky && 'border-st-onboarding ring-4 ring-st-onboarding/20',
                  risky && 'border-st-hold ring-4 ring-st-hold/20',
                  s.state === 'upcoming' && 'border-border',
                )}
                aria-label={`${s.step}: ${s.state}${risky ? ', at risk' : ''}`}
              >
                {s.state === 'done' ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : risky ? (
                  <TriangleAlert className="h-2.5 w-2.5 text-st-hold" />
                ) : s.state === 'active' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-st-onboarding" />
                ) : null}
              </span>
            </Tooltip>
            {!compact && (
              <>
                <span className={cn('mt-1.5 w-full truncate px-0.5 text-2xs font-medium', s.state === 'upcoming' ? 'text-subtle' : 'text-fg')}>{SHORT[s.step]}</span>
                <span className={cn('text-[10px] tnum', risky ? 'font-semibold text-st-hold' : 'text-subtle')}>{fmtDate(s.targetDate)}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Completion ring for a training module. */
export function Ring({ value, size = 28 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" role="img" aria-label={`${Math.round(value * 100)}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-raised" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        className={value >= 1 ? 'stroke-st-approved' : 'stroke-st-onboarding'}
      />
    </svg>
  );
}
