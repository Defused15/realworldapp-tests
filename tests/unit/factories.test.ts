// tests/unit/factories.test.ts
// Unit tests for the pure data factories. These have no side effects (no
// network, no DB), so they run fast and in parallel — and give Stryker real
// mutants to kill (npm run test:mutation).

import {describe, it, expect} from 'vitest';
import {
  buildUser,
  buildTransaction,
  buildBankAccount,
} from '../utils/factories';

describe('buildUser', () => {
  it('returns all required fields', () => {
    const u = buildUser();
    expect(u.firstName).toBeTruthy();
    expect(u.lastName).toBeTruthy();
    expect(u.username).toBeTruthy();
    expect(u.password).toBeTruthy();
  });

  it('username is lowercase and only [a-z0-9_]', () => {
    for (let i = 0; i < 25; i++) {
      const {username} = buildUser();
      expect(username).toBe(username.toLowerCase());
      expect(username).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('password meets the appended complexity suffix (A1!)', () => {
    const {password} = buildUser();
    expect(password).toMatch(/A1!$/);
    expect(password.length).toBeGreaterThan(12);
  });

  it('applies overrides over generated values', () => {
    const u = buildUser({username: 'fixed_name', firstName: 'Ada'});
    expect(u.username).toBe('fixed_name');
    expect(u.firstName).toBe('Ada');
  });
});

describe('buildTransaction', () => {
  it('defaults to a public payment with empty receiverId', () => {
    const t = buildTransaction();
    expect(t.transactionType).toBe('payment');
    expect(t.privacyLevel).toBe('public');
    expect(t.receiverId).toBe('');
  });

  it('amount is an integer within [100, 100000]', () => {
    for (let i = 0; i < 25; i++) {
      const {amount} = buildTransaction();
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(100);
      expect(amount).toBeLessThanOrEqual(100000);
    }
  });

  it('description has no trailing period', () => {
    for (let i = 0; i < 25; i++) {
      const {description} = buildTransaction();
      expect(description.endsWith('.')).toBe(false);
    }
  });

  it('applies overrides (receiverId, privacyLevel, amount)', () => {
    const t = buildTransaction({
      receiverId: 'abc123',
      privacyLevel: 'private',
      amount: 5000,
    });
    expect(t.receiverId).toBe('abc123');
    expect(t.privacyLevel).toBe('private');
    expect(t.amount).toBe(5000);
  });
});

describe('buildBankAccount', () => {
  it('returns bankName, accountNumber, routingNumber', () => {
    const b = buildBankAccount();
    expect(b.bankName).toBeTruthy();
    expect(b.accountNumber).toBeTruthy();
    expect(b.routingNumber).toBeTruthy();
  });

  it('applies overrides', () => {
    const b = buildBankAccount({bankName: 'Test Bank'});
    expect(b.bankName).toBe('Test Bank');
  });
});
