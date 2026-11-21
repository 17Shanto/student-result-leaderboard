/**
 * Creates the administrator account, or resets its password if it already exists.
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME from the environment (.env).
 *
 *   npm run seed:admin
 */
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Admin = require('../models/Admin');

async function run() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Administrator';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  await connectDB(config.mongoUri);
  const passwordHash = await Admin.hashPassword(password);
  const admin = await Admin.findOneAndUpdate(
    { email },
    { email, name, passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Administrator ready: ${admin.email}`);
}

run()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
