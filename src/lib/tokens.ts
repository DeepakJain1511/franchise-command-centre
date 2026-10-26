import {
  AlertTriangle, Ban, CheckCircle2, Clock, CircleHelp, Hourglass, Lock, MapPin, Rocket, Store, Users, XCircle, CircleDot, MinusCircle,
  type LucideIcon,
} from 'lucide-react';
import type { DecisionStatus, Language, PinStatus, Priority, Stage } from '@/engine/types';

/** Semantic colour + icon for every decision status. Colour is never the only signal. */
export const STATUS_META: Record<DecisionStatus, { token: string; icon: LucideIcon; cls: string; dot: string; short: string }> = {
  Approved: { token: 'st-approved', icon: CheckCircle2, cls: 'text-st-approved bg-st-approved/10 border-st-approved/25', dot: 'bg-st-approved', short: 'Approved' },
  'On hold': { token: 'st-hold', icon: Clock, cls: 'text-st-hold bg-st-hold/10 border-st-hold/25', dot: 'bg-st-hold', short: 'On hold' },
  Waitlisted: { token: 'st-waitlisted', icon: Hourglass, cls: 'text-st-waitlisted bg-st-waitlisted/10 border-st-waitlisted/25', dot: 'bg-st-waitlisted', short: 'Waitlist' },
  Rejected: { token: 'st-rejected', icon: XCircle, cls: 'text-st-rejected bg-st-rejected/10 border-st-rejected/25', dot: 'bg-st-rejected', short: 'Rejected' },
  'Needs info': { token: 'st-needs', icon: CircleHelp, cls: 'text-st-needs bg-st-needs/10 border-st-needs/25', dot: 'bg-st-needs', short: 'Needs info' },
};

export const STAGE_META: Record<Stage, { token: string; icon: LucideIcon; cls: string; dot: string }> = {
  Applied: { token: 'subtle', icon: CircleDot, cls: 'text-muted bg-raised border-border', dot: 'bg-subtle' },
  Screened: { token: 'st-waitlisted', icon: Users, cls: 'text-st-waitlisted bg-st-waitlisted/10 border-st-waitlisted/25', dot: 'bg-st-waitlisted' },
  Approved: { token: 'st-approved', icon: CheckCircle2, cls: 'text-st-approved bg-st-approved/10 border-st-approved/25', dot: 'bg-st-approved' },
  'On hold': { token: 'st-hold', icon: Clock, cls: 'text-st-hold bg-st-hold/10 border-st-hold/25', dot: 'bg-st-hold' },
  'In onboarding': { token: 'st-onboarding', icon: Rocket, cls: 'text-st-onboarding bg-st-onboarding/10 border-st-onboarding/25', dot: 'bg-st-onboarding' },
  Open: { token: 'st-open', icon: Store, cls: 'text-st-open bg-st-open/10 border-st-open/25', dot: 'bg-st-open' },
};

export const PRIORITY_META: Record<Priority, { token: string; bars: number; cls: string }> = {
  High: { token: 'pr-high', bars: 3, cls: 'text-pr-high bg-pr-high/10 border-pr-high/25' },
  Medium: { token: 'pr-medium', bars: 2, cls: 'text-pr-medium bg-pr-medium/10 border-pr-medium/25' },
  Low: { token: 'pr-low', bars: 1, cls: 'text-muted bg-pr-low/15 border-pr-low/40' },
};

export const PIN_META: Record<PinStatus, { token: string; label: string; icon: LucideIcon; cls: string }> = {
  open: { token: 'pin-open', label: 'Open slot', icon: MapPin, cls: 'text-pin-open bg-pin-open/10 border-pin-open/30' },
  interest: { token: 'pin-interest', label: 'Applicant interest', icon: Users, cls: 'text-pin-interest bg-pin-interest/10 border-pin-interest/30' },
  allocated: { token: 'pin-allocated', label: 'Planned store', icon: Lock, cls: 'text-pin-allocated bg-pin-allocated/10 border-pin-allocated/30' },
  store: { token: 'pin-store', label: 'Existing store', icon: Store, cls: 'text-pin-store bg-pin-store/10 border-pin-store/30' },
  conflict: { token: 'pin-conflict', label: 'Conflict', icon: AlertTriangle, cls: 'text-pin-conflict bg-pin-conflict/10 border-pin-conflict/30' },
  full: { token: 'pin-open', label: 'No slot left', icon: MinusCircle, cls: 'text-muted bg-raised border-border' },
  outside: { token: 'pin-outside', label: 'Outside territory', icon: Ban, cls: 'text-subtle bg-raised border-border' },
};

export const LANGUAGE_META: Record<Language, { native: string; code: string }> = {
  Kannada: { native: 'ಕನ್ನಡ', code: 'KN' },
  English: { native: 'English', code: 'EN' },
  Hindi: { native: 'हिन्दी', code: 'HI' },
};

/** Resolve a token like 'st-approved' to a concrete colour string (for SVG attributes / Leaflet). */
export function tokenColor(token: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  if (!raw) return '#888';
  return alpha === 1 ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}
