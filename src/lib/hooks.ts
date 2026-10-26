import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUi } from '@/store/ui';
import { tokenColor } from './tokens';

/** Colour resolver that re-evaluates when the theme changes (for SVG/Leaflet attributes). */
export function useColors() {
  const theme = useUi((s) => s.theme);
  return useMemo(() => {
    void theme;
    return (token: string, alpha = 1) => tokenColor(token, alpha);
  }, [theme]);
}

export type DrawerTab = 'decision' | 'profile' | 'next' | 'onboarding' | 'timeline';

/** The applicant drawer lives in the URL (?app=APP-007&tab=decision) so it is shareable. */
export function useAppDrawer() {
  const [params, setParams] = useSearchParams();
  const appId = params.get('app');
  const tab = (params.get('tab') as DrawerTab | null) ?? 'decision';
  const openApp = useCallback(
    (id: string, t?: DrawerTab) => {
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.set('app', id);
        if (t) n.set('tab', t);
        else n.delete('tab');
        return n;
      });
    },
    [setParams],
  );
  const setTab = useCallback(
    (t: DrawerTab) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.set('tab', t);
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.delete('app');
        n.delete('tab');
        return n;
      }),
    [setParams],
  );
  return { appId, tab, openApp, setTab, close };
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
