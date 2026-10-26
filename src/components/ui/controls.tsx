import * as Sw from '@radix-ui/react-switch';
import * as Sl from '@radix-ui/react-slider';
import * as Tg from '@radix-ui/react-toggle-group';
import * as A from '@radix-ui/react-accordion';
import * as Tb from '@radix-ui/react-tabs';
import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------- Switch / Slider ---------------- */
export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border transition-colors focus-ring data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-surface shadow-soft transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </Sw.Root>
  );
}

export function Slider({ className, thumbLabel = 'Value', ...props }: ComponentPropsWithoutRef<typeof Sl.Root> & { thumbLabel?: string }) {
  return (
    <Sl.Root className={cn('relative flex w-full touch-none select-none items-center py-1.5', className)} {...props}>
      <Sl.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-raised">
        <Sl.Range className="absolute h-full bg-brand" />
      </Sl.Track>
      <Sl.Thumb className="block h-4 w-4 rounded-full border-2 border-brand bg-surface shadow-soft focus-ring" aria-label={thumbLabel} />
    </Sl.Root>
  );
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({
  value, onChange, options, className, ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode; title?: string }>;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Tg.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn('inline-flex items-center rounded-md border bg-raised p-0.5', className)}
    >
      {options.map((o) => (
        <Tg.Item
          key={o.value}
          value={o.value}
          title={o.title}
          aria-label={o.title}
          className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg focus-ring data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-soft [&_svg]:size-3.5"
        >
          {o.icon}
          {o.label}
        </Tg.Item>
      ))}
    </Tg.Root>
  );
}

/* ---------------- Accordion ---------------- */
export const Accordion = A.Root;
export const AccordionItem = A.Item;
export const AccordionTrigger = forwardRef<ElementRef<typeof A.Trigger>, ComponentPropsWithoutRef<typeof A.Trigger>>(
  ({ className, children, ...props }, ref) => (
    <A.Header className="flex">
      <A.Trigger
        ref={ref}
        className={cn(
          'group flex flex-1 items-center justify-between gap-2 py-2 text-sm font-medium text-muted transition-colors hover:text-fg focus-ring',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </A.Trigger>
    </A.Header>
  ),
);
AccordionTrigger.displayName = 'AccordionTrigger';
export const AccordionContent = forwardRef<ElementRef<typeof A.Content>, ComponentPropsWithoutRef<typeof A.Content>>(
  ({ className, children, ...props }, ref) => (
    <A.Content ref={ref} className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0" {...props}>
      <div className={cn('pb-3', className)}>{children}</div>
    </A.Content>
  ),
);
AccordionContent.displayName = 'AccordionContent';

/* ---------------- Tabs ---------------- */
export const Tabs = Tb.Root;
export const TabsList = forwardRef<ElementRef<typeof Tb.List>, ComponentPropsWithoutRef<typeof Tb.List>>(({ className, ...props }, ref) => (
  <Tb.List ref={ref} className={cn('flex items-center gap-1 overflow-x-auto border-b scrollbar-thin', className)} {...props} />
));
TabsList.displayName = 'TabsList';
export const TabsTrigger = forwardRef<ElementRef<typeof Tb.Trigger>, ComponentPropsWithoutRef<typeof Tb.Trigger>>(({ className, ...props }, ref) => (
  <Tb.Trigger
    ref={ref}
    className={cn(
      'relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 pb-2 pt-1 text-sm font-medium text-muted transition-colors hover:text-fg focus-ring data-[state=active]:border-brand data-[state=active]:text-fg [&_svg]:size-3.5',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = forwardRef<ElementRef<typeof Tb.Content>, ComponentPropsWithoutRef<typeof Tb.Content>>(({ className, ...props }, ref) => (
  <Tb.Content ref={ref} className={cn('outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';

/* ---------------- Select ---------------- */
export function Select<T extends string>({
  value, onChange, options, className, ariaLabel, placeholder,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <S.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-sm shadow-soft focus-ring data-[placeholder]:text-subtle',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="h-4 w-4 text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-[95] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-surface shadow-pop"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none data-[highlighted]:bg-raised"
              >
                <S.ItemIndicator className="absolute left-2">
                  <Check className="h-3.5 w-3.5 text-brand" />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

/* ---------------- Small bits ---------------- */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 items-center rounded border bg-raised px-1.5 font-sans text-2xs font-medium text-muted', className)}>
      {children}
    </kbd>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />;
}
