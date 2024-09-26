import type { Meta, StoryObj } from '@storybook/react';
import { Sidebar, SidebarLogo, SidebarMenu, SidebarUser } from './sidebar';

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: (
      <>
        <SidebarLogo />
        <SidebarUser />
        <SidebarMenu menus={[{ name: '대시보드', href: '/dashboard' }]} />
      </>
    ),
  },
};
