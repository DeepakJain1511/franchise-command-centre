import type L from 'leaflet';
import { ArrowRight, BoxSelect, Crosshair, ExternalLink, Layers as LayersIcon, Lock, Map as MapIcon, Sparkles, Table2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, DecisionBadge, PinChip, PriorityChip, TierChip } from '@/components/chips';
import { Gauge, Stat } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Segmented, Slider, Switch } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { CITIES, PIN_STATES } from '@/engine/types';
import { cn } from '@/lib/cn';
import { inrLakh } from '@/lib/format';
import { useAppDrawer, useColors } from '@/lib/hooks';
import { PIN_META } from '@/lib/tokens';
import { useFilters } from '@/store/filters';
import { nearestStore, useMapUi, type Layers, type MapModel } from './model';

const LAYER_LABEL: Record<keyof Layers, string> = {
  stores: 'Existing stores',
  planned: 'Planned stores',
  interest: 'Applicant interest',
  outlines: 'Territory outlines',
  rings: 'Catchment rings',
  labels: 'PIN labels',
};

/* ---------------- Legend (always visible) ---------------- */
export function Legend({ className }: { className?: string }) {
  const c = useColors();
  return (
    <ul className={cn('grid grid-cols-2 gap-x-3 gap-y-1.5', className)} aria-label="PIN legend">
      {PIN_STATES.map((s) => {
        const m = PIN_META[s];
        return (
          <li key={s} className="flex items-center gap-1.5 text-2xs text-muted">
            <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden>
              <path d="M6 0.5 11.2 3.5v6L6 12.5 0.8 9.5v-6z" fill={s === 'full' ? c('subtle', 0.3) : c(m.token, s === 'outside' ? 0.6 : 0.75)} />
            </svg>
            <m.icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{m.label}</span>
          </li>
        );
      })}
      <li className="flex items-center gap-1.5 text-2xs text-muted">
        <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden>
          <path d="M6 0.5 11.2 3.5v6L6 12.5 0.8 9.5v-6z" fill="url(#fcc-hatch)" stroke={c('pin-conflict')} strokeWidth="0.6" />
        </svg>
        <span className="truncate">Cannibalisation risk</span>
      </li>
    </ul>
  );
}

