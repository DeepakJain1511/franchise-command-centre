import { addDays, parseISO } from 'date-fns';
import { History, Pause, Play, Radio } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlay';
import { cn } from '@/lib/cn';
import { DEMO_TODAY, fmtDate, iso } from '@/lib/time';
import { create } from 'zustand';
import { useMapUi, type MapModel } from './model';

const usePlay = create<{ playing: boolean; set: (p: boolean) => void }>((set) => ({ playing: false, set: (playing) => set({ playing }) }));

/** "Watch the network grow": replay applications and planned stores week by week. */
export function TimeLapse({ model }: { model: MapModel }) {
  const asOf = useMapUi((s) => s.asOf);
  const setAsOf = useMapUi((s) => s.setAsOf);
  const playing = usePlay((s) => s.playing);
  const setPlaying = usePlay((s) => s.set);

  const days = useMemo(() => {
    const first = model.rows.map((r) => r.app.submittedAt).sort()[0];
    const out: string[] = [];
    for (let d = addDays(parseISO(first), -7); d <= DEMO_TODAY; d = addDays(d, 7)) out.push(iso(d));
    out.push(iso(DEMO_TODAY));
    return out;
  }, [model.rows]);

  const idx = asOf ? Math.max(0, days.findIndex((d) => d >= asOf)) : days.length - 1;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const cur = useMapUi.getState().asOf;
      const i = cur ? days.findIndex((d) => d >= cur) : -1;
      const next = i + 1;
      if (next >= days.length - 1) {
        setAsOf(null);
        setPlaying(false);
      } else setAsOf(days[next]);
    }, 550);
    return () => window.clearInterval(id);
  }, [playing, days, setAsOf, setPlaying]);

  // Leaving the map resets the replay
  useEffect(() => () => {
    setPlaying(false);
    setAsOf(null);
  }, [setAsOf, setPlaying]);

  const live = asOf === null;
  return (
    <div className="absolute left-1/2 top-14 z-[500] flex lg:top-3 w-[min(460px,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-full border bg-surface/95 py-1.5 pl-1.5 pr-4 shadow-lift backdrop-blur">
      <Tooltip content={playing ? 'Pause' : 'Replay how the network grew'}>
        <Button
          variant="primary"
          size="iconSm"
          className="h-8 w-8 shrink-0 rounded-full"
          aria-label={playing ? 'Pause time-lapse' : 'Play time-lapse'}
          onClick={() => {
            if (!playing && live) setAsOf(days[0]);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause /> : <Play className="translate-x-px" />}
        </Button>
      </Tooltip>
      <div className="min-w-0 flex-1">
        <Slider
          min={0}
          max={days.length - 1}
          step={1}
          value={[idx]}
          onValueChange={([v]) => {
            setPlaying(false);
            setAsOf(v >= days.length - 1 ? null : days[v]);
          }}
          thumbLabel="Time-lapse date"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          setAsOf(null);
        }}
        className={cn('flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium tnum focus-ring', live ? 'text-st-approved' : 'text-muted hover:text-fg')}
        aria-label={live ? 'Showing today' : 'Back to today'}
      >
        {live ? <Radio className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
        {live ? 'Today' : fmtDate(days[idx])}
      </button>
    </div>
  );
}
