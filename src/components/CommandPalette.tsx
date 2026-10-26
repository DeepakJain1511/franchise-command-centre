import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { FileUser, Map as MapIcon, Moon, RotateCcw, Search, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV } from '@/app/nav';
import { useApplicants, useDataset } from '@/engine/hooks';
import { useAppDrawer } from '@/lib/hooks';
import { STATUS_META } from '@/lib/tokens';
import { useFilters } from '@/store/filters';
import { useUi } from '@/store/ui';
import { Kbd } from './ui/controls';

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg aria-selected:bg-raised [&_svg]:size-4 [&_svg]:text-muted';
const group = '[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5';

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const resetFilters = useFilters((s) => s.reset);
  const navigate = useNavigate();
  const { openApp } = useAppDrawer();
  const apps = useApplicants();
  const ds = useDataset();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-[85] w-[min(94vw,600px)] -translate-x-1/2 overflow-hidden rounded-lg border bg-surface shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Jump to an applicant, territory or screen</Dialog.Description>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-2 border-b px-3.5">
              <Search className="h-4 w-4 text-subtle" aria-hidden />
              <Command.Input autoFocus placeholder="Jump to APP-007, TER-02, Map…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5 scrollbar-thin">
              <Command.Empty className="py-8 text-center text-sm text-muted">No matches</Command.Empty>
              <Command.Group heading="Screens" className={group}>
                {NAV.map((n) => (
                  <Command.Item key={n.to} value={`screen ${n.label}`} className={item} onSelect={() => run(() => navigate(n.to))}>
                    <n.icon /> {n.label}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Applicants" className={group}>
                {(apps.data ?? []).map(({ app, decision }) => {
                  const S = STATUS_META[decision.status];
                  return (
                    <Command.Item key={app.id} value={`${app.id} ${app.name} ${app.city} ${app.pin}`} className={item} onSelect={() => run(() => openApp(app.id))}>
                      <FileUser />
                      <span className="w-16 text-xs text-muted tnum">{app.id}</span>
                      <span className="flex-1 truncate">{app.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <span className={`h-1.5 w-1.5 rounded-full ${S.dot}`} />
                        {decision.status}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group heading="Territories" className={group}>
                {(ds.data?.territories ?? []).map((t) => (
                  <Command.Item key={t.id} value={`${t.id} ${t.name} ${t.city}`} className={item} onSelect={() => run(() => navigate(`/territories/${t.id}`))}>
                    <MapIcon />
                    <span className="w-16 text-xs text-muted tnum">{t.id}</span>
                    {t.name}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Actions" className={group}>
                <Command.Item value="toggle theme dark light" className={item} onSelect={() => run(toggleTheme)}>
                  {theme === 'dark' ? <Sun /> : <Moon />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </Command.Item>
                <Command.Item value="reset filters" className={item} onSelect={() => run(resetFilters)}>
                  <RotateCcw /> Reset filters
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
