import {defineConfig} from 'vitest/config';

// Unit tests for pure code (factories, future utils). No DB, no env setup, runs
// in parallel. Separate from vitest.config.ts (which is the DB-integration
// suite that needs a seeded database and runs sequentially). Also the config
// Stryker drives for mutation testing.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Measure only the pure code that unit tests exercise. helpers/ have
      // network side effects and are covered by the e2e layers, not here.
      include: ['tests/utils/**'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      // Gate: the command exits non-zero below these — wired into CI quality.
      thresholds: {lines: 85, functions: 85, branches: 80, statements: 85},
    },
  },
});
