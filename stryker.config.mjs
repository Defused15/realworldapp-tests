// stryker.config.mjs
// Mutation testing: proves the UNIT tests actually catch regressions, not just
// that they pass. Stryker mutates the pure factories and checks our unit tests
// kill each mutant. Run: npm run test:mutation
//
// Scope is intentionally the pure code (tests/utils) that has fast unit tests —
// mutation testing is only meaningful where unit tests exist.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // The dedicated vitest-runner is incompatible with Vitest 4 (it accesses
  // internal `project.server` APIs that changed). The `command` runner instead
  // just runs the unit-test command and checks the exit code — version-agnostic.
  // Trade-off: no perTest coverage, so it's a bit slower; correctness is the same.
  testRunner: 'command',
  commandRunner: {
    command: 'npx vitest run --config vitest.unit.config.ts',
  },
  mutate: ['tests/utils/**/*.ts'],
  reporters: ['html', 'progress', 'clear-text'],
  htmlReporter: {fileName: 'reports/mutation/index.html'},
  coverageAnalysis: 'off', // required for the command runner
  // Mutation score gate: below `break` the command exits non-zero (CI gate).
  thresholds: {high: 80, low: 60, break: 50},
};
