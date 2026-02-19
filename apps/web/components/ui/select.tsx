'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@/lib/utils/cn';
import { ChevronDown } from 'lucide-react';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  hideChevron?: boolean;
}

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, hideChevron = false, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    data-radix-select-trigger=""
    className={cn(
      'flex h-10 w-full min-w-0 overflow-hidden items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate [&>span]:whitespace-nowrap',
      className,
    )}
    {...props}
  >
    <div className="flex min-w-0 flex-1 items-center">
      {children}
    </div>
    {!hideChevron && (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </SelectPrimitive.Icon>
    )}
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Measure trigger width when content is mounted/opened
  React.useEffect(() => {
    const measureTrigger = () => {
      // Find the trigger that is currently open (has aria-expanded="true")
      const openTrigger = document.querySelector('[data-radix-select-trigger][aria-expanded="true"]') as HTMLElement;
      if (openTrigger) {
        const rect = openTrigger.getBoundingClientRect();
        setTriggerWidth(rect.width);
      } else {
        // Fallback: find any trigger in the same Select context
        // Radix sets data-radix-select-trigger on the trigger
        const trigger = document.querySelector('[data-radix-select-trigger]') as HTMLElement;
        if (trigger) {
          const rect = trigger.getBoundingClientRect();
          setTriggerWidth(rect.width);
        }
      }
    };

    // Measure immediately
    measureTrigger();

    // Also measure after a short delay to ensure DOM is ready
    const timeout1 = setTimeout(measureTrigger, 50);
    const timeout2 = setTimeout(measureTrigger, 200);

    // Listen for when Select opens (Radix sets aria-expanded)
    const observer = new MutationObserver(() => {
      measureTrigger();
    });

    // Observe all triggers for aria-expanded changes
    const triggers = document.querySelectorAll('[data-radix-select-trigger]');
    triggers.forEach((trigger) => {
      observer.observe(trigger, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
      });
    });

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      observer.disconnect();
    };
  }, []);

  // Combine refs
  React.useImperativeHandle(ref, () => contentRef.current as any, []);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={contentRef}
        className={cn(
          'relative z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
          className,
        )}
        style={{
          ...(triggerWidth ? { width: `${triggerWidth}px`, minWidth: `${triggerWidth}px`, maxWidth: `${triggerWidth}px` } : {}),
        }}
        position="popper"
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={0}
        avoidCollisions={false}
        {...props}
      >
        <SelectPrimitive.Viewport className="w-full p-1 max-h-[min(320px,calc(100vh-160px))] overflow-y-auto">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

