// Scripted judge flow: Ask -> what-if diff -> apply -> dashboard reflects it.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173';
const theme = process.argv[2] ?? 'light';
fs.mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
await ctx.addInitScript((t) => localStorage.setItem('fcc-theme', t), theme);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${base}/ask`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Why is APP-007 on hold?' }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'What if APP-012 finds a ground-floor space?' }).first().click();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: 'See the diff' }).first().click();
await page.waitForTimeout(2200);
await page.screenshot({ path: `screenshots/flow-ask-diff-${theme}.png`, fullPage: true });

await page.getByRole('button', { name: 'Apply change' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `screenshots/flow-applied-${theme}.png` });

await page.goto(`${base}/applicants?app=APP-012`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const drawerText = await page.locator('[role="dialog"]').innerText();
console.log('APP-012 drawer shows Approved:', /Approved/.test(drawerText));
await page.screenshot({ path: `screenshots/flow-app012-after-${theme}.png` });

console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console errors');
await browser.close();
