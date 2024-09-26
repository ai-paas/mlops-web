import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface DashboardLayoutProps extends HTMLAttributes<HTMLDivElement> {}

export const DashboardLayout = ({ className, children, ...props }: DashboardLayoutProps) => {
  return (
    <div className={cn('bg-background flex flex-1 flex-col overflow-y-auto', className)} {...props}>
      {children}
    </div>
  );
};

interface DashboardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const DashboardTitle = ({ className, children, ...props }: DashboardTitleProps) => {
  return (
    <div className={cn('bg-background sticky top-0', className)} {...props}>
      <div className="h-1" />
      <div className="bg-foreground flex h-16 items-center rounded-tl-[7px] pl-[19px] before:mr-[14px] before:h-4 before:border-l-[3px] before:border-solid before:border-[#071e3f] before:content-['']">
        <h1 className="text-lg">{children}</h1>
      </div>
    </div>
  );
};

interface DashboardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const DashboardContent = ({ className, children, ...props }: DashboardContentProps) => {
  return (
    <div className={cn('bg-foreground flex-grow px-2.5', className)} {...props}>
      <div className="border-border min-h-full border-x border-t border-t-[#071e3f] bg-white">
        {children}
      </div>
    </div>
  );
};
