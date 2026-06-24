/**
 * Apply a production SQL migration file to Supabase Postgres.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@...:6543/postgres" \
 *     node scripts/apply-production-migration.mjs supabase/migrations/production/20250625100015_prod_commerce_e2e_fix.sql
 *
 * Get the connection string from Supabase Dashboard → Project Settings → Database → Connection string (URI).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url);

const migrationArg = process.argv[2];
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!migrationArg) {
  console.error('Usage: node scripts/apply-production-migration.mjs <path-to.sql>');
  process.exit(1);
}

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in environment.');
  console.error('Add your Supabase Postgres URI to .env (not committed) and rerun.');
  process.exit(1);
}

const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', migrationArg);
const sql = readFileSync(migrationPath, 'utf8');

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`Applying migration: ${migrationPath}`);
  await client.query(sql);
  console.log('Migration applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
