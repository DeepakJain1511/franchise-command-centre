// First-run judge flow: land -> sample data -> dashboard (timed); upload error + upload success.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';

const base = process.env.BASE ?? 'http://localhost:5173';
fs.mkdirSync('screenshots', { recursive: true });

// A filled copy of the judges' template (3 applications, 1 territory) for the success path
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fcc-'));
const wb = XLSX.read(fs.readFileSync('public/Case1_Franchise_Test_Data_Format.xlsx'));
XLSX.utils.sheet_add_aoa(wb.Sheets.Applications, [
  ['APP-101', 'Test One', 'Mysuru', 'Karnataka', 570002, 40, 3, 'Shop', 'Rented', 420, 'Ground', 4, 'Kannada', ''],
  ['APP-102', 'Test Two', 'Bengaluru', 'Karnataka', 560037, 60, 5, '', 'Owned', '', 'Ground', 2, 'Hindi', 'messy'],
  ['APP-103', 'Test Three', 'Tumakuru', 'Karnataka', 572101, 25, 0, 'Kirana', 'Not yet identified', '', 'Not known', 1, 'English', ''],
], { origin: 'A4' });
XLSX.utils.sheet_add_aoa(wb.Sheets.Territories, [['TER-02', 'Bengaluru', 'Karnataka', '560037, 560048', 'Tier 1', 2, 'High']], { origin: 'A4' });
const filled = path.join(tmp, 'filled.xlsx');
XLSX.writeFile(wb, filled);

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => localStorage.setItem('fcc-theme', t), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  const t0 = Date.now();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `screenshots/start-landing-${theme}.png` });
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await page.getByRole('button', { name: 'Open dashboard' }).waitFor();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /with data issues/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/start-done-${theme}.png` });
  await page.getByRole('button', { name: 'Open dashboard' }).click();
  await page.getByText('Pipeline funnel').waitFor();
  console.log(`[${theme}] land -> dashboard: ${((Date.now() - t0) / 1000).toFixed(1)}s (incl. one preview click)`);

  if (theme === 'light') {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('input[type=file]').setInputFiles('public/Case1_Franchise_Test_Data_Format.xlsx');
    await page.getByRole('alert').waitFor();
    await page.screenshot({ path: `screenshots/start-error-${theme}.png` });
    console.log('blank template ->', (await page.getByRole('alert').innerText()).replace(/\s+/g, ' ').slice(0, 160));

    await page.locator('input[type=file]').setInputFiles(filled);
    await page.getByRole('button', { name: 'Open dashboard' }).waitFor();
    await page.screenshot({ path: `screenshots/start-upload-ok-${theme}.png` });
    console.log('filled workbook -> ready');
  }
  console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console errors');
  await ctx.close();
}
await browser.close();
