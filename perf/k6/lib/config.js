// perf/k6/lib/config.js
// Shared configuration for all k6 scenarios. Values come from env vars so the
// same scripts run locally, in CI, and against staging without edits.

export const BASE = {
  api: __ENV.API_URL || 'http://localhost:3001',
  ui: __ENV.BASE_URL || 'http://localhost:3000',
};

// Primary seed user (Heath93 / s3cret after npm run db:seed).
export const USER = {
  username: __ENV.TEST_USER_USERNAME || 'Heath93',
  password: __ENV.TEST_USER_PASSWORD || 's3cret',
};

export const JSON_HEADERS = {'Content-Type': 'application/json'};
