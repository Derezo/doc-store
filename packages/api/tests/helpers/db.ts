import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://docstore:docstore_dev@localhost:5432/docstore_test';

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Check if database is available.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  const testPool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await testPool.query('SELECT 1');
    await testPool.end();
    return true;
  } catch {
    await testPool.end().catch(() => {});
    return false;
  }
}

/**
 * Set up the test database by running migrations.
 */
export async function setupTestDb(): Promise<void> {
  pool = new pg.Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool, { schema });

  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });
}

/**
 * Clean up test database by truncating all tables.
 */
export async function cleanupTestDb(): Promise<void> {
  if (!db || !pool) {
    throw new Error('Database not initialized. Call setupTestDb first.');
  }

  // Truncate all tables with CASCADE to handle foreign keys
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      invitations,
      sessions,
      vaults,
      documents,
      document_versions,
      api_keys
    CASCADE
  `);
}

/**
 * Tear down the test database by closing the connection pool.
 */
export async function teardownTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

/**
 * Get the database instance for direct queries in tests.
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call setupTestDb first.');
  }
  return db;
}
