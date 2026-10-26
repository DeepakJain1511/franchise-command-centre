// Visual check helper: node scripts/shoot.mjs "/overview,/map" [widths] [themes]
// Writes PNGs to ./screenshots and prints console errors seen on each page.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173';
const routes = (process.argv[2] ?? '/overview').split(',');
const widths = (process.argv[3] ?? '1440').split(',').map(Number);
const themes = (process.argv[4] ?? 'light').split(',');
const full = process.env.FULL === '1';
fs.mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const theme of themes) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1, colorScheme: theme });
    await ctx.addInitScript((t) => localStorage.setItem('fcc-theme', t), theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    for (const r of routes) {
      await page.goto(base + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(Number(process.env.WAIT ?? 900));
      const name = `${r.replace(/[/?=&,]+/g, '_').replace(/^_/, '') || 'start'}-${w}-${theme}.png`;
      await page.screenshot({ path: `screenshots/${name}`, fullPage: full });
      console.log(`${name}${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
      errors.length = 0;
    }
    await ctx.close();
  }
}
await browser.close();
