import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'hooks',
      include: ['packages/hooks/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  },
  {
    test: {
      name: 'ui',
      include: ['packages/ui/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  },
  {
    test: {
      name: 'web',
      include: ['apps/web/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  },
]);
