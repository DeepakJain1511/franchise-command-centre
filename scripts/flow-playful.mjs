// Checks for the interactive layer: timeline brush, map time-lapse, live what-if, shortcuts.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173';
fs.mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const ok = (name, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

// 1. Timeline brush drag -> "Received" chip + KPI changes
await page.goto(`${base}/overview`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const before = await page.getByRole('button', { name: /^Applications/ }).first().innerText();
const traveller = page.locator('.recharts-brush-traveller').first();
const box = await traveller.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 420, box.y + box.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1200);
ok('brush drag adds a Received date chip', await page.getByText('Received:').isVisible());
const after = await page.getByRole('button', { name: /^Applications/ }).first().innerText();
ok(`KPI rolls to the new range (${before.split('\n').pop()} -> ${after.split('\n').pop()})`, before !== after);
ok('range synced to URL', page.url().includes('from=') && page.url().includes('to='));
await page.screenshot({ path: 'screenshots/play-timeline.png' });

// 2. Map time-lapse
await page.goto(`${base}/map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Play time-lapse' }).click();
await page.waitForTimeout(2600);
const label = await page.getByRole('button', { name: /Back to today|Showing today/ }).innerText();
ok(`time-lapse is replaying (at ${label.trim()})`, !/Today/.test(label));
await page.screenshot({ path: 'screenshots/play-timelapse.png' });
await page.getByRole('button', { name: 'Pause time-lapse' }).click();

// 3. Live what-if: flip two fields, no Simulate click
await page.goto(`${base}/ask?about=APP-012`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.getByRole('radio', { name: 'Rented' }).click();
await page.getByRole('radio', { name: 'Ground' }).click();
await page.waitForTimeout(400);
const slider = page.getByRole('slider', { name: 'Space size in square feet' });
await slider.focus();
for (let i = 0; i < 35; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(2200);
ok('live what-if re-runs without pressing Simulate', (await page.locator('section[aria-label="What-if sandbox"]').innerText()).includes('takes the last TER-03 slot'));
await page.screenshot({ path: 'screenshots/play-live-whatif.png' });

// 4. Shortcuts
await page.locator('body').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('g');
await page.keyboard.press('m');
await page.waitForTimeout(500);
ok('G then M goes to the map', page.url().includes('/map'));
await page.keyboard.type('?');
await page.waitForTimeout(300);
ok('? opens the shortcut sheet', await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).isVisible());

console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console errors');
await browser.close();
