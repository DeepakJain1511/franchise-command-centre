/**
 * Step 1 — workbook → typed data (Build Spec §3). Sheets are detected by their headers, not their names;
 * headers match case-insensitively and tolerate small differences; bad cells become nulls + flags, never crashes.
 */
import type { WorkBook, WorkSheet } from 'xlsx';
import { CITY_INFO } from '@/config';
import { stores as BUILT_IN_STORES } from '@/data/mock/stores';
import { cityOfPin } from './flags';
import type { BaseData } from './model';
import type { Application, City, Floor, Language, Priority, SpaceAvailable, Store, Territory, Tier } from './types';

type Utils = typeof import('xlsx').utils;
type Cell = string | number | boolean | null;
type Row = Cell[];

const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/₹/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/* ---------------- Header aliases ---------------- */

type AppKey = 'id' | 'name' | 'city' | 'state' | 'pin' | 'cityStatePin' | 'investment' | 'experience' | 'business' | 'space' | 'size' | 'floor' | 'launch' | 'language' | 'notes';
type TerKey = 'id' | 'city' | 'state' | 'cityState' | 'pins' | 'tier' | 'slots' | 'priority' | 'name';
type StoreKey = 'id' | 'city' | 'pin' | 'opened';

/** First alias that the normalised header starts with wins. Order matters (more specific first). */
const APP_HEADERS: Array<[AppKey, string[]]> = [
  ['id', ['application id', 'app id', 'application no', 'id']],
  ['name', ['applicant name', 'name', 'applicant']],
  ['cityStatePin', ['city state pin']],
  ['pin', ['pin code', 'pincode', 'pin', 'postal code']],
  ['state', ['state']],
  ['city', ['city']],
  ['investment', ['investment capacity', 'investment', 'capacity']],
  ['experience', ['retail experience', 'experience', 'years of experience']],
  ['business', ['current past business', 'current business', 'past business', 'business', 'occupation']],
  ['space', ['space available', 'space status', 'space']],
  ['size', ['space size', 'size', 'area', 'sq ft']],
  ['floor', ['floor']],
  ['launch', ['target launch', 'launch', 'months to launch']],
  ['language', ['preferred language', 'language']],
  ['notes', ['notes from applicant', 'notes', 'comments', 'remarks']],
];
const TER_HEADERS: Array<[TerKey, string[]]> = [
  ['id', ['territory id', 'territory', 'id']],
  ['name', ['territory name', 'name']],
  ['cityState', ['city state']],
  ['pins', ['pin codes covered', 'pin codes', 'pincodes', 'pins', 'pin code']],
  ['tier', ['city tier', 'tier']],
  ['slots', ['open slots', 'slots']],
  ['priority', ['priority']],
  ['state', ['state']],
  ['city', ['city']],
];
const STORE_HEADERS: Array<[StoreKey, string[]]> = [
  ['id', ['store id', 'id']],
  ['city', ['city']],
  ['pin', ['pin code', 'pincode', 'pin']],
  ['opened', ['opened', 'year']],
];

function mapHeaders<K extends string>(header: Row, defs: Array<[K, string[]]>): Map<K, number> {
  const out = new Map<K, number>();
  const used = new Set<number>();
  for (const [key, aliases] of defs) {
    for (const alias of aliases) {
      const idx = header.findIndex((h, i) => !used.has(i) && (norm(h) === alias || norm(h).startsWith(`${alias} `) || norm(h).startsWith(alias)));
      if (idx >= 0) {
        out.set(key, idx);
        used.add(idx);
        break;
      }
    }
  }
  return out;
}

/* ---------------- Value parsers ---------------- */

