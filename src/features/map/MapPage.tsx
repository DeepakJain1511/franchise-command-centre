import type L from 'leaflet';
import type { Map as LMap } from 'leaflet';
import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ErrorState, Skeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlay';
import { useColors, useMediaQuery, useReducedMotion } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { CoverageTable } from './CoverageTable';
import { cellBounds, KARNATAKA, MapCanvas } from './MapCanvas';
import { BottomStrip, DetailPanel, LayerPanel } from './MapPanels';
import { useMapModel, useMapUi } from './model';

export default function MapPage() {
  const { model, error } = useMapModel();
  const bump = useData((s) => s.bump);
  const view = useMapUi((s) => s.view);
  const f = useFilters();
  const c = useColors();
  const wide = useMediaQuery('(min-width: 1024px)');
  const reduced = useReducedMotion();
  const mapRef = useRef<LMap | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const onReady = useCallback((m: LMap) => (mapRef.current = m), []);
  const panelOpen = f.pin.length === 1 || f.territory.length === 1;

  const fit = (what: 'state' | 'city') => {
    const map = mapRef.current;
    if (!map || !model) return;
    if (what === 'state') {
      reduced ? map.fitBounds(KARNATAKA) : map.flyToBounds(KARNATAKA, { duration: 0.8 });
      return;
    }
    const city = f.city[0] ?? model.territories.find((t) => t.id === f.territory[0])?.city;
    const cells = [...model.layout.cells.values()].filter((x) => x.city === city);
    if (cells.length) {
      const opts = { padding: [40, 40] as [number, number], maxZoom: 14 };
      reduced ? map.fitBounds(cellBounds(cells), opts) : map.flyToBounds(cellBounds(cells), { ...opts, duration: 0.8 });
    }
  };

  if (error) return <ErrorState onRetry={bump} />;

  return (
    <div className="flex h-[calc(100vh-105px)] min-h-[520px]">
      {/* Hatch pattern for cannibalisation overlay (referenced by url(#fcc-hatch)) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="fcc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={c('pin-conflict', 0.08)} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={c('pin-conflict', 0.75)} strokeWidth="2" />
          </pattern>
        </defs>
      </svg>

      {wide && model && <LayerPanel model={model} onFit={fit} />}

      <div className="relative min-w-0 flex-1">
        {!model ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : view === 'table' ? (
          <CoverageTable model={model} />
        ) : (
          <>
            <MapCanvas model={model} onReady={onReady} onView={setBounds} rightPad={panelOpen ? 330 : 0} />
            <DetailPanel model={model} />
            <BottomStrip model={model} view={bounds} />
            {!wide && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" className="absolute left-3 top-3 z-[500]">
                    <SlidersHorizontal /> Layers & legend
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-h-[70vh] w-72 overflow-y-auto p-0">
                  <div className="[&>aside]:h-auto [&>aside]:w-full [&>aside]:border-0">
                    <LayerPanel model={model} onFit={fit} />
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </>
        )}
      </div>
    </div>
  );
}
