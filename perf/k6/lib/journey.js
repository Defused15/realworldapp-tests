// perf/k6/lib/journey.js
// Reusable request flows shared by every scenario, so smoke/load/stress/spike
// exercise the exact same user journey and differ only in load shape.
//
// k6 maintains a per-VU cookie jar automatically, so the session cookie set by
// login() is reused by subsequent requests in the same iteration.

import http from 'k6/http';
import {check, group} from 'k6';
import {BASE, USER, NEW_USER_PASSWORD, JSON_HEADERS} from './config.js';

/**
 * Register a brand-new user via POST /users (the unauthenticated signup write).
 *
 * Each call generates a unique username — the app returns 500 on duplicate
 * usernames (BUG-002), so reusing a name would poison the run with errors that
 * are not a performance signal. Username uniqueness is derived from VU id,
 * iteration counter, and a random suffix to stay collision-free across VUs.
 *
 * This is intentionally a thin, single-request journey: signup is one INSERT +
 * a synchronous bcrypt hash, with no authenticated follow-up. We measure it as
 * a latency tripwire (bcrypt cost regressions), not as a throughput flow.
 */
export function signupJourney() {
  group('signup', () => {
    const unique = `perf_${__VU}_${__ITER}_${Math.floor(Math.random() * 1e6)}`;
    const body = {
      firstName: 'Perf',
      lastName: 'Signup',
      username: unique,
      password: NEW_USER_PASSWORD,
      confirmPassword: NEW_USER_PASSWORD,
    };

    const res = http.post(`${BASE.api}/users`, JSON.stringify(body), {
      headers: JSON_HEADERS,
      tags: {endpoint: 'signup'},
    });

    check(res, {
      'signup → 201': r => r.status === 201,
      'signup returns user.id': r => typeof r.json('user.id') === 'string',
    });
  });
}

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
 * Signin journey (valid credentials) — the auth money path. Every user hits
 * this; it gates access to the whole app and is bcrypt-bound, so it carries the
 * widest latency budget of any endpoint. Verifies 200 + a session cookie was
 * issued. Reused by the signin scenario across all load profiles.
 */
export function loginJourney(user = USER) {
  group('signin (valid credentials)', () => {
    const res = login(user);
    check(res, {
      'login → 200': r => r.status === 200,
      'login sets session cookie': r =>
        (r.headers['Set-Cookie'] || '').includes('connect.sid'),
    });
  });
}

/**
 * Signin journey (invalid credentials) — the auth-rejection path. This is what
 * credential-stuffing / brute-force traffic hits, and it still pays the bcrypt
 * cost, so it must not become a DoS amplifier. Expects a fast, clean 401.
 * NOTE: /login returns plain text "Unauthorized" on 401 — never parse as JSON.
 */
export function loginFailJourney() {
  group('signin (invalid credentials)', () => {
    const res = http.post(
      `${BASE.api}/login`,
      JSON.stringify({username: USER.username, password: 'definitely-wrong'}),
      {headers: JSON_HEADERS, tags: {endpoint: 'login'}},
    );
    check(res, {'login → 401': r => r.status === 401});
  });
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

/**
 * Transaction READ journey: login → public feed → open the first transaction's
 * detail (the joined likes/comments payload). This is the hot read path for the
 * transaction feature; the `transaction` SLO budget applies to the detail GET.
 */
export function transactionReadJourney() {
  group('transaction read journey', () => {
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
      check(tx, {
        'transaction detail → 200': r => r.status === 200,
        'detail has matching id': r => r.json('transaction.id') === txId,
      });
    }
  });
}

// Per-VU memoized write context (receiver + source bank account). Resolved once
// so write iterations measure the INSERT, not the lookups.
let cachedReceiverId = null;
let cachedSourceId = null;

function resolveWriteContext() {
  if (cachedReceiverId && cachedSourceId) return;

  const users = http.get(`${BASE.api}/users`, {tags: {endpoint: 'users'}});
  const list = users.json('results');
  if (Array.isArray(list)) {
    const other = list.find(u => u.id !== USER.id);
    if (other) cachedReceiverId = other.id;
  }

  const gql = http.post(
    `${BASE.api}/graphql`,
    JSON.stringify({
      operationName: 'ListBankAccount',
      query: 'query ListBankAccount { listBankAccount { id } }',
      variables: {},
    }),
    {headers: JSON_HEADERS, tags: {endpoint: 'bankaccounts'}},
  );
  const accounts = gql.json('data.listBankAccount');
  if (Array.isArray(accounts) && accounts.length > 0) {
    cachedSourceId = accounts[0].id;
  }
}

/**
 * Transaction WRITE journey (money path under contention): login → resolve
 * receiver + source bank account → POST /transactions.
 *
 * Uses transactionType "request" (a pending money request) so NO balance is
 * actually moved — this keeps the seed user's balance stable across thousands of
 * iterations while still exercising the identical write path: auth, payload
 * validation, and the DB INSERT under concurrency. The `create-transaction` SLO
 * budget applies to the POST.
 */
export function transactionWriteJourney() {
  group('transaction write journey', () => {
    login();
    resolveWriteContext();

    if (!cachedReceiverId || !cachedSourceId) {
      check(null, {'write context resolved': () => false});
      return;
    }

    const body = JSON.stringify({
      source: cachedSourceId,
      amount: 1, // dollars (API stores cents). Tiny, and "request" moves nothing.
      description: `k6 perf request ${Date.now()}`,
      receiverId: cachedReceiverId,
      transactionType: 'request',
      privacyLevel: 'public',
    });

    const res = http.post(`${BASE.api}/transactions`, body, {
      headers: JSON_HEADERS,
      tags: {endpoint: 'create-transaction'},
    });
    check(res, {
      'create transaction → 200': r => r.status === 200,
      'create returns transaction id': r => !!r.json('transaction.id'),
    });
  });
}
