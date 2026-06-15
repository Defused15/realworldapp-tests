// perf/k6/lib/journey.js
// Reusable request flows shared by every scenario, so smoke/load/stress/spike
// exercise the exact same user journey and differ only in load shape.
//
// k6 maintains a per-VU cookie jar automatically, so the session cookie set by
// login() is reused by subsequent requests in the same iteration.

import http from 'k6/http';
import {check, group} from 'k6';
import {BASE, USER, JSON_HEADERS} from './config.js';

/** Authenticate as the seed user. Returns the response. */
export function login(user = USER) {
  const res = http.post(`${BASE.api}/login`, JSON.stringify(user), {
    headers: JSON_HEADERS,
    tags: {endpoint: 'login'},
  });
  check(res, {'login → 200': r => r.status === 200});
  return res;
}

/**
 * Full authenticated read journey: login → public feed → open first
 * transaction → notifications. Mirrors what a logged-in user does on the home
 * dashboard. Used by every scenario.
 */
export function readJourney() {
  group('authenticated read journey', () => {
    login();

    const feed = http.get(`${BASE.api}/transactions/public?page=1&limit=10`, {
      tags: {endpoint: 'feed'},
    });
    check(feed, {
      'feed → 200': r => r.status === 200,
      'feed has results[]': r => Array.isArray(r.json('results')),
    });

    const results = feed.json('results');
    if (Array.isArray(results) && results.length > 0) {
      const txId = results[0].id;
      const tx = http.get(`${BASE.api}/transactions/${txId}`, {
        tags: {endpoint: 'transaction'},
      });
      check(tx, {'transaction → 200': r => r.status === 200});
    }

    const notifs = http.get(`${BASE.api}/notifications`, {
      tags: {endpoint: 'notifications'},
    });
    check(notifs, {'notifications → 200': r => r.status === 200});
  });
}
