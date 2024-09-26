import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { cva, VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center transition-colors rounded-[3px] ',
  {
    variants: {
      variant: {
        default:
          'text-[#57617a] bg-gradient-to-b from-[#fdfdfd] to-[#f6f6f9] shadow-[inset_0_0_0_1px_#fff] border border-[#bec3ca]  text-xs ',
        secondary: 'text-[13px] bg-[#268eff] text-white hover:bg-[#007aff]',
      },
      size: {
        default: 'w-[52px] h-[30px]',
        lg: 'h-8 w-[112px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  }
);
