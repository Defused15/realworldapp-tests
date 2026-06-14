import {defineConfig, devices} from '@playwright/test';
import * as dotenv from 'dotenv';

const env = process.env.NODE_ENV ?? 'local';
dotenv.config({path: `.env.${env}`, override: false, quiet: true});
dotenv.config({quiet: true});

const VIEWPORT = {width: 1440, height: 900};

export default defineConfig({
  testDir: './tests',
  snapshotDir: './__snapshots__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : 3,
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  reporter: [
    ['html'],
    ['list'],
    ['json', {outputFile: 'playwright-report/report.json'}],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    testIdAttribute: 'data-test',
  },
  projects: [
    {
      // storageState = shared read-only session. Tests that modify user data
      // must create their own user via createUser() from tests/helpers/api-helpers.ts.
      // PostgreSQL handles concurrent writes safely — no need to limit workers.
      name: 'ui',
      testMatch: 'tests/ui/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORT,
        baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
        storageState: '.playwright/.auth/user.json',
      },
    },
    {
      name: 'api',
      testMatch: 'tests/api/**/*.spec.ts',
      use: {
        baseURL: process.env.API_URL ?? 'http://localhost:3001',
      },
    },
  ],
});
