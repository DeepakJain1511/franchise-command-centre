import L, { type LatLngBoundsExpression, type Map as LMap } from 'leaflet';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import type { PinState } from '@/engine/types';
import type { HexCell } from '@/lib/hex';
import { KARNATAKA_OUTLINE } from '@/data/geo/karnataka';
import { useColors, useReducedMotion } from '@/lib/hooks';
import { PIN_META, PRIORITY_META, tokenColor } from '@/lib/tokens';
import { useFilters } from '@/store/filters';
import { useUi } from '@/store/ui';
import { cannibalisationPins, useMapUi, type MapModel } from './model';

export const KARNATAKA: LatLngBoundsExpression = [
  [11.55, 74.05],
  [18.5, 78.6],
];
const WORLD: Array<[number, number]> = [
  [-89, -179],
  [-89, 179],
  [89, 179],
  [89, -179],
];

/** Below this zoom we show city bubbles (state level). */
export const CITY_ZOOM = 9.5;

const TILE = {
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
};

const metersPerPixel = (lat: number, zoom: number) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
export const cellBounds = (cells: HexCell[]) => L.latLngBounds(cells.flatMap((c) => c.corners));

const STORE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2V7"/></svg>';
const LOCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

/* ------------------------------------------------------------------ */
/* Controller: zoom tracking, fly-to on filter changes, area select    */
/* ------------------------------------------------------------------ */

function Controller({ model, onZoom, onView, onReady, rightPad }: {
  model: MapModel;
  onZoom: (z: number) => void;
  onView: (b: L.LatLngBounds) => void;
  onReady: (m: LMap) => void;
  rightPad: number;
}) {
  const map = useMap();
  const territory = useFilters((s) => s.territory);
  const city = useFilters((s) => s.city);
  const selecting = useMapUi((s) => s.selecting);
  const setArea = useMapUi((s) => s.setArea);
  const reduced = useReducedMotion();
  const rect = useRef<L.Rectangle | null>(null);
  const start = useRef<L.LatLng | null>(null);

  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    moveend: () => onView(map.getBounds()),
  });

  useEffect(() => {
    onReady(map);
    // The container can still be settling its size on first paint; re-measure, then fit
    // the whole state so nothing (e.g. Mysuru in the south) starts cropped.
    const id = window.setTimeout(() => {
      map.invalidateSize();
      if (!useFilters.getState().territory.length && !useFilters.getState().city.length && !useFilters.getState().pin.length) {
        map.fitBounds(KARNATAKA, { padding: [16, 16] });
      }
      onZoom(map.getZoom());
      onView(map.getBounds());
    }, 60);
    return () => window.clearTimeout(id);
  }, [map, onReady, onZoom, onView]);

  // Fly to the focused territory / city whenever the global filter changes
  const pin = useFilters((s) => s.pin);
  const focusKey = territory.length === 1 ? `t:${territory[0]}` : city.length === 1 ? `c:${city[0]}` : '';
  useEffect(() => {
    if (!focusKey) return;
    if (pin.length === 1) return; // a PIN focus below wins
    const cells = [...model.layout.cells.values()].filter((c) => (focusKey.startsWith('t:') ? c.territoryId === focusKey.slice(2) : c.city === focusKey.slice(2)));
    if (!cells.length) return;
    const opts = { paddingTopLeft: [40, 40] as [number, number], paddingBottomRight: [40 + rightPad, 80] as [number, number], maxZoom: 13 };
    if (reduced) map.fitBounds(cellBounds(cells), opts);
    else map.flyToBounds(cellBounds(cells), { ...opts, duration: 0.8 });
    // rightPad intentionally not a dependency: opening the panel should not re-fly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, map, model.layout, reduced]);

  // Bring a focused PIN into view (deep links, table clicks) without zooming out
  const pinKey = pin.length === 1 ? pin[0] : '';
  useEffect(() => {
    if (!pinKey) return;
    const cell = model.layout.cells.get(pinKey);
    if (!cell) return;
    const pinLatLng = L.latLng(cell.center[0], cell.center[1]);
    const zoom = Math.max(map.getZoom(), 12.5);
    if (map.getZoom() >= 12 && map.getBounds().pad(-0.2).contains(pinLatLng)) return;
    // Shift the centre right so the PIN lands left of the detail panel, not under it.
    const target = map.unproject(map.project(pinLatLng, zoom).add([170, 0]), zoom);
    if (reduced) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.8 });
  }, [pinKey, map, model.layout, reduced]);

  // Rectangle selection tool
  useEffect(() => {
    if (!selecting) {
      map.dragging.enable();
      map.getContainer().style.cursor = '';
      return;
    }
    map.dragging.disable();
    map.getContainer().style.cursor = 'crosshair';
    const down = (e: L.LeafletMouseEvent) => {
      start.current = e.latlng;
      rect.current?.remove();
      rect.current = L.rectangle(L.latLngBounds(e.latlng, e.latlng), { color: tokenColor('brand'), weight: 1.5, dashArray: '4 4', fillOpacity: 0.08 }).addTo(map);
    };
    const move = (e: L.LeafletMouseEvent) => {
      if (start.current && rect.current) rect.current.setBounds(L.latLngBounds(start.current, e.latlng));
    };
    const up = () => {
      if (!start.current || !rect.current) return;
      const b = rect.current.getBounds();
      setArea([...model.layout.cells.values()].filter((c) => b.contains(L.latLng(c.center[0], c.center[1]))).map((c) => c.pin));
      start.current = null;
    };
    map.on('mousedown', down);
    map.on('mousemove', move);
    map.on('mouseup', up);
    return () => {
      map.off('mousedown', down);
      map.off('mousemove', move);
      map.off('mouseup', up);
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    };
  }, [selecting, map, model.layout, setArea]);

  useEffect(() => {
    if (!selecting) {
      rect.current?.remove();
      rect.current = null;
    }
  }, [selecting]);

  return null;
}

