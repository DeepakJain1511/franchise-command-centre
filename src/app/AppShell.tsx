import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import {
  ChevronsLeft, ChevronsRight, Database, Hexagon, Keyboard, Menu, Moon, MoreVertical, RotateCcw, Search, Sun, Upload,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '@/components/CommandPalette';
import { FilterBar, FilterUrlSync } from '@/components/FilterBar';
import { Shortcuts, useShortcuts } from '@/components/Shortcuts';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/controls';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip,
} from '@/components/ui/overlay';
import { ApplicantDrawer } from '@/features/applicants/ApplicantDrawer';
import { ensureLoaded, loadDataset, resetDemo } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { NAV, NAV_FOOTER, type NavItem } from './nav';
import { AlertsBell, ChecksBadge, SourcePill, TimeSlider } from './ShellExtras';
import { useInbox } from '@/engine/hooks';

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/overview" className="flex items-center gap-2.5 rounded-md focus-ring">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand text-brand-fg shadow-soft">
        <Hexagon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Bunty Consulting</span>
          <span className="block text-2xs text-subtle">Franchise expansion</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((n) => (
        <li key={n.to}>
          <Tooltip content={collapsed ? n.label : null} side="right">
            <NavLink
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-ring',
                  isActive ? 'bg-surface text-fg shadow-soft ring-1 ring-border' : 'text-muted hover:bg-raised hover:text-fg',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand')} aria-hidden />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                  {n.to === '/inbox' && <UnreadBadge collapsed={collapsed} />}
                </>
              )}
            </NavLink>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

function UnreadBadge({ collapsed }: { collapsed: boolean }) {
  const inbox = useInbox();
  const n = (inbox.data ?? []).reduce((s, t) => s + t.unread, 0);
  if (!n) return null;
  return (
    <span className={cn('rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-brand-fg tnum', collapsed ? 'absolute ml-5 -mt-5' : 'ml-auto')} aria-label={`${n} unread`}>
      {n}
    </span>
  );
}

function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-bg px-3 py-4 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[68px]' : 'w-[232px]',
      )}
      aria-label="Main navigation"
    >
      <div className={cn('mb-6 px-1', collapsed && 'flex justify-center px-0')}>
        <Brand collapsed={collapsed} />
      </div>
      <nav className="flex-1">
        <NavList items={NAV} collapsed={collapsed} />
      </nav>
      <div className="space-y-2 border-t pt-3">
        <NavList items={NAV_FOOTER} collapsed={collapsed} />
        <Button variant="ghost" size="sm" onClick={toggle} className={cn('w-full justify-start', collapsed && 'justify-center')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          {!collapsed && 'Collapse'}
        </Button>
      </div>
    </aside>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-[70] w-64 border-r bg-bg p-4 shadow-pop data-[state=open]:animate-in data-[state=open]:slide-in-from-left">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Go to a screen</Dialog.Description>
          <div className="mb-6">
            <Brand />
          </div>
          <NavList items={[...NAV, ...NAV_FOOTER]} collapsed={false} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TopBar() {
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const setPalette = useUi((s) => s.setPaletteOpen);
  const toast = useUi((s) => s.toast);
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-bg/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-bg/70 md:px-6">
      <MobileNav />
      <button
        type="button"
        onClick={() => setPalette(true)}
        className="flex h-9 w-full min-w-0 max-w-sm items-center gap-2 rounded-md border bg-surface px-3 text-sm text-subtle shadow-soft transition-colors hover:text-muted focus-ring"
        aria-label="Search applicants, territories, screens"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 truncate text-left">Search APP-, TER-, screens…</span>
        <Kbd className="hidden sm:inline-flex">{isMac ? '⌘' : 'Ctrl'} K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <TimeSlider />
        <ChecksBadge />
        <SourcePill />
        <AlertsBell />
        <Tooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Demo menu">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onSelect={async () => {
                await resetDemo();
                toast('Demo data reset', 'success');
              }}
            >
              <RotateCcw /> Reset demo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await loadDataset('sample');
                toast('Sample dataset loaded', 'success');
              }}
            >
              <Database /> Load sample dataset
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useShortcuts.getState().setOpen(true)}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/')}>
              <Upload /> Upload new Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const loaded = useData((s) => s.loaded);
  const density = useUi((s) => s.density);
  const current = [...NAV, ...NAV_FOOTER].find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  const showFilters = current?.filters ?? false;

  const reduced = useReducedMotion();

  // Cursor spotlight: cards glow softly where the pointer is (CSS reads --mx / --my).
  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.card') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, [reduced]);

  // Deep links work without visiting the start screen: quietly load the sample set.
  useEffect(() => {
    if (!loaded) void ensureLoaded();
  }, [loaded]);

  useEffect(() => {
    document.title = current ? `${current.label} · Bunty Consulting` : 'Bunty Consulting';
  }, [current]);

  return (
    <div className="flex min-h-screen" data-density={density}>
      <a href="#main" className="sr-only z-[200] rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {showFilters && <FilterBar />}
        <main id="main" className="min-w-0 flex-1">
          <motion.div
            key={pathname}
            initial={reduced ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <FilterUrlSync />
      <ApplicantDrawer />
      <CommandPalette />
      <Shortcuts />
      <Toaster />
    </div>
  );
}

/** Page header: title, the screen's one question, optional breadcrumbs and actions. */
export function PageHeader({
  title, question, crumbs, actions,
}: {
  title: ReactNode;
  question?: string;
  crumbs?: Array<{ label: string; to?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-5 md:px-6">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-subtle">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                {c.to ? (
                  <Link to={c.to} className="hover:text-fg focus-ring">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-muted">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {question && <p className="mt-0.5 text-sm text-muted">{question}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
