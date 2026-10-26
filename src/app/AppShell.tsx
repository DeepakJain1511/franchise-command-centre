import * as Dialog from '@radix-ui/react-dialog';
import {
  ChevronsLeft, ChevronsRight, Database, Hexagon, Menu, Moon, MoreVertical, RotateCcw, Search, Sun, Upload,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '@/components/CommandPalette';
import { FilterBar, FilterUrlSync } from '@/components/FilterBar';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/controls';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip,
} from '@/components/ui/overlay';
import { ApplicantDrawer } from '@/features/applicants/ApplicantDrawer';
import { loadDataset, resetDemo } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { NAV, NAV_FOOTER, type NavItem } from './nav';

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
                  'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-ring',
                  isActive ? 'bg-surface text-fg shadow-soft ring-1 ring-border' : 'text-muted hover:bg-raised hover:text-fg',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand')} aria-hidden />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </>
              )}
            </NavLink>
          </Tooltip>
        </li>
      ))}
    </ul>
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
  const source = useData((s) => s.source);
  const fileName = useData((s) => s.fileName);
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-bg/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-bg/70 md:px-6">
      <MobileNav />
      <button
        type="button"
        onClick={() => setPalette(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-surface px-3 text-sm text-subtle shadow-soft transition-colors hover:text-muted focus-ring"
        aria-label="Search applicants, territories, screens"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 truncate text-left">Search APP-, TER-, screens…</span>
        <Kbd className="hidden sm:inline-flex">{isMac ? '⌘' : 'Ctrl'} K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip content={source === 'upload' ? `Uploaded ${fileName ?? 'file'} · decisions are mocked in Phase 1` : 'Sample data · decisions are mocked in Phase 1'}>
          <span className="hidden h-7 items-center gap-1.5 rounded-full border border-dashed border-brand/40 bg-brand-soft px-2.5 text-2xs font-medium text-brand sm:inline-flex">
            <Database className="h-3 w-3" aria-hidden /> Demo data
          </span>
        </Tooltip>
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

  // Deep links work without visiting the start screen: quietly load the sample set.
  useEffect(() => {
    if (!loaded) void loadDataset('sample');
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
          <Outlet />
        </main>
      </div>
      <FilterUrlSync />
      <ApplicantDrawer />
      <CommandPalette />
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
