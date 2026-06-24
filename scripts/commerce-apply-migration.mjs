/**
 * Apply migration 015 via Supabase CLI (linked) or Postgres URI.
 * npm run commerce:apply-migration
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = resolve(root, 'supabase/migrations/production/20250625100015_prod_commerce_e2e_fix_v2.sql');
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (dbUrl) {
  const r = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--db-url', dbUrl, '-f', migration],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  process.exit(r.status ?? 1);
}

const linked = spawnSync(
  'npx',
  ['supabase', 'db', 'query', '--linked', '-f', migration],
  { cwd: root, stdio: 'inherit', shell: true },
);
process.exit(linked.status ?? 1);
