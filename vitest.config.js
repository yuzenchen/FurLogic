import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'shared/src/**/*.test.{js,jsx}',
      'server/src/**/*.test.{js,jsx}',
      'client/src/**/*.test.{js,jsx}',
    ],
  },
});
