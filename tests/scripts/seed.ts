import * as dotenv from 'dotenv';
dotenv.config({quiet: true});

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function seed(): Promise<void> {
  console.log('=== Test Data Seed ===\n');
  console.log('Resetting database to seed state...');

  const res = await fetch(`${API_URL}/testData/seed`, {method: 'POST'});

  if (!res.ok) {
    console.error(`Seed failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  console.log('✅ Database reset to seed state');
  console.log('   All seed users available with password: s3cret');
  console.log('   Primary test user: Heath93 / s3cret');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
