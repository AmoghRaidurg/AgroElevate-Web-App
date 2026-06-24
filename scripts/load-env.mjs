/**
 * Load VITE_* and commerce env vars from the project root .env file.
 * Resolves root by walking up from the calling script until package.json is found.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * @param {string} startDir - directory to begin upward search
 * @returns {{ root: string, envPath: string }}
 */
export function resolveProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const pkg = resolve(dir, 'package.json');
    const env = resolve(dir, '.env');
    if (existsSync(pkg)) {
      return { root: dir, envPath: env };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = resolve(startDir, '..');
  return { root: fallback, envPath: resolve(fallback, '.env') };
}

/**
 * Parse .env file contents into process.env (does not overwrite existing vars).
 * @param {string} raw
 */
export function parseEnvContent(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let body = trimmed;
    if (body.startsWith('export ')) body = body.slice(7).trim();

    const eq = body.indexOf('=');
    if (eq <= 0) continue;

    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Load .env from project root relative to caller script.
 * @param {string} callerMetaUrl - pass import.meta.url from the calling script
 * @param {{ debug?: boolean }} [opts]
 * @returns {{ root: string, envPath: string, loaded: boolean }}
 */
export function loadProjectEnv(callerMetaUrl, opts = {}) {
  const debug = opts.debug !== false;
  const callerDir = dirname(fileURLToPath(callerMetaUrl));
  const { root, envPath } = resolveProjectRoot(callerDir);

  let loaded = false;
  if (existsSync(envPath)) {
    try {
      const raw = readFileSync(envPath, 'utf8');
      parseEnvContent(raw);
      loaded = true;
    } catch (err) {
      if (debug) {
        console.error(`[env] Failed to read ${envPath}:`, err.message);
      }
    }
  }

  if (debug) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    console.log('[env] process.cwd():', process.cwd());
    console.log('[env] resolved .env path:', envPath);
    console.log('[env] .env file exists:', existsSync(envPath));
    console.log('[env] VITE_SUPABASE_URL detected:', Boolean(url), url ? `(${url.slice(0, 32)}…)` : '');
    console.log(
      '[env] VITE_SUPABASE_ANON_KEY detected:',
      Boolean(key),
      key ? `(…${key.slice(-8)})` : ''
    );
  }

  return { root, envPath, loaded };
}

/**
 * Require Supabase public env vars or exit.
 * @param {string} callerMetaUrl
 */
export function requireSupabaseEnv(callerMetaUrl) {
  loadProjectEnv(callerMetaUrl, { debug: true });

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('\nMissing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    console.error('Ensure agro-fair-chain/.env exists and run npm scripts from agro-fair-chain/.');
    process.exit(1);
  }

  return { url, anonKey };
}
