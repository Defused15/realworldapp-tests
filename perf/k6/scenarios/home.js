// perf/k6/scenarios/home.js
// Performance scenario for the HOME feature (one file per feature, like the UI/
// API/DB layers). Exercises the authenticated browse journey: login → public
// feed → open a transaction → notifications.
//
// The load shape is chosen at runtime — NOT by having separate files:
//   PROFILE=smoke  k6 run perf/k6/scenarios/home.js   (default)
//   PROFILE=load   k6 run perf/k6/scenarios/home.js
//   PROFILE=stress k6 run perf/k6/scenarios/home.js
//   PROFILE=spike  k6 run perf/k6/scenarios/home.js

import {sleep} from 'k6';
import {readJourney} from '../lib/journey.js';
import {profile} from '../lib/profiles.js';
import {authSlo} from '../lib/thresholds.js';

export const options = {
  ...profile(), // smoke | load | stress | spike (via PROFILE env)
  thresholds: authSlo, // SLOs = the gate; breach → k6 exits non-zero
};

export default function () {
  readJourney();
  sleep(1);
}
