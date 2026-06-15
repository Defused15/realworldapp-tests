// perf/k6/lib/profiles.js
// The "how hard" axis — load profiles, reusable across every feature scenario.
// A feature scenario picks one at runtime via the PROFILE env var, so there is
// ONE file per feature (not one per load shape), consistent with how the rest
// of the suite is organized (one file per feature per layer).
//
//   PROFILE=load k6 run perf/k6/scenarios/home.js

export const profiles = {
  // 1 VU, a few iterations — sanity. Runs on every CI gate.
  smoke: {vus: 1, iterations: 5},

  // Steady, expected concurrency.
  load: {
    stages: [
      {duration: '30s', target: 20},
      {duration: '1m', target: 20},
      {duration: '30s', target: 0},
    ],
  },

  // Beyond capacity — find the breaking point. Nightly.
  stress: {
    stages: [
      {duration: '1m', target: 50},
      {duration: '2m', target: 100},
      {duration: '2m', target: 200},
      {duration: '1m', target: 0},
    ],
  },

  // Sudden burst + recovery. Nightly.
  spike: {
    stages: [
      {duration: '10s', target: 5},
      {duration: '20s', target: 200},
      {duration: '20s', target: 5},
      {duration: '10s', target: 0},
    ],
  },
};

/** Resolve the load profile from the PROFILE env var (default: smoke). */
export function profile(name = __ENV.PROFILE || 'smoke') {
  const p = profiles[name];
  if (!p) {
    throw new Error(
      `Unknown PROFILE "${name}". Use one of: ${Object.keys(profiles).join(', ')}`,
    );
  }
  return p;
}
