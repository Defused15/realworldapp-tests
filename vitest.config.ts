import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/db-integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
    // Run files sequentially — tests share the same DB state after db:seed
    sequence: {concurrent: false},
    // Load .env before tests
    setupFiles: ['tests/db-integration/env-setup.ts'],
  },
});