const CITY_ALIASES: Record<string, City> = {
  bengaluru: 'Bengaluru', bangalore: 'Bengaluru', blr: 'Bengaluru',
  mysuru: 'Mysuru', mysore: 'Mysuru',
  mangaluru: 'Mangaluru', mangalore: 'Mangaluru',
  'hubballi dharwad': 'Hubballi-Dharwad', hubballi: 'Hubballi-Dharwad', hubli: 'Hubballi-Dharwad', dharwad: 'Hubballi-Dharwad', 'hubli dharwad': 'Hubballi-Dharwad',
  belagavi: 'Belagavi', belgaum: 'Belagavi',
  tumakuru: 'Tumakuru', tumkur: 'Tumakuru',
  davanagere: 'Davanagere', davangere: 'Davanagere',
};
export const parseCity = (v: unknown): City | null => CITY_ALIASES[norm(v)] ?? null;

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '' || /^(na|n a|nil|none|-|—)$/i.test(String(v).trim());

/** ₹ lakh: 25, "25L", "₹25 lakh", "25.5", "1.2 Cr", "25,00,000" (rupees). */
export function parseLakh(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return v > 10000 ? v / 100000 : v;
  const s = String(v).toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr/g, '').trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (/cr|crore/.test(s)) return n * 100;
  if (/lakh|lac|\bl\b|l$/.test(s)) return n;
  return n > 10000 ? n / 100000 : n;
}

export function parseNum(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return v;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parsePin(v: unknown): string {
  if (isBlank(v)) return '';
  return String(typeof v === 'number' ? Math.round(v) : v).replace(/\s+/g, '').trim();
}

export function parseSpace(v: unknown): SpaceAvailable | null {
  const s = norm(v);
  if (!s) return null;
  if (/^own/.test(s)) return 'Owned';
  if (/rent|lease/.test(s)) return 'Rented';
  if (/not|none|no |^no$|yet|search|looking|identif/.test(s)) return 'Not yet identified';
  return null;
}

export function parseFloor(v: unknown): Floor | null {
  const s = norm(v);
  if (!s) return null;
  if (/mall/.test(s)) return 'Mall unit';
  if (/ground|^gf$|^g$|street/.test(s)) return 'Ground';
  if (/upper|first|1st|second|2nd|third|3rd|top|above/.test(s)) return 'Upper';
  if (/not|unknown|^na$/.test(s)) return 'Not known';
  return null;
}

export function parseLanguage(v: unknown): Language | null {
  const s = norm(v);
  if (/kannada|^kn$|^kan$/.test(s)) return 'Kannada';
  if (/hindi|^hi$|^hin$/.test(s)) return 'Hindi';
  if (/english|^en$|^eng$/.test(s)) return 'English';
  return null;
}

const parseTier = (v: unknown): Tier | null => {
  const m = norm(v).match(/([123])/);
  return m ? (`Tier ${m[1]}` as Tier) : null;
};
const parsePriority = (v: unknown): Priority | null => {
  const s = norm(v);
  if (/^h|high/.test(s)) return 'High';
  if (/^m|med/.test(s)) return 'Medium';
  if (/^l|low/.test(s)) return 'Low';
  return null;
};

/** "City · State · Pin code" in one cell, separated by ·, comma or |. */
const splitCombined = (v: unknown) => String(v ?? '').split(/[·|,•]/).map((x) => x.trim()).filter(Boolean);

/* ---------------- Sheet detection ---------------- */

export interface SheetReport {
  kind: 'Applications' | 'Territories' | 'Existing stores';
  sheetName: string | null;
  found: boolean;
  rows: number;
  missingColumns: string[];
  builtIn: boolean;
}

export interface ParseReport {
  ok: boolean;
  sheets: SheetReport[];
  errors: string[];
  warnings: string[];
}

export const EXPECTED_COLUMNS: Record<SheetReport['kind'], string[]> = {
  Applications: ['Application ID', 'Applicant name', 'City', 'Pin code', 'Investment capacity (₹ lakh)', 'Retail experience (years)', 'Current / past business', 'Space available', 'Space size (sq ft)', 'Floor', 'Target launch (months)', 'Preferred language', 'Notes from applicant'],
  Territories: ['Territory ID', 'City', 'Pin codes covered', 'City tier', 'Open slots', 'Priority'],
  'Existing stores': ['Store ID', 'City', 'Pin code', 'Opened (year)'],
};

function findHeaderRow(rows: Row[], test: (h: string[]) => boolean): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) if (test(rows[i].map(norm))) return i;
  return -1;
}