/* ---------------- Left panel ---------------- */
export function LayerPanel({ model, onFit }: { model: MapModel; onFit: (what: 'state' | 'city') => void }) {
  const ui = useMapUi();
  const f = useFilters();
  const cityFocus = f.city[0] ?? (f.territory[0] ? model.territories.find((t) => t.id === f.territory[0])?.city : undefined);
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-surface p-4 scrollbar-thin" aria-label="Map layers and filters">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Territory map</h1>
        <p className="text-xs text-muted">Where are we, where are we growing?</p>
      </div>
      <Segmented
        ariaLabel="View"
        value={ui.view}
        onChange={ui.setView}
        className="w-full [&>*]:flex-1 [&>*]:justify-center"
        options={[
          { value: 'map', label: 'Map', icon: <MapIcon /> },
          { value: 'table', label: 'Table', icon: <Table2 /> },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => onFit('state')} disabled={ui.view !== 'map'}>
          <Crosshair /> Karnataka
        </Button>
        <Tooltip content={cityFocus ? `Fit to ${cityFocus}` : 'Pick a city first'}>
          <span>
            <Button size="sm" className="w-full" onClick={() => onFit('city')} disabled={!cityFocus || ui.view !== 'map'}>
              <Crosshair /> City
            </Button>
          </span>
        </Tooltip>
      </div>
      <Button
        size="sm"
        variant={ui.selecting ? 'primary' : 'secondary'}
        onClick={() => {
          ui.setSelecting(!ui.selecting);
          if (ui.selecting) ui.setArea([]);
        }}
        disabled={ui.view !== 'map'}
        aria-pressed={ui.selecting}
      >
        <BoxSelect /> {ui.selecting ? 'Drag on map to select' : 'Select an area'}
      </Button>

      <section>
        <h2 className="label mb-2">City</h2>
        <div className="flex flex-wrap gap-1">
          {CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => f.only('city', city)}
              aria-pressed={f.city.includes(city)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors focus-ring',
                f.city.includes(city) ? 'border-brand bg-brand-soft text-fg' : 'text-muted hover:bg-raised hover:text-fg',
              )}
            >
              {city.replace('Hubballi-Dharwad', 'Hubballi')}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="label mb-2">Priority</h2>
        <div className="flex flex-wrap gap-1">
          {(['High', 'Medium', 'Low'] as const).map((p) => (
            <PriorityChip key={p} priority={p} size="sm" active={f.priority.includes(p)} onClick={() => f.toggle('priority', p)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="label mb-2 flex items-center gap-1.5">
          <LayersIcon className="h-3 w-3" /> Layers
        </h2>
        <ul className="space-y-2">
          {(Object.keys(LAYER_LABEL) as Array<keyof Layers>).map((k) => (
            <li key={k}>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                {LAYER_LABEL[k]}
                <Switch checked={ui.layers[k]} onCheckedChange={(v) => ui.setLayer(k, v)} aria-label={LAYER_LABEL[k]} />
              </label>
              {k === 'rings' && ui.layers.rings && (
                <div className="mt-2 rounded-md bg-raised/60 px-2.5 py-2">
                  <div className="flex justify-between text-2xs text-muted">
                    <span>Catchment radius</span>
                    <span className="font-semibold text-fg tnum">{ui.ringKm} km</span>
                  </div>
                  <Slider min={1} max={8} step={0.5} value={[ui.ringKm]} onValueChange={([v]) => ui.setRingKm(v)} thumbLabel="Catchment radius in km" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-auto border-t pt-3">
        <h2 className="label mb-2">Legend</h2>
        <Legend />
        <p className="mt-2 text-[10px] leading-snug text-subtle">PIN tiles are demo-approximate, not surveyed boundaries.</p>
      </section>
    </aside>
  );
}

/* ---------------- Right detail panel ---------------- */
export function DetailPanel({ model }: { model: MapModel }) {
  const f = useFilters();
  const pin = f.pin.length === 1 ? f.pin[0] : null;
  const territory = f.territory.length === 1 ? f.territory[0] : null;
  if (!pin && !territory) return null;
  return (
    <aside className="absolute bottom-24 right-3 top-3 z-[500] flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-surface shadow-pop" aria-label="Selection details">
      {pin ? <PinPanel model={model} pin={pin} onClose={() => f.setList('pin', [])} /> : <TerritoryPanel model={model} id={territory!} onClose={() => f.setList('territory', [])} />}
    </aside>
  );
}

function PanelHeader({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight tnum">{title}</h2>
          {children}
        </div>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close panel">
        <X />
      </Button>
    </div>
  );
}

function PinPanel({ model, pin, onClose }: { model: MapModel; pin: string; onClose: () => void }) {
  const p = model.byPin.get(pin);
  const f = useFilters();
  const { openApp } = useAppDrawer();
  const navigate = useNavigate();
  if (!p) return null;
  const m = PIN_META[p.status];
  const near = nearestStore(model, pin);
  const t = p.territoryId ? model.territories.find((x) => x.id === p.territoryId) : undefined;
  const apps = p.applicantIds.map((id) => model.rowById.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  const firstLive = apps.find((r) => r.decision.status !== 'Approved' && r.decision.status !== 'Rejected') ?? apps[0];
  return (
    <>
      <PanelHeader title={`PIN ${p.pin}`} sub={`${p.area} · ${p.city}`} onClose={onClose}>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs font-medium', m.cls)}>
          <m.icon className="h-3 w-3" /> {m.label}
        </span>
      </PanelHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {p.locked && (
          <div className="flex items-center gap-2 rounded-md bg-raised px-3 py-2 text-xs">
            <Lock className="h-3.5 w-3.5 text-muted" />
            {p.storeId ? `Store ${p.storeId} already here` : `Planned for ${p.allocatedTo}`} — one store per PIN.
          </div>
        )}
        {p.note && !p.locked && <div className="rounded-md bg-raised px-3 py-2 text-xs text-muted">{p.note}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Nearest store" value={near ? (near.storeId && near.pin === p.pin ? 'Here' : near.storeId) : '—'} />
          <Stat label="Distance (approx.)" value={near ? (near.pin === p.pin ? '0 km' : `${near.km.toFixed(1)} km`) : '—'} />
        </div>
        <div>
          <h3 className="label mb-1.5">Territory</h3>
          {t ? (
            <button type="button" onClick={() => f.replaceAll({ ...useFilters.getState(), pin: [], territory: [t.id] })} className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-raised focus-ring">
              <span className="text-xs font-semibold text-subtle tnum">{t.id}</span>
              <span className="flex-1 truncate">{t.name}</span>
              <PriorityChip priority={t.priority} size="sm" />
            </button>
          ) : (
            <p className="text-xs text-muted">Outside every growth territory</p>
          )}
        </div>
        <div>
          <h3 className="label mb-1.5">Applicants here · {apps.length}</h3>
          {apps.length === 0 ? (
            <p className="text-xs text-muted">No one has applied for this PIN.</p>
          ) : (
            <ul className="space-y-1">
              {apps.map(({ app, decision }) => (
                <li key={app.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openApp(app.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openApp(app.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raised focus-ring"
                  >
                    <Avatar name={app.name} className="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{app.name}</span>
                      <span className="text-2xs text-subtle tnum">
                        {app.id} · {inrLakh(app.investmentLakh)}
                      </span>
                    </span>
                    <DecisionBadge decision={decision} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t p-3">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate(firstLive ? `/ask?about=${firstLive.app.id}` : '/ask')}
        >
          <Sparkles /> What would happen if… <ArrowRight className="ml-auto" />
        </Button>
      </div>
    </>
  );
}

function TerritoryPanel({ model, id, onClose }: { model: MapModel; id: string; onClose: () => void }) {
  const t = model.territories.find((x) => x.id === id);
  const s = model.tStates.get(id);
  const f = useFilters();
  const navigate = useNavigate();
  const { openApp } = useAppDrawer();
  if (!t || !s) return null;
  const competitors = s.competingIds
    .map((aid) => model.rowById.get(aid))
    .filter((r): r is NonNullable<typeof r> => !!r && r.decision.status !== 'Rejected')
    .slice(0, 3);
  return (
    <>
      <PanelHeader title={t.id} sub={`${t.name} · ${t.city}`} onClose={onClose}>
        <PriorityChip priority={t.priority} size="sm" />
        <TierChip tier={t.tier} size="sm" />
      </PanelHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        <div className="flex items-center gap-4">
          <Gauge value={s.filled} max={s.openSlots} size={64} token={s.filled >= s.openSlots ? 'st-approved' : 'brand'} />
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Stat label="Slots filled" value={`${s.filled}/${s.openSlots}`} />
            <Stat label="Applicants" value={s.applicants} />
          </div>
        </div>
        <div>
          <h3 className="label mb-1.5">PINs · {t.pins.length}</h3>
          <div className="flex flex-wrap gap-1">
            {t.pins.map((pin) => {
              const p = model.byPin.get(pin);
              return p ? <PinChip key={pin} pin={pin} status={p.status} size="sm" count={p.applicantIds.length || undefined} onClick={() => f.only('pin', pin)} /> : null;
            })}
          </div>
        </div>
        <div>
          <h3 className="label mb-1.5">Top competing applicants</h3>
          {competitors.length === 0 ? (
            <p className="text-xs text-muted">No applicants yet — an open opportunity.</p>
          ) : (
            <ol className="space-y-1">
              {competitors.map(({ app, decision }, i) => (
                <li key={app.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openApp(app.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openApp(app.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raised focus-ring"
                  >
                    <span className="w-4 text-xs font-semibold text-subtle tnum">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{app.name}</span>
                      <span className="text-2xs text-subtle tnum">
                        {app.id} · PIN {app.pin}
                      </span>
                    </span>
                    <DecisionBadge decision={decision} size="sm" />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <div className="border-t p-3">
        <Button variant="secondary" className="w-full" onClick={() => navigate(`/territories/${t.id}`)}>
          Territory detail <ExternalLink className="ml-auto" />
        </Button>
      </div>
    </>
  );
}

/* ---------------- Bottom strip ---------------- */
export function BottomStrip({ model, view }: { model: MapModel; view: L.LatLngBounds | null }) {
  const area = useMapUi((s) => s.area);
  const setArea = useMapUi((s) => s.setArea);

  if (area.length) {
    const pins = area.map((p) => model.byPin.get(p)).filter((p): p is NonNullable<typeof p> => !!p);
    const appIds = [...new Set(pins.flatMap((p) => p.applicantIds))];
    const caps = appIds.map((id) => model.rowById.get(id)?.app.investmentLakh ?? 0);
    const avg = caps.length ? caps.reduce((a, b) => a + b, 0) / caps.length : 0;
    return (
      <Strip>
        <span className="label text-brand">Selection</span>
        <Stat label="PINs" value={pins.length} />
        <Stat label="Open-slot PINs" value={pins.filter((p) => p.status === 'open').length} />
        <Stat label="Applicants" value={appIds.length} />
        <Stat label="Avg capacity" value={appIds.length ? inrLakh(Math.round(avg)) : '—'} />
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setArea([])}>
          <X /> Clear
        </Button>
      </Strip>
    );
  }

  const inView = model.pins.filter((p) => {
    const c = model.layout.cells.get(p.pin);
    return c && (!view || view.contains([c.center[0], c.center[1]]));
  });
  const terr = inView.filter((p) => p.territoryId);
  const covered = terr.filter((p) => p.status === 'store' || p.status === 'allocated').length;
  return (
    <Strip>
      <span className="label">In view</span>
      <Stat label="PINs in territories" value={terr.length} />
      <Stat label="With store / plan" value={terr.length ? `${Math.round((covered / terr.length) * 100)}%` : '—'} />
      <Stat label="Uncovered PINs" value={terr.length - covered} />
      <Stat label="Outside territories" value={inView.length - terr.length} />
    </Strip>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-center gap-5 overflow-x-auto rounded-lg border bg-surface/95 px-4 py-2 shadow-lift backdrop-blur scrollbar-thin md:right-auto" role="status" aria-live="polite">
      {children}
    </div>
  );
}
