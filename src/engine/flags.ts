/** Step 2 — data-quality flags (Build Spec §6). */
import {
  CITY_INFO, HOLD_INFO_DAYS, HOLD_SPACE_DAYS, MONTH_NAMES, NOTES_HAS_SPACE_KEYWORDS, NOTES_NO_SPACE_KEYWORDS, OCCASION_DATES, SPACE_SIZE,
  type TierNum,
} from '@/config';
import type { Flag, FlagCode } from './model';
import type { Application, City } from './types';

export const tierOf = (city: City): TierNum => CITY_INFO[city].tier;

export const cityOfPin = (pin: string): City | null => {
  const hit = (Object.keys(CITY_INFO) as City[]).find((c) => pin.startsWith(CITY_INFO[c].prefix));
  return hit ?? null;
};

export const isValidPin = (pin: string) => /^\d{6}$/.test(pin);
export const hasSpace = (a: Application) => a.space === 'Owned' || a.space === 'Rented';

const FLAG_META: Record<FlagCode, Omit<Flag, 'code' | 'params'>> = {
  F_PIN_CITY_MISMATCH: { blocking: true, holdDays: HOLD_INFO_DAYS, excludes: null },
  F_INVEST_MISSING: { blocking: true, holdDays: HOLD_INFO_DAYS, excludes: 'money' },
  F_SIZE_MISSING: { blocking: true, holdDays: HOLD_INFO_DAYS, excludes: 'space' },
  F_FLOOR_UNKNOWN: { blocking: true, holdDays: HOLD_INFO_DAYS, excludes: 'space' },
  F_NO_SPACE: { blocking: true, holdDays: HOLD_SPACE_DAYS, excludes: 'space' },
  F_SPACE_TOO_SMALL: { blocking: true, holdDays: HOLD_SPACE_DAYS, excludes: 'space' },
  F_SPACE_CONTRADICTION: { blocking: false, holdDays: null, excludes: null },
  F_EXP_MISSING: { blocking: false, holdDays: null, excludes: null },
  F_LAUNCH_MISSING: { blocking: false, holdDays: null, excludes: null },
  F_NOTES_CONTRADICTION: { blocking: false, holdDays: null, excludes: null },
  F_NOTES_DATE: { blocking: false, holdDays: null, excludes: null },
  F_BACKGROUND_UNCLEAR: { blocking: false, holdDays: null, excludes: null },
};

export const makeFlag = (code: FlagCode, params: Flag['params'] = {}): Flag => ({ code, ...FLAG_META[code], params });

const containsPhrase = (text: string, phrase: string) =>
  new RegExp(`(^|[^\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu').test(text);

/** A date or occasion mentioned in the notes, resolved to its next occurrence after the decision date. */
export function detectNotesDate(notes: string, decisionDate: string): { label: string; phrase: string; date: string } | null {
  const text = notes.toLowerCase();
  if (!text.trim()) return null;
  for (const o of OCCASION_DATES) {
    const key = o.keys.find((k) => containsPhrase(text, k));
    if (key) return { label: o.label, phrase: key, date: o.date };
  }
  const year = Number(decisionDate.slice(0, 4));
  const decMonth = Number(decisionDate.slice(5, 7));
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const m = MONTH_NAMES[i];
    const short = m.slice(0, 3);
    // "may" is also an ordinary word: only count it after before/by/in/till.
    const before = new RegExp(`\\b(before|by|till|until)\\s+(${m}|${short})\\b`, 'i').exec(text);
    const bare = m === 'may' ? new RegExp(`\\b(in|end of)\\s+may\\b`, 'i').exec(text) : new RegExp(`\\b${m}\\b`, 'i').exec(text);
    if (!before && !bare) continue;
    const monthNum = i + 1;
    const y = monthNum > decMonth ? year : year + 1;
    const mm = String(monthNum).padStart(2, '0');
    if (before) return { label: `before ${cap(m)}`, phrase: before[0], date: `${y}-${mm}-01` };
    const last = new Date(y, monthNum, 0).getDate();
    return { label: cap(m), phrase: bare![0], date: `${y}-${mm}-${String(last).padStart(2, '0')}` };
  }
  return null;
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * All flags for one application except F_BACKGROUND_UNCLEAR (added by scoring, which owns the keyword scan).
 * `locationConfirmed` comes from a follow-up and clears the pin/city mismatch.
 */
export function computeFlags(a: Application, decisionDate: string, opts: { locationConfirmed?: boolean } = {}): Flag[] {
  const flags: Flag[] = [];
  const tier = tierOf(a.city);
  const size = SPACE_SIZE[tier];

  const prefixOk = isValidPin(a.pin) && a.pin.startsWith(CITY_INFO[a.city].prefix);
  if (!prefixOk && !opts.locationConfirmed) flags.push(makeFlag('F_PIN_CITY_MISMATCH', { pin: a.pin || '—', city: a.cityRaw ?? a.city }));

  if (a.investmentLakh === null || Number.isNaN(a.investmentLakh)) flags.push(makeFlag('F_INVEST_MISSING'));

  if (hasSpace(a)) {
    if (a.spaceSqft === null || a.spaceSqft === 0) flags.push(makeFlag('F_SIZE_MISSING'));
    else if (a.spaceSqft < size.min)
      flags.push(makeFlag('F_SPACE_TOO_SMALL', { size: a.spaceSqft, min: size.min, idealMin: size.idealMin, idealMax: size.idealMax, city: a.city }));
    if (a.floor === 'Not known') flags.push(makeFlag('F_FLOOR_UNKNOWN'));
  } else {
    flags.push(makeFlag('F_NO_SPACE', { min: size.min, idealMin: size.idealMin, idealMax: size.idealMax, city: a.city }));
    if ((a.spaceSqft !== null && a.spaceSqft > 0) || a.floor !== 'Not known') {
      flags.push(makeFlag('F_SPACE_CONTRADICTION', { size: a.spaceSqft ?? '—', floor: a.floor }));
    }
  }

  if (a.experienceYears === null) flags.push(makeFlag('F_EXP_MISSING'));
  if (a.launchMonths === null) flags.push(makeFlag('F_LAUNCH_MISSING'));

  const notes = a.notes ?? '';
  const saysHasSpace = !hasSpace(a) && NOTES_HAS_SPACE_KEYWORDS.find((k) => containsPhrase(notes, k));
  const saysNoSpace = hasSpace(a) && NOTES_NO_SPACE_KEYWORDS.find((k) => containsPhrase(notes, k));
  if (saysHasSpace || saysNoSpace) flags.push(makeFlag('F_NOTES_CONTRADICTION', { phrase: (saysHasSpace || saysNoSpace) as string, space: a.space }));

  const date = detectNotesDate(notes, decisionDate);
  if (date) flags.push(makeFlag('F_NOTES_DATE', { phrase: date.phrase, label: date.label, date: date.date }));

  return flags;
}

/** Hold type when several blocking flags exist: any 30-day flag → 30 days, else 7. */
export function holdDaysOf(flags: Flag[]): number | null {
  const b = flags.filter((f) => f.blocking);
  if (!b.length) return null;
  return Math.max(...b.map((f) => f.holdDays ?? 0));
}