const isAppHeader = (h: string[]) => h.some((x) => x.startsWith('application id') || x === 'app id') && h.some((x) => x.startsWith('investment'));
const isTerHeader = (h: string[]) => h.some((x) => x.startsWith('territory')) && h.some((x) => x.startsWith('pin'));
const isStoreHeader = (h: string[]) => h.some((x) => x.startsWith('store id')) && h.some((x) => x.startsWith('pin'));

const GREY = /^(F2F2F2|EEEEEE|EFEFEF|D9D9D9|F3F3F3|E7E6E6)$/i;
function isGreyRow(ws: WorkSheet, rowIdx: number, utils: Utils): boolean {
  const cell = ws[utils.encode_cell({ r: rowIdx, c: 0 })] as { s?: { fgColor?: { rgb?: string } } } | undefined;
  return !!cell?.s?.fgColor?.rgb && GREY.test(cell.s.fgColor.rgb);
}

interface Detected {
  name: string;
  ws: WorkSheet;
  rows: Row[];
  headerIdx: number;
  /** Absolute row index (0-based) of each data row, to check its fill. */
  firstDataIdx: number;
}

function detect(wb: WorkBook, utils: Utils) {
  const found: Partial<Record<SheetReport['kind'], Detected>> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = utils.sheet_to_json<Row>(ws, { header: 1, defval: null, blankrows: true, raw: true });
    const tests: Array<[SheetReport['kind'], (h: string[]) => boolean]> = [
      ['Applications', isAppHeader],
      ['Territories', isTerHeader],
      ['Existing stores', isStoreHeader],
    ];
    for (const [kind, test] of tests) {
      if (found[kind]) continue;
      const headerIdx = findHeaderRow(rows, test);
      if (headerIdx >= 0) {
        found[kind] = { name, ws, rows, headerIdx, firstDataIdx: headerIdx + 1 };
        break;
      }
    }
  }
  return found;
}

/* ---------------- Main ---------------- */