/* ------------------------------------------------------------------ */

export function MapCanvas({ model, onReady, onView, rightPad }: {
  model: MapModel;
  onReady: (m: LMap) => void;
  onView: (b: L.LatLngBounds) => void;
  rightPad: number;
}) {
  const theme = useUi((s) => s.theme);
  const c = useColors();
  const f = useFilters();
  const { layers, ringKm, area } = useMapUi();
  const [zoom, setZoom] = useState(7);

  const stateLevel = zoom < CITY_ZOOM;
  const selTerritory = f.territory.length === 1 ? f.territory[0] : null;
  const selPin = f.pin.length === 1 ? f.pin[0] : null;
  const risk = useMemo(() => (layers.rings ? cannibalisationPins(model, ringKm) : new Set<string>()), [layers.rings, model, ringKm]);
  const areaSet = useMemo(() => new Set(area), [area]);

  const matchesFilters = (p: PinState) => {
    if (f.pin.length && !f.pin.includes(p.pin)) return false;
    if (f.priority.length) {
      const t = model.territories.find((x) => x.id === p.territoryId);
      if (!t || !f.priority.includes(t.priority)) return false;
    }
    if (f.status.length) {
      const has = p.applicantIds.some((id) => {
        const r = model.rowById.get(id);
        return r && f.status.includes(r.decision.status);
      });
      if (!has) return false;
    }
    return true;
  };

  const cells = [...model.layout.cells.values()];
  const pxRadius = (cell: HexCell) => (cell.sizeKm * 1000) / metersPerPixel(cell.center[0], zoom);

  return (
    <MapContainer bounds={KARNATAKA} zoomControl={false} className="h-full w-full" zoomSnap={0.25} wheelPxPerZoomLevel={90} attributionControl>
      <TileLayer
        key={theme}
        url={TILE[theme]}
        attribution='Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors'

        maxZoom={16}
      />
      <ZoomControl position="bottomright" />
      {/* Karnataka: soft mask outside the state + crisp boundary */}
      <Polygon
        positions={[WORLD, ...KARNATAKA_OUTLINE]}
        interactive={false}
        pathOptions={{ stroke: false, fillColor: c('bg'), fillOpacity: 0.55 }}
      />
      <Polyline positions={KARNATAKA_OUTLINE} interactive={false} pathOptions={{ color: c('brand', 0.55), weight: 1.5, dashArray: stateLevel ? undefined : '4 4' }} />
      <Controller model={model} onZoom={setZoom} onView={onView} onReady={onReady} rightPad={rightPad} />

      {stateLevel ? (
        model.cities.map((city) => {
          const color = city.topPriority ? c(PRIORITY_META[city.topPriority].token) : c('subtle');
          const size = Math.round(28 + city.slots * 3);
          const open = city.slots - city.filled;
          // The bubble itself is the icon box, anchored at its centre on the true city point;
          // the name label hangs below it without shifting the anchor.
          const html = `<div style="position:relative;width:${size}px;height:${size}px">
              <div style="width:100%;height:100%;border-radius:999px;background:${city.slots ? color : c('pin-outside')};box-shadow:0 0 0 3px ${c('surface')},0 4px 14px -6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:${city.topPriority === 'Low' ? c('fg') : '#fff'};font:700 13px Inter,sans-serif;font-variant-numeric:tabular-nums">${city.slots ? `${open}` : '–'}</div>
              <div style="position:absolute;top:calc(100% + 5px);left:50%;transform:translateX(-50%);white-space:nowrap;text-align:center;font:600 11px Inter,sans-serif;color:${c('fg')};text-shadow:0 0 3px ${c('surface')},0 0 3px ${c('surface')}">${city.city}</div>
            </div>`;
          return (
            <Marker
              key={city.city}
              position={[city.lat, city.lng]}
              icon={L.divIcon({ className: 'fcc-div-icon', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })}
              eventHandlers={{ click: () => f.only('city', city.city) }}
              keyboard
              title={`${city.city}: ${open} open of ${city.slots} slots, ${city.stores} stores`}
            >
              <Tooltip className="fcc-tip" direction="top" offset={[0, -size / 2]}>
                <b>{city.city}</b> · {city.slots ? `${open} open / ${city.slots} slots` : 'no territory'} · {city.stores} store{city.stores === 1 ? '' : 's'}
              </Tooltip>
            </Marker>
          );
        })
      ) : (
        <>
          {/* PIN hexes */}
          {cells.map((cell) => {
            const p = model.byPin.get(cell.pin);
            if (!p) return null;
            // Tiles sit at their real locations, so each always shows its own PIN state.
            const meta = PIN_META[p.status];
            let fill = c(meta.token);
            let opacity = 0.72;
            if (p.status === 'outside') opacity = 0.45;
            if (p.status === 'full') {
              fill = c('subtle');
              opacity = 0.22;
            }
            if (!matchesFilters(p)) opacity *= 0.35;
            const selected = selPin === p.pin || areaSet.has(p.pin);
            return (
              <Polygon
                key={cell.pin}
                positions={cell.corners}
                pathOptions={{
                  fillColor: fill,
                  fillOpacity: opacity,
                  color: selected ? c('brand') : c('surface'),
                  weight: selected ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => f.only('pin', p.pin),
                }}
              >
                <Tooltip className="fcc-tip" sticky direction="top" offset={[0, -8]}>
                  <div className="flex items-center gap-1.5">
                    <b className="tnum">{p.pin}</b>
                    <span className="text-muted">{p.area}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-2xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: c(meta.token) }} />
                    {meta.label}
                    {p.locked && ' · locked'}
                    {p.applicantIds.length > 0 && ` · ${p.applicantIds.length} applicant${p.applicantIds.length > 1 ? 's' : ''}`}
                  </div>
                  {p.locked && <div className="mt-0.5 text-2xs text-muted">One store per PIN</div>}
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Cannibalisation hatch */}
          {layers.rings &&
            cells
              .filter((cell) => risk.has(cell.pin))
              .map((cell) => (
                <Polygon key={`h-${cell.pin}`} positions={cell.corners} interactive={false} pathOptions={{ fillColor: 'url(#fcc-hatch)', fillOpacity: 1, stroke: false }} />
              ))}

          {/* Territory outlines + labels */}
          {layers.outlines &&
            model.territories.map((t) => {
              const segs = model.layout.outlines.get(t.id);
              if (!segs) return null;
              const tc = cells.filter((x) => x.territoryId === t.id);
              const top = Math.max(...tc.flatMap((x) => x.corners.map((k) => k[0])));
              const midLng = tc.reduce((n, x) => n + x.center[1], 0) / tc.length;
              const ts = model.tStates.get(t.id);
              const open = ts ? ts.openSlots - ts.filled : t.openSlots;
              const active = selTerritory === t.id;
              const dim = (selTerritory && !active) || (f.priority.length > 0 && !f.priority.includes(t.priority));
              const color = c(PRIORITY_META[t.priority].token);
              const html = `<button type="button" aria-label="${t.id} ${t.name}" style="transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:3px 8px 3px 4px;border-radius:999px;border:1px solid ${active ? c('brand') : c('border')};background:${c('surface')};box-shadow:0 4px 12px -4px rgba(0,0,0,.25);font:600 11px Inter,sans-serif;color:${c('fg')};opacity:${dim ? 0.45 : 1};cursor:pointer">
                  <span style="background:${color};color:#fff;border-radius:999px;padding:1px 6px;font-size:10px">${t.priority}</span>
                  ${t.id}<span style="font-weight:500;color:${c('muted')}">${open} open</span></button>`;
              return (
                <Fragment key={t.id}>
                  <Polyline positions={segs} pathOptions={{ color: active ? c('brand') : color, weight: active ? 3.5 : 2.25, opacity: dim ? 0.35 : 0.95, lineCap: 'round' }} interactive={false} />
                  <Marker
                    position={[top, midLng]}
                    icon={L.divIcon({ className: 'fcc-div-icon', html, iconSize: [0, 0] })}
                    eventHandlers={{ click: () => f.only('territory', t.id) }}
                    zIndexOffset={1000}
                  />
                </Fragment>
              );
            })}

          {/* PIN labels at higher zoom only */}
          {layers.labels &&
            cells
              .filter((cell) => pxRadius(cell) >= 24)
              .map((cell) => (
                <Marker
                  key={`l-${cell.pin}`}
                  position={cell.center}
                  interactive={false}
                  icon={L.divIcon({ className: 'fcc-div-icon', html: `<span class="fcc-pinlabel${model.byPin.get(cell.pin)?.status === 'store' ? ' fcc-up' : ''}">${cell.pin}</span>`, iconSize: [0, 0] })}
                />
              ))}

          {/* Applicant interest badges */}
          {layers.interest &&
            model.pins
              .filter((p) => p.applicantIds.length > 0 && (p.status === 'interest' || p.status === 'conflict' || p.status === 'outside'))
              .map((p) => {
                const cell = model.layout.cells.get(p.pin);
                if (!cell) return null;
                const bg = p.status === 'conflict' ? c('pin-conflict') : c('pin-interest');
                return (
                  <Marker
                    key={`i-${p.pin}`}
                    position={cell.corners[5]}
                    interactive={false}
                    icon={L.divIcon({
                      className: 'fcc-div-icon',
                      html: `<span style="transform:translate(-50%,-50%);display:inline-flex;min-width:16px;height:16px;align-items:center;justify-content:center;border-radius:999px;background:${bg};color:#fff;font:700 10px Inter,sans-serif;box-shadow:0 0 0 2px ${c('surface')}">${p.applicantIds.length}</span>`,
                      iconSize: [0, 0],
                    })}
                  />
                );
              })}

          {/* Planned (allocated) stores */}
          {layers.planned &&
            model.pins
              .filter((p) => p.status === 'allocated')
              .map((p) => {
                const cell = model.layout.cells.get(p.pin);
                if (!cell) return null;
                return (
                  <Marker
                    key={`p-${p.pin}`}
                    position={cell.corners[4]}
                    icon={L.divIcon({
                      className: 'fcc-div-icon',
                      html: `<span style="transform:translate(-50%,-50%);display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:${c('pin-allocated')};color:#fff;box-shadow:0 0 0 2px ${c('surface')},0 4px 10px -4px rgba(0,0,0,.4)">${LOCK_SVG}</span>`,
                      iconSize: [0, 0],
                    })}
                    eventHandlers={{ click: () => f.only('pin', p.pin) }}
                  >
                    <Tooltip className="fcc-tip" direction="top" offset={[0, -10]}>
                      <b>Planned</b> · {p.allocatedTo} · PIN {p.pin} locked
                    </Tooltip>
                  </Marker>
                );
              })}
        </>
      )}

      {/* Catchment rings */}
      {layers.rings &&
        !stateLevel &&
        model.storeCells.map((s) => (
          <Circle
            key={`r-${s.storeId}`}
            center={s.cell.center}
            radius={ringKm * 1000}
            interactive={false}
            pathOptions={{ color: c('pin-store', 0.55), weight: 1.25, dashArray: '4 5', fillColor: c('pin-store'), fillOpacity: 0.05 }}
          />
        ))}

      {/* Existing stores (visible at every level) */}
      {layers.stores &&
        !stateLevel &&
        model.storeCells.map((s) => (
          <Marker
            key={s.storeId}
            position={s.cell.center}
            zIndexOffset={800}
            icon={L.divIcon({
              className: 'fcc-div-icon',
              html: `<span style="transform:translate(-50%,${stateLevel ? '-50%' : '-15%'});display:inline-flex;align-items:center;gap:4px;padding:${stateLevel ? '3px' : '3px 6px 3px 4px'};border-radius:8px;background:${c('pin-store')};color:${c('surface')};font:600 10px Inter,sans-serif;white-space:nowrap;box-shadow:0 0 0 2px ${c('surface')},0 4px 10px -4px rgba(0,0,0,.45)">${STORE_SVG}${stateLevel ? '' : s.storeId}</span>`,
              iconSize: [0, 0],
            })}
            eventHandlers={{ click: () => !stateLevel && f.only('pin', s.pin) }}
          >
            <Tooltip className="fcc-tip" direction="top" offset={[0, -12]}>
              <b>{s.storeId}</b> · PIN {s.pin} · opened {s.openedYear}
              <div className="text-2xs text-muted">Store already here — one store per PIN.</div>
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}
