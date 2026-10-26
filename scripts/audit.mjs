// Cognitive-load audit at 1440x900: widgets above the fold, words visible, accent colours in use.
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:5173';
const routes = (process.argv[2] ?? '/,/overview,/map,/applicants,/pipeline,/territories,/onboarding,/ask,/settings').split(',');
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
console.log('route'.padEnd(14), 'widgets', 'words', 'accents');
for (const r of routes) {
  await page.goto(base + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const m = await page.evaluate(() => {
    const H = innerHeight;
    const main = document.querySelector('main') ?? document.body;
    const inView = (el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.top < H && b.bottom > 0;
    };
    // widgets = top-level cards/sections inside main (not nested), plus the map canvas
    const cards = [...main.querySelectorAll('.card, .leaflet-container')].filter((el) => inView(el) && !el.parentElement?.closest('.card'));
    // words in main within the viewport (excluding the persistent shell)
    let words = 0;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!el || !n.textContent.trim() || !inView(el) || getComputedStyle(el).visibility === 'hidden') continue;
      words += n.textContent.trim().split(/\s+/).length;
    }
    // accent colours: saturated hues in text/background/fill/stroke, bucketed by 20° of hue
    const hues = new Set();
    for (const el of main.querySelectorAll('*')) {
      if (!inView(el)) continue;
      const cs = getComputedStyle(el);
      for (const v of [cs.color, cs.backgroundColor, cs.fill, cs.stroke]) {
        const mm = v && v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!mm || (mm[4] !== undefined && Number(mm[4]) < 0.2)) continue;
        const [r, g, b] = [mm[1], mm[2], mm[3]].map((x) => Number(x) / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        const l = (max + min) / 2;
        const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        if (s < 0.35 || l < 0.15 || l > 0.9) continue;
        let h = 0;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        hues.add(Math.round(((h * 60 + 360) % 360) / 20));
      }
    }
    return { widgets: cards.length, words, accents: hues.size };
  });
  console.log(r.padEnd(14), String(m.widgets).padStart(7), String(m.words).padStart(5), String(m.accents).padStart(7));
}
await browser.close();
