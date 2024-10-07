'use client';

import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type CheckedState = boolean | 'indeterminate';

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'defaultChecked'> {
  onCheckedChange?: (checked: CheckedState) => void;
}

export const Checkbox = forwardRef<ElementRef<'input'>, CheckboxProps>(
  ({ className, ...props }, forwardedRef) => {
    return (
      <input
        type="checkbox"
        role="checkbox"
        ref={forwardedRef}
        className={cn(
          'checked:bg-checked size-3.5 appearance-none border border-[#e1e3e6] bg-[#f7f9fc] bg-center bg-no-repeat',
          className
        )}
        {...props}
      />
    );
  }
);
