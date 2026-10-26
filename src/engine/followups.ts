/**
 * Follow-ups (Build Spec §16): rule-based parser for plain-language questions and updates.
 * Finds the Application / Territory ID, the field keywords and the values. Vague updates apply what is stated
 * and assume the LESS favourable option for anything missing — and say so.
 */
import type { AppField, AppResult, OverrideValue, TerritoryField } from './model';
import { parseFloor, parseLakh } from './parse';
import type { Application, Floor, Language, Priority, SpaceAvailable } from './types';

export interface Change {
  target: 'app' | 'territory';
  id: string;
  field: AppField | TerritoryField;
  value: OverrideValue;
  label: string;
}

export type Parsed =
  | { kind: 'question'; intent: 'why' | 'next' | 'compare' | 'territory' | 'summary'; appIds: string[]; territoryId?: string }
  | { kind: 'whatif' | 'update'; appIds: string[]; territoryId?: string; changes: Change[]; assumptions: string[] }
  | { kind: 'unknown'; appIds: string[]; territoryId?: string };

const pad = (n: string, w: number) => n.padStart(w, '0');

export function findIds(text: string, apps: Application[]): { appIds: string[]; territoryId?: string } {
  const appIds = [...text.matchAll(/\bAPP[-\s_]?(\d{1,4})\b/gi)].map((m) => `APP-${pad(m[1], 3)}`);
  const ter = text.match(/\bTER[-\s_]?(\d{1,3})\b/i);
  if (!appIds.length) {
    const low = text.toLowerCase();
    const byName = apps.filter((a) => a.name.length > 3 && low.includes(a.name.toLowerCase())).map((a) => a.id);
    appIds.push(...byName);
  }
  return { appIds: [...new Set(appIds)].filter((id) => apps.some((a) => a.id === id)), territoryId: ter ? `TER-${pad(ter[1], 2)}` : undefined };
}

const has = (t: string, re: RegExp) => re.test(t);

function sizeOf(t: string): number | null {
  const m = t.match(/(\d{2,5}(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sq\s*feet|square\s*f(?:ee|oo)t|sft|sq)/i);
  return m ? Number(m[1]) : null;
}
function monthsOf(t: string): number | null {
  const m = t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:months?|mo\b|mths?)/i);
  return m ? Number(m[1]) : null;
}
function yearsOf(t: string): number | null {
  const m = t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  return m ? Number(m[1]) : null;
}
function moneyOf(t: string): number | null {
  const m = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac|l\b|cr|crore)?/i);
  if (!m) return null;
  return parseLakh(`${m[1]} ${m[2] ?? 'lakh'}`);
}
const pinOf = (t: string) => t.match(/\b(5[6-9]\d{4})\b/)?.[1] ?? null;
const langOf = (t: string): Language | null => (/kannada/i.test(t) ? 'Kannada' : /hindi/i.test(t) ? 'Hindi' : /english/i.test(t) ? 'English' : null);
const prioOf = (t: string): Priority | null => (/\bhigh\b/i.test(t) ? 'High' : /\bmedium\b|\bmed\b/i.test(t) ? 'Medium' : /\blow\b/i.test(t) ? 'Low' : null);

