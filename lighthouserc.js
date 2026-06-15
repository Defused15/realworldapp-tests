// lighthouserc.js
// Lighthouse CI — performance/accessibility/best-practices budgets for the UI.
// Complements k6 (which is API load) with front-end page quality. Needs the app
// running. Run: npm run lighthouse
//
// Docs: https://github.com/GoogleChrome/lighthouse-ci

const BASE = process.env.BASE_URL || 'http://localhost:3000';

module.exports = {
  ci: {
    collect: {
      url: [`${BASE}/signin`, `${BASE}/signup`],
      numberOfRuns: 3,
      settings: {chromeFlags: '--no-sandbox'},
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', {minScore: 0.8}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.9}],
        'categories:seo': ['warn', {minScore: 0.8}],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse',
    },
  },
};
