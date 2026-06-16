// perf/ holds k6 scripts that run in the k6 runtime (globals like __ENV,
// imports from 'k6/*') — not Node, so they're excluded from our Node/TS lint.
module.exports = [
  'build/',
  'perf/',
  'reports/',
  'allure-report/',
  // Node tooling configs (CommonJS globals) not covered by the TS project.
  'lighthouserc.js',
  'stryker.config.mjs',
  // Node CLI scripts (ESM, run by CI workflows — not part of the TS test project).
  'tests/scripts/*.mjs',
];
