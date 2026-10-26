import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useUi } from '@/store/ui';
import { Button } from './ui/button';
import { Kbd } from './ui/controls';

export const GO_TO: Array<{ key: string; to: string; label: string }> = [
  { key: 'o', to: '/overview', label: 'Overview' },
  { key: 'm', to: '/map', label: 'Territory map' },
  { key: 'a', to: '/applicants', label: 'Applicants' },
  { key: 'p', to: '/pipeline', label: 'Pipeline' },
  { key: 't', to: '/territories', label: 'Territories' },
  { key: 'n', to: '/onboarding', label: 'Onboarding' },
  { key: 'w', to: '/ask', label: 'Ask & What-if' },
  { key: 's', to: '/settings', label: 'Settings' },
  { key: 'u', to: '/', label: 'Upload data' },
];

export const useShortcuts = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

/** Linear-style keyboard navigation: "G" then a letter, "?" for the cheat-sheet, "/" for search. */
export function Shortcuts() {
  const navigate = useNavigate();
  const open = useShortcuts((s) => s.open);
  const setOpen = useShortcuts((s) => s.setOpen);
  const setPalette = useUi((s) => s.setPaletteOpen);
  const pendingG = useRef<number | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || useUi.getState().paletteOpen) return;
      const k = e.key.toLowerCase();
      if (pendingG.current) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        setHint(false);
        const dest = GO_TO.find((g) => g.key === k);
        if (dest) {
          e.preventDefault();
          navigate(dest.to);
        }
        return;
      }
      if (k === 'g') {
        setHint(true);
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
          setHint(false);
        }, 1200);
      } else if (e.key === '?') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setOpen, setPalette]);

  return (
    <>
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-xs text-muted shadow-pop"
          >
            <Kbd>G</Kbd> then <Kbd>O</Kbd> <Kbd>M</Kbd> <Kbd>A</Kbd> <Kbd>P</Kbd> <Kbd>T</Kbd> <Kbd>N</Kbd> <Kbd>W</Kbd>
          </motion.div>
        )}
      </AnimatePresence>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/25 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-[14vh] z-[85] w-[min(92vw,440px)] -translate-x-1/2 rounded-lg border bg-surface p-5 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-brand" />
              <Dialog.Title className="text-sm font-semibold">Keyboard shortcuts</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="iconSm" className="ml-auto" aria-label="Close">
                  <X />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Keyboard shortcuts for moving around the app</Dialog.Description>
            <ul className="space-y-1.5 text-sm">
              {GO_TO.map((g) => (
                <li key={g.key} className="flex items-center justify-between">
                  <span className="text-muted">{g.label}</span>
                  <span className="flex gap-1">
                    <Kbd>G</Kbd>
                    <Kbd>{g.key.toUpperCase()}</Kbd>
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t pt-2">
                <span className="text-muted">Search anything</span>
                <span className="flex gap-1">
                  <Kbd>/</Kbd> or <Kbd>Ctrl K</Kbd>
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted">This list</span>
                <Kbd>?</Kbd>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted">Close a panel</span>
                <Kbd>Esc</Kbd>
              </li>
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
