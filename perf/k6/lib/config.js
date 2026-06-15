// perf/k6/lib/config.js
// Shared configuration for all k6 scenarios. Values come from env vars so the
// same scripts run locally, in CI, and against staging without edits.

export const BASE = {
  api: __ENV.API_URL || 'http://localhost:3001',
  ui: __ENV.BASE_URL || 'http://localhost:3000',
};

// Primary seed user. THE single source of truth for test identity — every
// scenario/journey imports from here, never inlines credentials or ids. The
// defaults are the public seed creds of the demo app (documented openly, not
// secrets); CI overrides them via TEST_USER_* env vars.
export const USER = {
  username: __ENV.TEST_USER_USERNAME || 'Heath93',
  password: __ENV.TEST_USER_PASSWORD || 's3cret',
  id: __ENV.TEST_USER_ID || 'uBmeaz5pX',
};

// Password assigned to throwaway accounts created during a run (e.g. the signup
// load path). Not a credential to protect — these accounts are never reused.
export const NEW_USER_PASSWORD = __ENV.PERF_NEW_USER_PASSWORD || 's3cret';

export const JSON_HEADERS = {'Content-Type': 'application/json'};
