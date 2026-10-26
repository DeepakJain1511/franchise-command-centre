// Tile screenshots into one contact sheet: node scripts/contact.mjs <filter-substring> <out.png> [cols] [thumbWidth]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [filter = '', out = 'screenshots/_sheet.png', cols = '3', w = '480'] = process.argv.slice(2);
const files = fs.readdirSync('screenshots').filter((f) => f.endsWith('.png') && !f.startsWith('_') && f.includes(filter)).sort();
const imgs = files
  .map((f) => {
    const b64 = fs.readFileSync(path.join('screenshots', f)).toString('base64');
    return `<figure><img src="data:image/png;base64,${b64}"/><figcaption>${f}</figcaption></figure>`;
  })
  .join('');
const html = `<html><body style="margin:0;background:#888;font:11px sans-serif">
<div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px">${imgs}</div>
<style>figure{margin:0;background:#fff}img{width:100%;display:block}figcaption{padding:2px 4px}</style></body></html>`;
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(w) + 6) + 6, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${files.length} images -> ${out}`);
