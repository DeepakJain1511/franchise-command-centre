// Cross-filtering, drill, Ctrl+K, map overlay and pipeline drag checks.
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:5173';
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const ok = (name, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

// 1. Donut legend -> global status filter chip + URL
await page.goto(`${base}/overview`, { waitUntil: 'networkidle' });
await page.getByRole('list', { name: /Legend/ }).getByRole('button', { name: /On hold/ }).click();
await page.waitForTimeout(300);
ok('donut legend sets Status chip', await page.getByText('Status:').isVisible());
ok('filter synced to URL', page.url().includes('status=On+hold') || page.url().includes('status=On%20hold'));
const kpi = await page.getByRole('button', { name: /^On hold/ }).first().getAttribute('aria-pressed');
ok('KPI card reflects the same filter', kpi === 'true');

// 2. Funnel stage -> drop-reason panel; filters persist across nav
await page.getByRole('button', { name: /^Reset$/ }).click();
await page.getByRole('button', { name: /^Approved: \d+/ }).click();
await page.waitForTimeout(400);
ok('funnel click opens "why they stop" panel', await page.getByText('Why they stop here').isVisible());
await page.getByRole('link', { name: 'Applicants' }).click();
await page.waitForTimeout(600);
ok('stage filter survives sidebar navigation', page.url().includes('stage=Approved'));
const rows = await page.locator('tbody tr').count();
ok(`applicants list filtered to approved (${rows} rows)`, rows === 11);

// 3. Ctrl+K -> APP-007 -> drawer
await page.keyboard.press('Control+k');
await page.keyboard.type('APP-007');
await page.waitForTimeout(200);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
ok('Ctrl+K opens applicant drawer', (await page.locator('[role="dialog"]').innerText()).includes('Vikram Singh'));
await page.keyboard.press('Escape');

// 4. Map: catchment rings overlay
await page.goto(`${base}/map?city=Bengaluru`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('switch', { name: 'Catchment rings' }).click();
await page.waitForTimeout(600);
const hatched = await page.locator('path[fill="url(#fcc-hatch)"]').count();
ok(`catchment overlay hatches PINs (${hatched})`, hatched > 0);
await page.screenshot({ path: 'screenshots/map-rings-light.png' });

// 5. Pipeline drag -> toast, card stays
await page.goto(`${base}/pipeline`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const card = page.getByText('Amit Jain').first();
const target = page.getByText('In onboarding', { exact: false }).first();
await card.dragTo(target);
await page.waitForTimeout(400);
ok('drag shows "decided by the engine" toast', await page.getByText(/decided by the engine/i).isVisible());

console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console errors');
await browser.close();
