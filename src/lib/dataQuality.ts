import type { Application, DataFlag, Store, Territory } from '@/engine/types';

const CITY_PREFIX: Record<string, string> = {
  Bengaluru: '560',
  Mysuru: '570',
  Mangaluru: '575',
  'Hubballi-Dharwad': '580',
  Belagavi: '590',
  Tumakuru: '572',
  Davanagere: '577',
};

/**
 * Data-quality checks on the raw submitted row (validation, NOT a decision rule).
 * Used to show friendly flags next to messy fields and in the upload summary.
 */
export function dataFlagsFor(app: Application, territories: Territory[], stores: Store[]): DataFlag[] {
  const flags: DataFlag[] = [];
  if (app.space !== 'Not yet identified' && app.spaceSqft == null) flags.push({ field: 'spaceSqft', label: 'Space size missing' });
  if (app.space === 'Not yet identified' && app.floor !== 'Not known') flags.push({ field: 'floor', label: 'Floor given, no space yet' });
  if (app.space === 'Not yet identified' && app.launchMonths <= 1) flags.push({ field: 'launchMonths', label: 'Launch in 1 month, no space' });
  if (app.experienceYears === 0 && app.investmentLakh >= 100) flags.push({ field: 'experienceYears', label: 'No experience, large capacity' });
  if (!app.business.trim()) flags.push({ field: 'business', label: 'Business background blank' });
  if (app.spaceSqft != null && app.spaceSqft < 200) flags.push({ field: 'spaceSqft', label: 'Very small space' });
  if (CITY_PREFIX[app.city] && !app.pin.startsWith(CITY_PREFIX[app.city])) flags.push({ field: 'pin', label: 'PIN does not match city' });
  if (stores.some((s) => s.pin === app.pin)) flags.push({ field: 'pin', label: 'PIN already has a store' });
  else if (!territories.some((t) => t.pins.includes(app.pin))) flags.push({ field: 'pin', label: 'PIN outside territories' });
  return flags;
}
