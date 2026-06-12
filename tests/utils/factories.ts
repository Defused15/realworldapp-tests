import {faker} from '@faker-js/faker';

export interface UserData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

export interface TransactionData {
  transactionType: 'payment' | 'request';
  receiverId: string;
  amount: number;
  description: string;
  privacyLevel?: 'public' | 'private' | 'contacts';
}

export interface BankAccountData {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
}

export function buildUser(overrides: Partial<UserData> = {}): UserData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    username: faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_'),
    password: faker.internet.password({length: 12, memorable: false}) + 'A1!',
    ...overrides,
  };
}

export function buildTransaction(
  overrides: Partial<TransactionData> = {},
): TransactionData {
  return {
    transactionType: 'payment',
    receiverId: '',
    amount: faker.number.int({min: 100, max: 100000}),
    description: faker.lorem.sentence({min: 3, max: 6}).replace(/\.$/, ''),
    privacyLevel: 'public',
    ...overrides,
  };
}

export function buildBankAccount(
  overrides: Partial<BankAccountData> = {},
): BankAccountData {
  return {
    bankName: faker.company.name(),
    accountNumber: faker.finance.accountNumber(10),
    routingNumber: faker.finance.routingNumber(),
    ...overrides,
  };
}
