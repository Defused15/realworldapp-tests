import {type APIRequestContext} from '@playwright/test';
import {
  buildUser,
  buildTransaction,
  buildBankAccount,
  type UserData,
  type TransactionData,
  type BankAccountData,
} from '../utils/factories';

export interface CreatedUser {
  data: UserData;
  userId: string;
}

export interface CreatedTransaction {
  id: string;
  description: string;
}

export interface CreatedBankAccount {
  id: string;
}

/**
 * Authenticate as an existing user. After this call the connect.sid session
 * cookie is stored in the `request` context automatically — all subsequent
 * calls with the same context are authenticated.
 */
export async function loginAs(
  request: APIRequestContext,
  credentials: {username: string; password: string},
): Promise<{userId: string}> {
  const res = await request.post('/login', {
    data: {
      username: credentials.username,
      password: credentials.password,
    },
  });
  if (!res.ok()) throw new Error(`loginAs failed: ${res.status()}`);
  const body = await res.json();
  return {userId: body.user.id};
}

/**
 * Register a new user via POST /users and return the created record together
 * with the plain-text credentials used to create it.
 */
export async function createUser(
  request: APIRequestContext,
  overrides: Partial<UserData> = {},
): Promise<CreatedUser> {
  const data = buildUser(overrides);
  const res = await request.post('/users', {data});
  if (!res.ok()) {
    throw new Error(`createUser failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return {data, userId: body.user.id};
}

/**
 * Create a bank account for the currently authenticated session.
 */
export async function createBankAccount(
  request: APIRequestContext,
  overrides: Partial<BankAccountData> = {},
): Promise<CreatedBankAccount> {
  const data = buildBankAccount(overrides);
  const res = await request.post('/bankAccounts', {data});
  if (!res.ok()) {
    throw new Error(`createBankAccount failed: ${res.status()}`);
  }
  const body = await res.json();
  return {id: body.account.id};
}

/**
 * Create a transaction sent to `receiverId` for the currently authenticated
 * session.
 *
 * POST /transactions requires a `source` (bank account id of the sender).
 * Reuses the first existing bank account to avoid triggering the XState
 * onboarding wizard for seed users; only creates a new one for fresh users
 * who have none.
 */
export async function createTransaction(
  request: APIRequestContext,
  receiverId: string,
  overrides: Partial<Omit<TransactionData, 'receiverId'>> = {},
): Promise<CreatedTransaction> {
  let source: string;
  const baRes = await request.get('/bankAccounts');
  if (baRes.ok()) {
    const baBody = await baRes.json();
    // GET /bankAccounts returns { results: [...] } (not "accounts")
    const accounts = (baBody.results ?? []) as Array<{
      id: string;
      isDeleted: boolean;
    }>;
    const active = accounts.filter(a => !a.isDeleted);
    source =
      active.length > 0 ? active[0].id : (await createBankAccount(request)).id;
  } else {
    source = (await createBankAccount(request)).id;
  }
  const data = {...buildTransaction({...overrides, receiverId}), source};
  const res = await request.post('/transactions', {data});
  if (!res.ok()) {
    throw new Error(`createTransaction failed: ${res.status()}`);
  }
  const body = await res.json();
  return {id: body.transaction.id, description: body.transaction.description};
}

/**
 * Reset the database to the known seed state via the built-in RWA endpoint.
 * Safe to call multiple times — idempotent.
 */
export async function seedDatabase(): Promise<void> {
  const apiURL = process.env.API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiURL}/testData/seed`, {method: 'POST'});
  if (!res.ok) throw new Error(`seedDatabase failed: ${res.status}`);
}
