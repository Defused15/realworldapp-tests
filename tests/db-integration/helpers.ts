/**
 * Lightweight HTTP helpers for db-integration tests.
 * These tests are Vitest-only (no Playwright) so we use fetch directly.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export interface ApiClient {
  get(path: string): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
}

/** Logs in via POST /login and returns an authenticated ApiClient. */
export async function loginAs(
  username: string,
  password: string,
): Promise<ApiClient> {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password}),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);

  // extract session cookie (set-cookie may contain multiple; take first)
  const raw = res.headers.get('set-cookie') ?? '';
  const cookie = raw.split(',')[0].split(';')[0].trim();

  return {
    get: (path: string) =>
      fetch(`${API_URL}${path}`, {headers: {Cookie: cookie}}),
    post: (path: string, body: unknown) =>
      fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Cookie: cookie},
        body: JSON.stringify(body),
      }),
  };
}

/** Creates a unique user and returns its data + an authenticated client. */
export async function createFreshUser(): Promise<{
  username: string;
  password: string;
  userId: string;
  client: ApiClient;
}> {
  const username = `di_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const password = 'Password123!';

  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'User',
      username,
      password,
    }),
  });
  if (!res.status.toString().startsWith('2')) {
    throw new Error(`createFreshUser failed: ${res.status}`);
  }
  const {user} = await res.json();
  const client = await loginAs(username, password);
  return {username, password, userId: user.id as string, client};
}