/** Extracts field changes for one applicant from an update sentence. */
export function extractChanges(text: string, app: Application, result?: AppResult): { changes: Change[]; assumptions: string[] } {
  const t = text.toLowerCase();
  const changes: Change[] = [];
  const assumptions: string[] = [];
  const add = (field: AppField, value: Change['value'], label: string) => changes.push({ target: 'app', id: app.id, field, value, label });

  const spaceNoun = /\b(space|shop|premises|unit|property|store|location|place|outlet|showroom)\b/;
  const foundVerb = /\b(found|finds|find|secured|secures|got|gets|has|have|identified|signed|leased|rented|bought|purchased|taken|took|now has)\b/;
  const floor: Floor | null = /\bmall\b/.test(t) ? 'Mall unit' : /ground[-\s]?floor|\bground\b|street[-\s]?level/.test(t) ? 'Ground' : /upper|first[-\s]?floor|1st floor|second floor|2nd floor|\babove\b/.test(t) ? 'Upper' : null;
  const size = sizeOf(t);
  const spaceTalk = has(t, spaceNoun) && (has(t, foundVerb) || floor !== null || size !== null);

  if (spaceTalk) {
    const owned = /\b(own|owns|owned|bought|purchased|family|our own|my own)\b/.test(t);
    const rented = /\b(rent|rented|lease|leased|renting)\b/.test(t);
    const newSpace: SpaceAvailable = owned ? 'Owned' : rented ? 'Rented' : app.space !== 'Not yet identified' ? app.space : 'Rented';
    if (newSpace !== app.space) {
      add('space', newSpace, `space → ${newSpace}${!owned && !rented ? ' (assumed)' : ''}`);
      if (!owned && !rented) assumptions.push('Ownership not stated — assumed Rented (the less favourable option).');
    }
    if (floor) {
      if (floor !== app.floor) add('floor', floor, `floor → ${floor}`);
    } else if (app.space === 'Not yet identified' || newSpace !== app.space) {
      add('floor', 'Not known', 'floor → not known (assumed)');
      assumptions.push('Floor not stated — treated as not known, so we will ask for it.');
    }
    if (size !== null) add('spaceSqft', size, `size → ${size} sq ft`);
    else if (app.space === 'Not yet identified' || newSpace !== app.space) {
      add('spaceSqft', null, 'size → unknown (assumed)');
      assumptions.push('Size not stated — kept blank, so the applicant is asked to share it (7-day hold).');
    }
    const pin = pinOf(t);
    if (pin && pin !== app.pin) add('pin', pin, `pin → ${pin} (re-checks territory, pin and nearby stores)`);
  } else {
    if (size !== null && /\b(size|sq|sqft|feet|ft|area)\b/.test(t)) add('spaceSqft', size, `size → ${size} sq ft`);
    if (floor && /\bfloor|mall|ground|level\b/.test(t)) add('floor', floor, `floor → ${floor}`);
    const pin = pinOf(t);
    if (pin && pin !== app.pin && /\b(pin|moved|move|relocat|location|address)\b/.test(t)) add('pin', pin, `pin → ${pin}`);
  }

  if (/\b(invest|investment|capacity|budget|fund|funds|funding|capital|money)\b/.test(t)) {
    const m = t.replace(/\bapp[-\s]?\d+\b/g, '').replace(/\b5[6-9]\d{4}\b/g, '');
    const amt = moneyOf(m.slice(Math.max(0, m.search(/invest|capacity|budget|fund|capital|money/))));
    if (amt !== null && amt !== app.investmentLakh) add('investmentLakh', amt, `investment → ₹${amt}L`);
  }
  if (/\b(experience|years? (of|in) retail|worked|running)\b/.test(t)) {
    const y = yearsOf(t);
    if (y !== null && y !== app.experienceYears) add('experienceYears', y, `experience → ${y} yrs`);
  }
  if (/\b(launch|open|opening|start)\b/.test(t) && !spaceTalk) {
    const mo = monthsOf(t);
    if (mo !== null && mo !== app.launchMonths) add('launchMonths', mo, `target launch → ${mo} months`);
  }
  if (/\b(language|prefer|training in|speak)\b/.test(t)) {
    const l = langOf(t);
    if (l && l !== app.language) add('language', l, `language → ${l}`);
  }
  if (/confirm(ed|s)?\b.*\b(location|pin|city|address)|\b(location|pin|city|address)\b.*\bconfirm(ed)?/.test(t)) add('locationConfirmed', true, 'location confirmed');

  const offered = result?.slotPin && result.outcome === 'REDIRECT_RESERVED' ? result.slotPin : '';
  if (/\baccept(ed|s)?\b/.test(t) && /\b(redirect|offer|new pin|pin|location)\b/.test(t)) add('redirect', `accepted:${offered}`, `redirect to ${offered || 'new pin'} accepted`);
  if (/\b(declin|refus|turned down|rejected the (offer|redirect))/.test(t)) add('redirect', `declined:${offered}`, `redirect to ${offered || 'new pin'} declined`);
  if (/\bmissed\b.*\bdeadline|\bdeadline\b.*\bmissed|did ?n[o']t .*(in time|deadline|secure)/.test(t)) add('deadline', 'missed', 'deadline missed');
  else if (/\b(met|meets|meet)\b.*\bdeadline|\bspace (is )?verified|\bverified the space/.test(t)) add('deadline', 'met', 'deadline met / space verified');
  if (/\bextend/.test(t)) add('deadline', 'extend', 'deadline extended by 7 days');
  if (/\b(withdr(ew|awn|aw|awing)|pull(ed)? out|dropp(ed)? out|no longer interested|backed out|cancel(led)? (the )?application)\b/.test(t)) add('withdrawn', true, 'application withdrawn');

  return { changes, assumptions };
}

function extractTerritoryChanges(text: string, territoryId: string): Change[] {
  const t = text.toLowerCase();
  const out: Change[] = [];
  const slots = t.match(/(\d{1,2})\s*(?:open\s*)?slots?|slots?\s*(?:to|=|:|is|are|now)?\s*(\d{1,2})/);
  if (slots) {
    const n = Number(slots[1] ?? slots[2]);
    out.push({ target: 'territory', id: territoryId, field: 'openSlots', value: n, label: `${territoryId} open slots → ${n}` });
  }
  if (/priority/.test(t)) {
    const p = prioOf(t);
    if (p) out.push({ target: 'territory', id: territoryId, field: 'priority', value: p, label: `${territoryId} priority → ${p}` });
  }
  return out;
}

export function parseFollowUp(text: string, apps: Application[], results: AppResult[]): Parsed {
  const t = text.trim();
  const low = t.toLowerCase();
  const { appIds, territoryId } = findIds(t, apps);
  const isWhatIf = /^\s*(what if|what would happen|suppose|imagine|if\b)|\bwould (it|they|he|she) (be|get|change)/i.test(t);
  const isQuestion = /\?\s*$/.test(t) || /^(why|how|what|who|which|when|where|is|are|does|do|can|show|list|tell|explain|compare)\b/i.test(t);

  // Territory-level changes ("TER-03 now has 3 slots", "make TER-07 high priority")
  if (territoryId && !appIds.length && !isQuestion) {
    const ch = extractTerritoryChanges(t, territoryId);
    if (ch.length) return { kind: 'update', appIds, territoryId, changes: ch, assumptions: [] };
  }
  if (territoryId && !appIds.length && isWhatIf) {
    const ch = extractTerritoryChanges(t, territoryId);
    if (ch.length) return { kind: 'whatif', appIds, territoryId, changes: ch, assumptions: [] };
  }

  if (appIds.length && (isWhatIf || !isQuestion)) {
    const app = apps.find((a) => a.id === appIds[0])!;
    const { changes, assumptions } = extractChanges(t, app, results.find((r) => r.id === app.id));
    if (changes.length) return { kind: isWhatIf ? 'whatif' : 'update', appIds, territoryId, changes, assumptions };
  }

  if (/\bcompare\b|\bvs\.?\b|\bversus\b|difference between/.test(low) && appIds.length >= 2) return { kind: 'question', intent: 'compare', appIds };
  if (/\b(next|what should|what does .* need|what do .* need|to do|steps?|how (can|do) .* (improve|get approved))\b/.test(low) && appIds.length) return { kind: 'question', intent: 'next', appIds };
  if (appIds.length) return { kind: 'question', intent: 'why', appIds };
  if (territoryId) return { kind: 'question', intent: 'territory', appIds, territoryId };
  if (/\b(how many|summary|overview|counts?|totals?|status of all|where do we stand|stats?)\b/.test(low)) return { kind: 'question', intent: 'summary', appIds };
  return { kind: 'unknown', appIds, territoryId };
}

export const ALLOWED_APP_FIELDS: AppField[] = ['space', 'spaceSqft', 'floor', 'pin', 'investmentLakh', 'experienceYears', 'launchMonths', 'language', 'locationConfirmed', 'redirect', 'deadline', 'withdrawn'];

/** Validate a change proposed by Gemini before it is applied — the model never writes anything unchecked. */
export function sanitizeChange(c: { field: string; value: unknown }, app: Application, result?: AppResult): Change | null {
  const f = c.field as AppField;
  if (!ALLOWED_APP_FIELDS.includes(f)) return null;
  const v = c.value;
  const mk = (value: Change['value'], label: string): Change => ({ target: 'app', id: app.id, field: f, value, label });
  switch (f) {
    case 'space':
      return ['Owned', 'Rented', 'Not yet identified'].includes(String(v)) ? mk(String(v), `space → ${v}`) : null;
    case 'floor': {
      const fl = parseFloor(v);
      return fl ? mk(fl, `floor → ${fl}`) : null;
    }
    case 'spaceSqft':
      return v === null ? mk(null, 'size → unknown') : Number.isFinite(Number(v)) && Number(v) > 0 ? mk(Number(v), `size → ${Number(v)} sq ft`) : null;
    case 'pin':
      return /^\d{6}$/.test(String(v)) ? mk(String(v), `pin → ${v}`) : null;
    case 'investmentLakh': {
      const n = parseLakh(v);
      return n !== null && n > 0 ? mk(n, `investment → ₹${n}L`) : null;
    }
    case 'experienceYears':
    case 'launchMonths':
      return Number.isFinite(Number(v)) && Number(v) >= 0 ? mk(Number(v), `${f === 'experienceYears' ? 'experience' : 'target launch'} → ${Number(v)}`) : null;
    case 'language':
      return ['Kannada', 'English', 'Hindi'].includes(String(v)) ? mk(String(v), `language → ${v}`) : null;
    case 'locationConfirmed':
    case 'withdrawn':
      return v === true ? mk(true, f === 'withdrawn' ? 'application withdrawn' : 'location confirmed') : null;
    case 'redirect': {
      const s = String(v);
      const offered = result?.slotPin ?? '';
      return s.startsWith('accept') ? mk(`accepted:${offered}`, 'redirect accepted') : s.startsWith('declin') ? mk(`declined:${offered}`, 'redirect declined') : null;
    }
    case 'deadline':
      return ['met', 'missed', 'extend'].includes(String(v)) ? mk(String(v), `deadline ${v}`) : null;
    default:
      return null;
  }
}
