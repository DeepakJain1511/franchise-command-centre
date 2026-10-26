import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';

/** Right slide-over on tablet/desktop, bottom sheet on phones. */
export function SideDrawer({
  open, onOpenChange, title, description, children, footer, width = 'sm:w-[560px]',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          className={cn(
            'fixed z-[70] flex flex-col bg-surface shadow-pop outline-none duration-200',
            'inset-x-0 bottom-0 max-h-[90vh] rounded-t-lg border-t',
            'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:rounded-none sm:rounded-l-lg sm:border-l sm:border-t-0',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:data-[state=open]:slide-in-from-right sm:data-[state=open]:slide-in-from-bottom-0',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom sm:data-[state=closed]:slide-out-to-right sm:data-[state=closed]:slide-out-to-bottom-0',
            width,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 border-b px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description asChild>
                  <div className="mt-0.5 text-xs text-muted">{description}</div>
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Details</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="iconSm" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
          {footer && <div className="border-t bg-surface px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