export function parseWorkbook(wb: WorkBook, utils: Utils, opts: { submittedAt: string }): { report: ParseReport; base: BaseData | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const found = detect(wb, utils);
  const sheets: SheetReport[] = [];

  /* ---- Applications ---- */
  const applications: Application[] = [];
  const A = found.Applications;
  if (!A) {
    errors.push('No Applications sheet found — one sheet needs an "Application ID" and an "Investment capacity" column.');
    sheets.push({ kind: 'Applications', sheetName: null, found: false, rows: 0, missingColumns: [], builtIn: false });
  } else {
    const cols = mapHeaders(A.rows[A.headerIdx], APP_HEADERS);
    const combined = cols.has('cityStatePin');
    const keyOf: Record<string, AppKey> = {
      'Application ID': 'id', 'Applicant name': 'name', City: 'city', 'Pin code': 'pin', 'Investment capacity (₹ lakh)': 'investment',
      'Retail experience (years)': 'experience', 'Current / past business': 'business', 'Space available': 'space', 'Space size (sq ft)': 'size',
      Floor: 'floor', 'Target launch (months)': 'launch', 'Preferred language': 'language', 'Notes from applicant': 'notes',
    };
    const missing = EXPECTED_COLUMNS.Applications.filter((c) => !(cols.has(keyOf[c]) || ((keyOf[c] === 'city' || keyOf[c] === 'pin') && combined)));
    const critical = new Set<AppKey>(['id', 'city', 'pin']);
    missing.forEach((c) =>
      (critical.has(keyOf[c]) ? errors : warnings).push(
        `Applications sheet is missing the "${c}" column${critical.has(keyOf[c]) ? '.' : ' — every row will be treated as blank for it.'}`,
      ),
    );
    const cell = (r: Row, k: AppKey) => (cols.has(k) ? r[cols.get(k)!] : null);
    const seen = new Set<string>();
    A.rows.slice(A.firstDataIdx).forEach((r, i) => {
      const rowNo = A.firstDataIdx + i + 1;
      const id = String(cell(r, 'id') ?? '').trim();
      if (!id) return;
      // The template's grey example row (row 3) — skip only when it is grey AND still the example.
      if (i === 0 && isGreyRow(A.ws, A.firstDataIdx, utils) && id === 'APP-001' && norm(cell(r, 'name')) === 'ravi kumar') {
        warnings.push('Skipped the grey example row (row 3) of the Applications sheet.');
        return;
      }
      if (seen.has(id)) {
        warnings.push(`Duplicate Application ID ${id} on row ${rowNo} — kept the first one.`);
        return;
      }
      seen.add(id);
      let cityRaw = cell(r, 'city');
      let pinRaw = cell(r, 'pin');
      if (combined) {
        const parts = splitCombined(cell(r, 'cityStatePin'));
        cityRaw = parts[0] ?? null;
        pinRaw = parts.find((p) => /\d{5,}/.test(p)) ?? null;
      }
      const pin = parsePin(pinRaw);
      let city = parseCity(cityRaw);
      if (!city) {
        const fromPin = cityOfPin(pin);
        city = fromPin ?? 'Bengaluru';
        warnings.push(`${id}: city "${cityRaw ?? ''}" isn't in the allowed list — ${fromPin ? `using ${fromPin} from the PIN` : 'assumed Bengaluru'}; flagged to confirm.`);
      }
      const space = parseSpace(cell(r, 'space'));
      if (!space) warnings.push(`${id}: "Space available" was blank or unclear — treated as "Not yet identified".`);
      const floor = parseFloor(cell(r, 'floor'));
      const language = parseLanguage(cell(r, 'language'));
      if (!language) warnings.push(`${id}: preferred language blank — using English.`);
      const size = parseNum(cell(r, 'size'));
      applications.push({
        id,
        name: String(cell(r, 'name') ?? '').trim() || id,
        city,
        state: 'Karnataka',
        pin,
        investmentLakh: parseLakh(cell(r, 'investment')),
        experienceYears: parseNum(cell(r, 'experience')),
        business: String(cell(r, 'business') ?? '').trim(),
        space: space ?? 'Not yet identified',
        spaceSqft: size,
        floor: floor ?? 'Not known',
        launchMonths: parseNum(cell(r, 'launch')),
        language: language ?? 'English',
        notes: String(cell(r, 'notes') ?? '').trim(),
        submittedAt: opts.submittedAt,
        // A city typed wrongly and recovered from the PIN must still be confirmed.
        ...(parseCity(cityRaw) ? {} : { cityRaw: String(cityRaw ?? '') }),
      });
    });
    if (!applications.length) errors.push(`The Applications sheet ("${A.name}") has no rows yet — add data below the header.`);
    sheets.push({ kind: 'Applications', sheetName: A.name, found: true, rows: applications.length, missingColumns: missing, builtIn: false });
  }

  /* ---- Territories ---- */
  const territories: Territory[] = [];
  const T = found.Territories;
  if (!T) {
    errors.push('No Territories sheet found — one sheet needs a "Territory ID" and a "Pin codes covered" column.');
    sheets.push({ kind: 'Territories', sheetName: null, found: false, rows: 0, missingColumns: [], builtIn: false });
  } else {
    const cols = mapHeaders(T.rows[T.headerIdx], TER_HEADERS);
    const combined = cols.has('cityState');
    const keyOf: Record<string, TerKey> = { 'Territory ID': 'id', City: 'city', 'Pin codes covered': 'pins', 'City tier': 'tier', 'Open slots': 'slots', Priority: 'priority' };
    const missing = EXPECTED_COLUMNS.Territories.filter((c) => !(cols.has(keyOf[c]) || (keyOf[c] === 'city' && combined)));
    const critical = new Set<TerKey>(['id', 'pins', 'slots']);
    missing.forEach((c) =>
      (critical.has(keyOf[c]) ? errors : warnings).push(
        `Territories sheet is missing the "${c}" column${critical.has(keyOf[c]) ? '.' : ' — a default is used for every row.'}`,
      ),
    );
    const cell = (r: Row, k: TerKey) => (cols.has(k) ? r[cols.get(k)!] : null);
    const seen = new Set<string>();
    T.rows.slice(T.firstDataIdx).forEach((r, i) => {
      const id = String(cell(r, 'id') ?? '').trim();
      if (!id) return;
      if (i === 0 && isGreyRow(T.ws, T.firstDataIdx, utils) && id === 'TER-01' && norm(cell(r, 'city')) === 'mysuru' && String(cell(r, 'pins') ?? '').replace(/\s/g, '') === '570001,570002,570008') {
        warnings.push('Skipped the grey example row (row 3) of the Territories sheet.');
        return;
      }
      if (seen.has(id)) {
        warnings.push(`Duplicate Territory ID ${id} — kept the first one.`);
        return;
      }
      seen.add(id);
      const cityRaw = combined ? splitCombined(cell(r, 'cityState'))[0] : cell(r, 'city');
      const pins = String(cell(r, 'pins') ?? '').split(/[\s,;|/]+/).map((p) => p.trim()).filter(Boolean);
      const badPins = pins.filter((p) => !/^\d{6}$/.test(p));
      if (badPins.length) warnings.push(`${id}: ignored pin code(s) that aren't 6 digits: ${badPins.join(', ')}.`);
      const goodPins = pins.filter((p) => /^\d{6}$/.test(p));
      const city = parseCity(cityRaw) ?? (goodPins[0] ? cityOfPin(goodPins[0]) : null);
      if (!city) {
        warnings.push(`${id}: city "${cityRaw ?? ''}" isn't in the allowed list — territory skipped.`);
        return;
      }
      if (!goodPins.length) warnings.push(`${id}: no valid pin codes — no applicant can match it.`);
      const tier = parseTier(cell(r, 'tier')) ?? (`Tier ${CITY_INFO[city].tier}` as Tier);
      const slots = parseNum(cell(r, 'slots'));
      if (slots === null) warnings.push(`${id}: open slots blank — treated as 0.`);
      const priority = parsePriority(cell(r, 'priority'));
      if (!priority) warnings.push(`${id}: priority blank or unclear — treated as Low.`);
      const name = String(cell(r, 'name') ?? '').trim();
      territories.push({
        id, name: name || `${city} · ${id}`, city, state: 'Karnataka', pins: goodPins.length ? goodPins : [], tier,
        openSlots: Math.max(0, Math.round(slots ?? 0)), priority: priority ?? 'Low',
      });
    });
    if (!territories.length) errors.push(`The Territories sheet ("${T.name}") has no rows yet — add data below the header.`);
    sheets.push({ kind: 'Territories', sheetName: T.name, found: true, rows: territories.length, missingColumns: missing, builtIn: false });
  }

  /* ---- Existing stores (built-in when absent) ---- */
  let stores: Store[] = BUILT_IN_STORES;
  const S = found['Existing stores'];
  if (S) {
    const cols = mapHeaders(S.rows[S.headerIdx], STORE_HEADERS);
    const read: Store[] = [];
    S.rows.slice(S.firstDataIdx).forEach((r) => {
      const id = String(r[cols.get('id') ?? 0] ?? '').trim();
      const pin = parsePin(r[cols.get('pin') ?? 2]);
      const city = parseCity(r[cols.get('city') ?? 1]) ?? cityOfPin(pin);
      if (!id || !city || !/^\d{6}$/.test(pin)) return;
      read.push({ id, city, pin, openedYear: parseNum(r[cols.get('opened') ?? 3]) ?? 0 });
    });
    if (read.length) stores = read;
    sheets.push({ kind: 'Existing stores', sheetName: S.name, found: true, rows: stores.length, missingColumns: [], builtIn: !read.length });
  } else {
    sheets.push({ kind: 'Existing stores', sheetName: null, found: false, rows: stores.length, missingColumns: [], builtIn: true });
  }

  const fatal = errors.length > 0 || !applications.length || !territories.length;
  const report: ParseReport = { ok: !fatal, sheets, errors, warnings };
  return { report, base: fatal ? null : { applications, territories, stores, parseWarnings: warnings } };
}
