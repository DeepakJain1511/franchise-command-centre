import { engine } from '@/engine';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';
import { setDemoDay } from '@/lib/time';

export async function loadDataset(source: 'sample' | File) {
  const ds = await engine.loadDataset(source);
  useData.getState().setLoaded(ds.source, ds.fileName);
  return ds;
}

/** Back to pristine fixtures: drops applied what-ifs, filters and simulation history. */
export async function resetDemo() {
  await engine.reset();
  setDemoDay(0);
  useFilters.getState().reset();
  useData.getState().clear();
}

/** Move the demo clock (time slider). Every screen refetches. */
export async function setDemoDayAction(day: number) {
  await engine.setDay(day);
  setDemoDay(engine.getDay());
  useData.getState().bump();
}

/** Read an uploaded workbook and report sheets, rows, missing columns and fixable problems. */
export async function inspectUpload(file: File) {
  return (await engine.inspectFile(file)).report;
}

/** First visit → sample data. Refresh / second tab → keep this browser's working copy (follow-ups, slider, chats). */
export async function ensureLoaded() {
  const info = engine.sessionInfo();
  if (info.restored) useData.getState().setLoaded(info.source, info.fileName);
  else await loadDataset('sample');
}
