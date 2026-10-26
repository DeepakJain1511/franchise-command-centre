import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/** Fixed "today" so the demo is deterministic regardless of when it is opened. */
export const DEMO_TODAY = new Date('2026-10-26T09:00:00');

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');
export const plusDays = (isoDate: string, n: number) => iso(addDays(parseISO(isoDate), n));
export const fromToday = (n: number) => iso(addDays(DEMO_TODAY, n));
export const daysAgo = (isoDate: string) => differenceInCalendarDays(DEMO_TODAY, parseISO(isoDate));

/** "12 Nov" */
export const fmtDate = (isoDate: string) => format(parseISO(isoDate), 'd MMM');
/** "12 Nov 2026" */
export const fmtDateLong = (isoDate: string) => format(parseISO(isoDate), 'd MMM yyyy');
