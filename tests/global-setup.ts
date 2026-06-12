import {chromium, type FullConfig} from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function globalSetup(config: FullConfig): Promise<void> {
  const uiProject = config.projects.find(p => p.name === 'ui');
  const baseURL = uiProject?.use.baseURL ?? 'http://localhost:3000';
  const apiURL = process.env.API_URL ?? 'http://localhost:3001';
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

  // POST /login stores the connect.sid session cookie in the context automatically.
  const res = await page.request.post(`${apiURL}/login`, {
    data: {username, password},
  });

  if (!res.ok()) {
    throw new Error(
      `global-setup: login failed with status ${res.status()}. ` +
        'Check TEST_USER_USERNAME and TEST_USER_PASSWORD in your .env file.',
    );
  }

  // Navigate to app root so the session cookie is bound to the correct origin.
  await page.goto('/');

  await context.storageState({path: path.join(authDir, 'user.json')});
  await browser.close();
}

export default globalSetup;
