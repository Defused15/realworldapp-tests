import {chromium, type FullConfig} from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({quiet: true});

async function globalSetup(config: FullConfig): Promise<void> {
  const uiProject = config.projects.find(p => p.name === 'ui');
  const baseURL = uiProject?.use.baseURL ?? 'http://localhost:3000';
  const authDir = '.playwright/.auth';

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, {recursive: true});
  }

  const username = process.env.TEST_USER_USERNAME;
  const password = process.env.TEST_USER_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'global-setup: TEST_USER_USERNAME and TEST_USER_PASSWORD must be set in .env',
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({baseURL});
  const page = await context.newPage();

  // Login through the UI so XState writes "authorized" to localStorage.
  // Calling POST /login directly skips the XState transition and leaves
  // authState.value="unauthorized" in localStorage, causing app redirects to /signin.
  await page.goto('/signin');
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', {name: /sign in/i}).click();

  // Wait for the dashboard grid — confirms auth state is fully written.
  await page.getByRole('grid').waitFor({state: 'visible'});

  await context.storageState({path: path.join(authDir, 'user.json')});
  await browser.close();
}

export default globalSetup;
