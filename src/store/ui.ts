import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export interface Toast {
  id: number;
  title: string;
  tone?: 'default' | 'success' | 'warning';
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable — fine for a demo */
  }
};

const initialTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

interface UiStore {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  toasts: Toast[];
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setDensity: (d: Density) => void;
  toggleSidebar: () => void;
  setPaletteOpen: (o: boolean) => void;
  toast: (title: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

export const useUi = create<UiStore>((set, get) => ({
  theme: initialTheme(),
  density: (read('fcc-density') as Density) || 'comfortable',
  sidebarCollapsed: read('fcc-sidebar') === '1',
  paletteOpen: false,
  toasts: [],
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    write('fcc-theme', theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setDensity: (density) => {
    write('fcc-density', density);
    set({ density });
  },
  toggleSidebar: () =>
    set((s) => {
      write('fcc-sidebar', s.sidebarCollapsed ? '0' : '1');
      return { sidebarCollapsed: !s.sidebarCollapsed };
    }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toast: (title, tone = 'default') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, title, tone }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
