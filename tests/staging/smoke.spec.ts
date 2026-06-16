import {test, expect, request as playwrightRequest} from '@playwright/test';

/**
 * Staging synthetic smoke (@staging) — runs ONLY against the shared Railway
 * environment, never in the normal gates (no other workflow greps @staging).
 *
 * STRICTLY READ-ONLY. Railway staging is a fixed, shared environment: these
 * checks must never create, mutate, or delete data, and must never seed/reset
 * the DB. They answer one question: "is staging alive and serving correctly?"
 *
 * Self-contained at the API layer (own login via a fresh request context) so it
 * does not depend on storageState. global-setup additionally proves UI login
 * works against staging.
 */
test.describe('Staging smoke @staging', () => {
  const apiURL = process.env.API_URL ?? 'http://localhost:3001';
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
  const username = process.env.TEST_USER_USERNAME ?? 'Heath93';
  const password = process.env.TEST_USER_PASSWORD ?? 's3cret';

  test('UI is reachable and serves HTML', async () => {
    const ctx = await playwrightRequest.newContext();
    const res = await ctx.get(baseURL);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
    await ctx.dispose();
  });

  test('login succeeds and issues a session cookie', async () => {
    const ctx = await playwrightRequest.newContext({baseURL: apiURL});
    const res = await ctx.post('/login', {
      data: {type: 'LOGIN', username, password},
    });
    expect(res.status()).toBe(200);
    const setCookie = res
      .headersArray()
      .find(h => h.name.toLowerCase() === 'set-cookie');
    expect(setCookie?.value).toContain('connect.sid=');
    await ctx.dispose();
  });

  test('public transactions feed returns a well-formed list', async () => {
    const ctx = await playwrightRequest.newContext({baseURL: apiURL});
    await ctx.post('/login', {data: {type: 'LOGIN', username, password}});
    const res = await ctx.get('/transactions/public?page=1&limit=10');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    await ctx.dispose();
  });

  test('unauthenticated read is rejected (auth wired correctly)', async () => {
    const ctx = await playwrightRequest.newContext({baseURL: apiURL});
    const res = await ctx.get('/transactions/public');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});
