import { ComponentPropsWithoutRef, forwardRef, type ComponentProps } from 'react';
import { cn } from '../../lib/utils';
import Link from 'next/link';

export interface SidebarProps extends ComponentPropsWithoutRef<'aside'> {}

const Sidebar = forwardRef<HTMLElement, SidebarProps>(({ className, ...props }, forwardedRef) => {
  return (
    <aside
      ref={forwardedRef}
      className={cn('flex h-full w-[231px] flex-col', className)}
      {...props}
    />
  );
});

interface SidebarLogoProps extends ComponentPropsWithoutRef<'div'> {}

const SidebarLogo = forwardRef<HTMLDivElement, SidebarLogoProps>(
  ({ className, ...props }, forwardedRef) => {
    return (
      <div
        ref={forwardedRef}
        className={cn(
          'bg-background flex h-[68px] shrink-0 items-center justify-center',
          className
        )}
        {...props}
      >
        <Link href="/">로고 이미지</Link>
      </div>
    );
  }
);

interface SidebarUserProps extends ComponentProps<'div'> {}

const SidebarUser = forwardRef<HTMLDivElement, SidebarUserProps>(
  ({ className, ...props }, forwardedRef) => {
    return (
      <div
        ref={forwardedRef}
        className={cn('bg-primary flex h-[132px] items-center p-[25px]', className)}
        {...props}
      >
        유저
      </div>
    );
  }
);

interface Menu {
  name: string;
  href?: string;
  children?: Menu[];
}

interface SidebarMenuProps extends ComponentProps<'nav'> {
  menus: Menu[];
}

const SidebarMenu = forwardRef<HTMLElement, SidebarMenuProps>(
  ({ menus, className, ...props }, forwardedRef) => {
    return (
      <nav
        ref={forwardedRef}
        className={cn('flex-1 overflow-y-auto bg-[#0a2348] text-[13px]', className)}
        {...props}
      >
        <ul className="mb-[50px] divide-y divide-[#061839] border-t border-t-[#061839] text-[#afbacb]">
          {menus.map((menu) =>
            menu.children?.length ? (
              <li key={menu.href}>
                <details className="group relative">
                  <summary className="flex h-[41px] cursor-pointer items-center before:ml-[15px] before:mr-2 before:h-0.5 before:w-2 before:bg-[#485770] before:content-[''] after:absolute after:left-[18px] after:h-2 after:w-0.5 after:bg-[#485770] after:content-[''] group-open:after:content-none">
                    {menu.name}
                  </summary>
                  <ul className="divide-y divide-[#001032]">
                    {menu.children?.map((child) => (
                      <Link key={child.href} href={child.href ?? ''}>
                        <li className="flex h-[41px] items-center bg-[#011b41] pl-4 before:ml-[15px] before:mr-2 before:size-1 before:rounded-[50%] before:bg-[#485770] before:content-['']">
                          {child.name}
                        </li>
                      </Link>
                    ))}
                  </ul>
                </details>
              </li>
            ) : (
              <Link key={menu.href} href={menu.href ?? ''}>
                <li className="flex h-[41px] items-center before:ml-[15px] before:mr-[8px] before:size-1.5 before:rounded-[50%] before:bg-[#485770] before:content-['']">
                  {menu.name}
                </li>
              </Link>
            )
          )}
        </ul>
      </nav>
    );
  }
);

export { Sidebar, SidebarLogo, SidebarUser, SidebarMenu, type Menu };
