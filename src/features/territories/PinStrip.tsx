import type { PinState } from '@/engine/types';
import { useColors } from '@/lib/hooks';
import { PIN_META } from '@/lib/tokens';
import { Tooltip } from '@/components/ui/overlay';

/** Mini strip of hexagons, one per PIN, coloured by PIN state. */
export function PinStrip({ pins, size = 14 }: { pins: PinState[]; size?: number }) {
  const c = useColors();
  const h = size * 1.08;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="PIN states">
      {pins.map((p) => {
        const m = PIN_META[p.status];
        const fill = p.status === 'full' ? c('subtle', 0.3) : c(m.token, p.status === 'outside' ? 0.6 : 0.85);
        return (
          <li key={p.pin}>
            <Tooltip content={<span className="tnum">{p.pin} · {m.label}{p.applicantIds.length ? ` · ${p.applicantIds.length} applicant${p.applicantIds.length > 1 ? 's' : ''}` : ''}</span>}>
              <span className="block" tabIndex={0} aria-label={`${p.pin}: ${m.label}`}>
                <svg width={size} height={h} viewBox="0 0 12 13" aria-hidden>
                  <path d="M6 0.5 11.2 3.5v6L6 12.5 0.8 9.5v-6z" fill={fill} />
                </svg>
              </span>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
