#!/usr/bin/env node

/**
 * CLI script to create an admin user.
 *
 * Usage:
 *   npm run create-admin -- --email admin@example.com --password pw --name "Admin"
 */

import { parseArgs } from 'node:util';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import { pool } from '../db/index.js';

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string', short: 'e' },
      password: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
    },
    strict: true,
  });

  if (!values.email || !values.password || !values.name) {
    console.error(
      'Usage: npm run create-admin -- --email <email> --password <password> --name <displayName>',
    );
    process.exit(1);
  }

  const email = values.email.toLowerCase();
  const displayName = values.name;
  const password = values.password;

  // Check if user already exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.error(`Error: A user with email "${email}" already exists.`);
    process.exit(1);
  }

  // Hash password and create admin
  const passwordHash = await hashPassword(password);

  const [admin] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName,
      role: 'admin',
    })
    .returning();

  console.log('Admin user created successfully:');
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name:  ${admin.displayName}`);
  console.log(`  Role:  ${admin.role}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
