import { engine } from '@/engine';
import { useData } from '@/store/data';
import { useFilters } from '@/store/filters';

export async function loadDataset(source: 'sample' | File) {
  const ds = await engine.loadDataset(source);
  useData.getState().setLoaded(ds.source, ds.fileName);
  return ds;
}

/** Back to pristine fixtures: drops applied what-ifs, filters and simulation history. */
export async function resetDemo() {
  await engine.reset();
  useFilters.getState().reset();
  useData.getState().clear();
}
