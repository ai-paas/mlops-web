import type { Config } from 'tailwindcss';
import sharedConfig from '@repo/tailwind-config/tailwind.config';

const config: Config = {
  content: [
    '../../packages/ui/src/**/*.{ts,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      backgroundImage: {
        checked: "url('/icons/checked.png')",
      },
    },
  },
  plugins: [],
  presets: [sharedConfig],
};
export default config;
