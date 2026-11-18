import * as React from 'react';
import { cn } from '@/lib/utils';

/** Checkbox native bergaya shadcn/ui. */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded-[4px] border border-input accent-(--brand-primary) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
