// One-off: extract + simplify the Karnataka boundary from a states GeoJSON.
// node scripts/extract-karnataka.mjs <india_state.geojson>  ->  src/data/geo/karnataka.ts
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const f = src.features.find((x) => /karnataka/i.test(x.properties.NAME_1 ?? x.properties.st_nm ?? ''));
if (!f) throw new Error('Karnataka not found');
const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

// Douglas-Peucker on [lng, lat]
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

const rings = polys
  .map((p) => p[0]) // outer rings only
  .filter((r) => r.length > 30) // drop tiny islands
  .map((r) => { const h = Math.floor(r.length / 2); return [...dp(r.slice(0, h + 1), 0.006).slice(0, -1), ...dp(r.slice(h), 0.006)]; })
  .filter((r) => r.length >= 10)
  .map((r) => r.map(([lng, lat]) => [Number(lat.toFixed(3)), Number(lng.toFixed(3))]));

const total = rings.reduce((n, r) => n + r.length, 0);
fs.mkdirSync('src/data/geo', { recursive: true });
fs.writeFileSync(
  'src/data/geo/karnataka.ts',
  `/**\n * Karnataka state boundary (outer rings), simplified for display.\n * Source: geohacker/india state boundaries (GADM-derived), Douglas-Peucker ~0.6 km.\n */\nexport const KARNATAKA_OUTLINE: Array<Array<[number, number]>> = ${JSON.stringify(rings)};\n`,
);
console.log(`rings: ${rings.length}, points: ${total}`);
