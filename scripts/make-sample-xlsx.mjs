// Builds public/sample_data.xlsx: the judges' template with the sample applications and territories filled in.
// Run: node scripts/make-sample-xlsx.mjs   (Node ≥ 22 — imports the TypeScript fixtures directly)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { applications } = await import(pathToFileURL(path.join(root, 'src/data/mock/applications.ts')).href);
const { territories } = await import(pathToFileURL(path.join(root, 'src/data/mock/territories.ts')).href);

const wb = XLSX.readFile(path.join(root, 'public/Case1_Franchise_Test_Data_Format.xlsx'));

// Row 1 = title, row 2 = headers, row 3 = the grey example. Data replaces the example from row 3 down.
const appRows = applications.map((a) => [
  a.id, a.name, a.city, a.state, Number(a.pin), a.investmentLakh, a.experienceYears, a.business, a.space, a.spaceSqft, a.floor, a.launchMonths, a.language, a.notes,
]);
XLSX.utils.sheet_add_aoa(wb.Sheets.Applications, appRows, { origin: 'A3' });

const terRows = territories.map((t) => [t.id, t.city, t.state, t.pins.join(', '), t.tier, t.openSlots, t.priority]);
XLSX.utils.sheet_add_aoa(wb.Sheets.Territories, terRows, { origin: 'A3' });

XLSX.writeFile(wb, path.join(root, 'public/sample_data.xlsx'));
console.log(`sample_data.xlsx: ${appRows.length} applications, ${terRows.length} territories`);
