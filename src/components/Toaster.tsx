import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUi } from '@/store/ui';

const ICON = { default: Info, success: CheckCircle2, warning: TriangleAlert };
const TONE = { default: 'text-brand', success: 'text-st-approved', warning: 'text-st-hold' };

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[120] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone ?? 'default'];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-md border bg-surface px-3 py-2.5 text-sm shadow-pop"
              role="status"
            >
              <Icon className={cn('h-4 w-4 shrink-0', TONE[t.tone ?? 'default'])} aria-hidden />
              <span className="flex-1">{t.title}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg focus-ring" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
