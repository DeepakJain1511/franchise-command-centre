import { create } from 'zustand';
import type { City, DecisionStatus, Language, Priority, Stage } from '@/engine/types';

export type TimeWindow = '7d' | '30d' | '90d' | 'all';

export interface Filters {
  city: City[];
  territory: string[];
  status: DecisionStatus[];
  stage: Stage[];
  priority: Priority[];
  language: Language[];
  pin: string[];
  window: TimeWindow;
}
export type ListKey = Exclude<keyof Filters, 'window'>;
export const LIST_KEYS: ListKey[] = ['city', 'territory', 'status', 'stage', 'priority', 'language', 'pin'];

export const EMPTY_FILTERS: Filters = {
  city: [], territory: [], status: [], stage: [], priority: [], language: [], pin: [], window: 'all',
};

interface FilterStore extends Filters {
  toggle: <K extends ListKey>(key: K, value: Filters[K][number]) => void;
  /** Replace a key's values (single-select semantics used by chart clicks). */
  only: <K extends ListKey>(key: K, value: Filters[K][number]) => void;
  setList: <K extends ListKey>(key: K, values: Filters[K]) => void;
  setWindow: (w: TimeWindow) => void;
  replaceAll: (f: Filters) => void;
  reset: () => void;
}

export const useFilters = create<FilterStore>((set) => ({
  ...EMPTY_FILTERS,
  toggle: (key, value) =>
    set((s) => {
      const list = s[key] as string[];
      const v = value as string;
      return { [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } as Partial<FilterStore>;
    }),
  only: (key, value) =>
    set((s) => {
      const list = s[key] as string[];
      const v = value as string;
      return { [key]: list.length === 1 && list[0] === v ? [] : [v] } as Partial<FilterStore>;
    }),
  setList: (key, values) => set({ [key]: values } as Partial<FilterStore>),
  setWindow: (window) => set({ window }),
  replaceAll: (f) => set({ ...f }),
  reset: () => set({ ...EMPTY_FILTERS }),
}));

export const activeFilterCount = (f: Filters) =>
  LIST_KEYS.reduce((n, k) => n + f[k].length, 0) + (f.window === 'all' ? 0 : 1);

/* URL <-> filters */
export function filtersToParams(f: Filters, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  LIST_KEYS.forEach((k) => {
    if (f[k].length) p.set(k, f[k].join(','));
    else p.delete(k);
  });
  if (f.window !== 'all') p.set('window', f.window);
  else p.delete('window');
  return p;
}

export function paramsToFilters(p: URLSearchParams): Filters {
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(',').filter(Boolean) : []);
  const w = p.get('window');
  return {
    city: list('city') as City[],
    territory: list('territory'),
    status: list('status') as DecisionStatus[],
    stage: list('stage') as Stage[],
    priority: list('priority') as Priority[],
    language: list('language') as Language[],
    pin: list('pin'),
    window: w === '7d' || w === '30d' || w === '90d' ? w : 'all',
  };
}
