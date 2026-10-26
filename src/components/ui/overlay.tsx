import * as T from '@radix-ui/react-tooltip';
import * as P from '@radix-ui/react-popover';
import * as D from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------- Tooltip ---------------- */
export const TooltipProvider = T.Provider;

export function Tooltip({
  content, children, side = 'top', className,
}: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; className?: string }) {
  if (!content) return <>{children}</>;
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[100] max-w-xs rounded-md border bg-surface px-2.5 py-1.5 text-xs text-fg shadow-pop data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ---------------- Popover ---------------- */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export const PopoverContent = forwardRef<ElementRef<typeof P.Content>, ComponentPropsWithoutRef<typeof P.Content>>(
  ({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
    <P.Portal>
      <P.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[90] w-72 rounded-md border bg-surface p-3 text-fg shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </P.Portal>
  ),
);
PopoverContent.displayName = 'PopoverContent';

/* ---------------- Dropdown ---------------- */
export const DropdownMenu = D.Root;
export const DropdownMenuTrigger = D.Trigger;
export const DropdownMenuSeparator = () => <D.Separator className="-mx-1 my-1 h-px bg-border" />;
export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => <D.Label className="label px-2 py-1.5">{children}</D.Label>;

export const DropdownMenuContent = forwardRef<ElementRef<typeof D.Content>, ComponentPropsWithoutRef<typeof D.Content>>(
  ({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
    <D.Portal>
      <D.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-[90] min-w-[11rem] rounded-md border bg-surface p-1 text-fg shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </D.Portal>
  ),
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<ElementRef<typeof D.Item>, ComponentPropsWithoutRef<typeof D.Item>>(({ className, ...props }, ref) => (
  <D.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-raised data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuCheckboxItem = forwardRef<ElementRef<typeof D.CheckboxItem>, ComponentPropsWithoutRef<typeof D.CheckboxItem>>(
  ({ className, children, ...props }, ref) => (
    <D.CheckboxItem
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none data-[highlighted]:bg-raised',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <D.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-brand" />
        </D.ItemIndicator>
      </span>
      {children}
    </D.CheckboxItem>
  ),
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';
