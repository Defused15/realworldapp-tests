import * as dotenv from 'dotenv';
dotenv.config({quiet: true});

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function teardown(): Promise<void> {
  console.log('=== Test Data Teardown ===\n');
  console.log('Resetting database to clean seed state...');

  const res = await fetch(`${API_URL}/testData/seed`, {method: 'POST'});

  if (!res.ok) {
    console.error(`Teardown failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  console.log('✅ Database reset — all test mutations cleared');
}

teardown().catch(err => {
  console.error('Teardown failed:', err);
  process.exit(1);
});
