// perf/k6/scenarios/signin.js
// Performance scenario for the SIGNIN feature (one file per feature, like the
// UI/API/DB layers). Black-box: hits POST /login on the live API exactly like
// the Playwright/vitest suites — no app source is read.
//
// WHY THIS FLOW MERITS MEASUREMENT
//   POST /login is the auth money path: every single user pays it before they
//   can do anything, it is bcrypt-bound (CPU-heavy), and it has an SLA. A
//   regression here degrades 100% of sessions and can become a DoS amplifier
//   under credential-stuffing. SLO: p95 < 800ms (auth budget), checks > 99%.
//
//   Load shape is chosen at runtime — NOT by separate files:
//     PROFILE=smoke  k6 run perf/k6/scenarios/signin.js   (default, every gate)
//     PROFILE=load   k6 run perf/k6/scenarios/signin.js   (baseline regression)
//     PROFILE=stress k6 run perf/k6/scenarios/signin.js   (nightly, bcrypt sat.)
//     PROFILE=spike  k6 run perf/k6/scenarios/signin.js   (nightly, login burst)
//
// ---------------------------------------------------------------------------
// PHASE 0 — DECISION TABLE (measure by risk, not by completeness)
// ---------------------------------------------------------------------------
// Flujo                              | ¿Medir? | Criterio / razón
// -----------------------------------|---------|---------------------------------
// POST /login (valid creds)          | SÍ      | money path + SLA + bcrypt (CPU)
//                                    |         | + todo usuario lo pega. profile:
//                                    |         | smoke+load+stress+spike.
// POST /login (invalid creds, 401)   | SÍ      | mismo endpoint paga bcrypt; es
//                                    |         | el blanco de credential-stuffing/
//                                    |         | brute-force — no debe ser DoS
//                                    |         | amplifier. ~10% del mix.
// POST /login remember:true          | NO      | misma ruta/costo que login normal
//                                    |         | (curl: igual latencia); medirlo
//                                    |         | aparte sería coverage theater.
// POST /logout                       | NO      | sin contención, baja frecuencia,
//                                    |         | sin SLA; cubierto por sesión.
// GET /checkAuth                     | TAL VEZ | lectura barata; ya implícito en
//                                    |         | el journey de home. No se mide
//                                    |         | aquí para no duplicar hot path.
// POST /users (signup)              | NO      | flujo de baja frecuencia (alta de
//                                    |         | cuenta), no es el hot path; vive
//                                    |         | en su propia feature si aplica.
// ---------------------------------------------------------------------------
// Mix: ~90% valid logins (the realistic dominant case) + ~10% invalid (the
// attack/typo path). Both share endpoint tag `login`, so the duration SLO
// covers the worst of both. http_req_failed is NOT used as the gate here
// because intentional 401s would trip it; the functional `checks` rate is the
// gate instead (see thresholds.signinSlo).

import {sleep} from 'k6';
import {loginJourney, loginFailJourney} from '../lib/journey.js';
import {profile} from '../lib/profiles.js';
import {signinSlo} from '../lib/thresholds.js';

export const options = {
  ...profile(), // smoke | load | stress | spike (via PROFILE env)
  thresholds: signinSlo, // SLOs = the gate; breach → k6 exits non-zero
};

export default function () {
  // ~10% of iterations exercise the rejection (401) path; the rest are the
  // valid auth money path.
  if (Math.random() < 0.1) {
    loginFailJourney();
  } else {
    loginJourney();
  }
  sleep(1);
}
