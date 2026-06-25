/**
 * Apply migration 019 via Supabase Management API (when CLI login-role fails).
 * Requires: SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)
 * Usage: node scripts/apply-migration-019.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url);

const PROJECT_REF = 'aosnytcfcazlaolozehx';
const MIGRATION = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'supabase/migrations/production/20250625100019_industrialist_trader_procurement_batches.sql',
);

async function applyViaManagementApi(token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function applyViaPg(dbUrl, sql) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  console.log(`Applying: ${MIGRATION}`);

  if (dbUrl) {
    console.log('Using SUPABASE_DB_URL (direct Postgres)...');
    await applyViaPg(dbUrl, sql);
    console.log('Migration applied via Postgres.');
    return;
  }

  if (token) {
    console.log('Using Supabase Management API...');
    await applyViaManagementApi(token, sql);
    console.log('Migration applied via Management API.');
    return;
  }

  console.error('Cannot apply migration automatically.');
  console.error('Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN in .env and rerun.');
  console.error('Or paste the SQL file into Supabase Dashboard → SQL Editor.');
  process.exit(1);
}

main().catch((e) => {
  console.error('Apply failed:', e.message);
  process.exit(1);
});
