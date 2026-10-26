import { Database, FlaskConical, Moon, RotateCcw, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/app/AppShell';
import { LanguageBadge } from '@/components/chips';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { loadDataset, resetDemo } from '@/lib/actions';
import { useUi, type Density, type Theme } from '@/store/ui';

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const toast = useUi((s) => s.toast);

  return (
    <div className="pb-10">
      <PageHeader title="Settings" question="Demo controls" />
      <div className="max-w-2xl space-y-4 px-4 md:px-6">
        <section className="card divide-y" aria-label="Appearance">
          <h2 className="label px-4 pb-1 pt-3.5">Appearance</h2>
          <Row title="Theme">
            <Segmented<Theme>
              ariaLabel="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light', icon: <Sun /> },
                { value: 'dark', label: 'Dark', icon: <Moon /> },
              ]}
            />
          </Row>
          <Row title="Density">
            <Segmented<Density>
              ariaLabel="Density"
              value={density}
              onChange={setDensity}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </Row>
          <Row title="Training language labels" hint="Only training badges use native script; the app stays English.">
            <LanguageBadge language="English" size="sm" />
            <LanguageBadge language="Kannada" size="sm" />
            <LanguageBadge language="Hindi" size="sm" />
          </Row>
        </section>

        <section className="card divide-y" aria-label="Data">
          <h2 className="label px-4 pb-1 pt-3.5">Data</h2>
          <Row title="Reset demo data" hint="Undo applied what-ifs, filters and history.">
            <Button
              size="sm"
              onClick={async () => {
                await resetDemo();
                toast('Demo data reset', 'success');
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </Row>
          <Row title="Load sample dataset" hint="40 applications · 8 territories · 10 stores.">
            <Button
              size="sm"
              onClick={async () => {
                await loadDataset('sample');
                toast('Sample dataset loaded', 'success');
              }}
            >
              <Database /> Load
            </Button>
          </Row>
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p>Decisions are mocked in Phase 1 — every outcome comes from fixtures via the swappable DecisionEngine.</p>
        </div>
      </div>
    </div>
  );
}
