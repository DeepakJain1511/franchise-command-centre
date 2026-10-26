/**
 * Hex-lattice layout for PIN codes (presentation only).
 *
 * We have no real PIN boundary polygons, so each PIN's approximate centroid is snapped
 * onto a pointy-top hex lattice per city, at the free cell nearest its real location.
 * Territory outlines are the hex edges not shared with a neighbour of the same territory.
 */
import { haversineKm } from './geo';

const SQ3 = Math.sqrt(3);
export type LatLng = [number, number];

export interface HexInput {
  pin: string;
  city: string;
  lat: number;
  lng: number;
  territoryId: string | null;
}

export interface HexCell {
  pin: string;
  city: string;
  territoryId: string | null;
  q: number;
  r: number;
  center: LatLng;
  corners: LatLng[];
  sizeKm: number;
}

export interface HexLayout {
  cells: Map<string, HexCell>;
  /** territoryId -> outline segments ([a, b] pairs) */
  outlines: Map<string, LatLng[][]>;
  /** territoryId -> label anchor (centroid of its cells) */
  anchors: Map<string, LatLng>;
}

const HEX_KM: Record<string, number> = {
  Bengaluru: 1.0,
  'Hubballi-Dharwad': 0.8,
};
const DEFAULT_KM = 0.55;

/** Pointy-top: neighbour across edge i (edge between corner i and i+1). */
const EDGE_NEIGHBOUR: Array<[number, number]> = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];
const RING_DIRS: Array<[number, number]> = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

interface Frame { lat0: number; lng0: number; kx: number; ky: number; size: number }

const toKm = (f: Frame, lat: number, lng: number) => ({ x: (lng - f.lng0) * f.kx, y: (f.lat0 - lat) * f.ky });
const fromKm = (f: Frame, x: number, y: number): LatLng => [f.lat0 - y / f.ky, f.lng0 + x / f.kx];
const centreKm = (f: Frame, q: number, r: number) => ({ x: f.size * SQ3 * (q + r / 2), y: f.size * 1.5 * r });

function axialRound(qf: number, rf: number): [number, number] {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}
const toAxial = (f: Frame, x: number, y: number) =>
  axialRound(((SQ3 / 3) * x - (1 / 3) * y) / f.size, ((2 / 3) * y) / f.size);

function* spiral(q0: number, r0: number): Generator<[number, number]> {
  yield [q0, r0];
  for (let k = 1; k < 40; k++) {
    let q = q0 + RING_DIRS[4][0] * k;
    let r = r0 + RING_DIRS[4][1] * k;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < k; j++) {
        yield [q, r];
        q += RING_DIRS[i][0];
        r += RING_DIRS[i][1];
      }
    }
  }
}

export function layoutHexes(inputs: HexInput[]): HexLayout {
  const cells = new Map<string, HexCell>();
  const byCity = new Map<string, HexInput[]>();
  for (const i of inputs) byCity.set(i.city, [...(byCity.get(i.city) ?? []), i]);

  for (const [city, list] of byCity) {
    const lat0 = list.reduce((s, i) => s + i.lat, 0) / list.length;
    const lng0 = list.reduce((s, i) => s + i.lng, 0) / list.length;
    const f: Frame = {
      lat0, lng0,
      kx: 111.32 * Math.cos((lat0 * Math.PI) / 180),
      ky: 110.574,
      size: HEX_KM[city] ?? DEFAULT_KM,
    };
    const taken = new Set<string>();
    const place = (inp: HexInput, q: number, r: number) => {
      taken.add(`${q},${r}`);
      const c = centreKm(f, q, r);
      const corners: LatLng[] = [];
      for (let i = 0; i < 6; i++) {
        const a = ((60 * i - 30) * Math.PI) / 180;
        corners.push(fromKm(f, c.x + f.size * Math.cos(a), c.y + f.size * Math.sin(a)));
      }
      cells.set(inp.pin, {
        pin: inp.pin, city, territoryId: inp.territoryId, q, r,
        center: fromKm(f, c.x, c.y), corners, sizeKm: f.size,
      });
    };

    // Every PIN goes to the free cell nearest its real location, so tiles stay where the
    // locality actually is (at most ~one tile away when two PINs are very close).
    for (const m of [...list].sort((a, b) => a.pin.localeCompare(b.pin))) {
      const pos = toKm(f, m.lat, m.lng);
      const [q0, r0] = toAxial(f, pos.x, pos.y);
      for (const [q, r] of spiral(q0, r0)) {
        if (!taken.has(`${q},${r}`)) {
          place(m, q, r);
          break;
        }
      }
    }
  }

  // outlines + anchors
  const outlines = new Map<string, LatLng[][]>();
  const anchors = new Map<string, LatLng>();
  const key = (city: string, q: number, r: number) => `${city}|${q},${r}`;
  const index = new Map<string, HexCell>();
  for (const c of cells.values()) index.set(key(c.city, c.q, c.r), c);
  const groups = new Map<string, HexCell[]>();
  for (const c of cells.values()) {
    if (!c.territoryId) continue;
    groups.set(c.territoryId, [...(groups.get(c.territoryId) ?? []), c]);
    const segs = outlines.get(c.territoryId) ?? [];
    EDGE_NEIGHBOUR.forEach(([dq, dr], i) => {
      const n = index.get(key(c.city, c.q + dq, c.r + dr));
      if (!n || n.territoryId !== c.territoryId) segs.push([c.corners[i], c.corners[(i + 1) % 6]]);
    });
    outlines.set(c.territoryId, segs);
  }
  for (const [tid, g] of groups) {
    anchors.set(tid, [
      g.reduce((s, c) => s + c.center[0], 0) / g.length,
      g.reduce((s, c) => s + c.center[1], 0) / g.length,
    ]);
  }
  return { cells, outlines, anchors };
}

/** True if a hex cell overlaps a catchment ring of radiusKm around a point (geometry only). */
export function overlapsRing(cell: HexCell, centre: LatLng, radiusKm: number): boolean {
  const d = haversineKm({ lat: cell.center[0], lng: cell.center[1] }, { lat: centre[0], lng: centre[1] });
  return d < radiusKm + cell.sizeKm * 0.6;
}
