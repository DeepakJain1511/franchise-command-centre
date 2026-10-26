import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';

/**
 * Photo: "People walk down a narrow street lined with shops" by ABHIRAM PH on Unsplash
 * (Unsplash License, free to use). Served from Unsplash's image CDN, as they recommend.
 */
const PHOTO = 'https://images.unsplash.com/photo-1777802059614-2d892adb2de6';
const PHOTO_PAGE = 'https://unsplash.com/photos/people-walk-down-a-narrow-street-lined-with-shops-X-rZE9BVXDs';
const AUTHOR_PAGE = 'https://unsplash.com/@abhi_ram_7';

/** Full-bleed retail-street photo under a soft wash, with a gentle mouse parallax. */
export function StartBackdrop() {
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const x = useTransform(sx, (v) => v * -18);
  const y = useTransform(sy, (v) => v * -12);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [mx, my, reduced]);

  const w = typeof window !== 'undefined' && window.innerWidth > 1600 ? 2400 : 1600;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.img
          src={`${PHOTO}?auto=format&fit=crop&w=${w}&q=70`}
          alt=""
          onLoad={() => setLoaded(true)}
          style={{ x, y }}
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: loaded ? 1 : 0, scale: 1.08 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* dark gradient on the left keeps the headline readable; the photo stays vivid on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#121a22]/90 via-[#121a22]/60 to-[#121a22]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121a22]/70 via-transparent to-[#121a22]/30" />
      </div>
      <p className="fixed bottom-3 left-5 z-10 text-[10px] text-white/55 md:left-10">
        Photo:{' '}
        <a href={AUTHOR_PAGE} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">
          ABHIRAM PH
        </a>{' '}
        on{' '}
        <a href={PHOTO_PAGE} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">
          Unsplash
        </a>
      </p>
    </>
  );
}
