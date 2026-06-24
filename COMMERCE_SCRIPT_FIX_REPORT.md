# Commerce Script Fix Report

**Date:** 2025-06-25  
**Issue:** `npm run commerce:smoke` and `npm run commerce:verify` reported missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` despite `.env` existing.

---

## Root cause

1. **No `dotenv` package** — scripts used inline `readFileSync` + regex parsing duplicated in each file. `package.json` does not list `dotenv`.

2. **Silent failure** — `loadEnv()` wrapped file read in `try/catch` with an empty catch (`/* no .env */`). Any read error (path, permissions, encoding) produced **no diagnostic output**, only the generic “Missing VITE_SUPABASE_URL” message.

3. **Fragile parser** — the regex `^([^#=]+)=(.*)$` split on `\n` only (not `\r\n` consistently on all lines), did not strip UTF-8 BOM from the first key, did not support `export KEY=value` or quoted values, and could leave `\r` on values on some Windows saves.

4. **Fixed path assumption** — `resolve(__dirname, '..')` works when scripts live in `agro-fair-chain/scripts/`, but provided no visibility into **which** `.env` path was attempted when loading failed.

In environments where `.env` read failed silently (sandbox, wrong working directory context, or encoding edge cases), both scripts exited before any Supabase calls.

---

## Fix

Added shared module **`scripts/load-env.mjs`**:

| Feature | Behavior |
|---------|----------|
| Root resolution | Walk up from caller script until `package.json` is found |
| `.env` path | `{projectRoot}/.env` |
| Parser | BOM strip, `\r\n` lines, `export` prefix, quoted values |
| Debug logging | `process.cwd()`, resolved path, file exists, URL/key detected (masked) |
| No overwrite | Does not replace vars already in `process.env` |

Updated:

- `scripts/commerce-smoke.mjs` → `requireSupabaseEnv(import.meta.url)`
- `scripts/commerce-verify.mjs` → `loadProjectEnv(import.meta.url, { debug: true })`

**Not changed:** business logic, migrations, Supabase RPC behavior.

---

## Files changed

| File | Change |
|------|--------|
| `scripts/load-env.mjs` | **New** — shared env loader + debug |
| `scripts/commerce-smoke.mjs` | Use `load-env.mjs` |
| `scripts/commerce-verify.mjs` | Use `load-env.mjs` |

---

## Verification results

### `npm run commerce:smoke`

```
[env] process.cwd(): C:\Users\fuzzy\agroelevateweb\agro-fair-chain
[env] resolved .env path: C:\Users\fuzzy\agroelevateweb\agro-fair-chain\.env
[env] .env file exists: true
[env] VITE_SUPABASE_URL detected: true (https://aosnytcfcazlaolozehx.sup…)
[env] VITE_SUPABASE_ANON_KEY detected: true (…wtiDIS4A)

--- 6/6 smoke checks passed ---
```

**Exit code:** 0

### `npm run commerce:verify`

```
[env] process.cwd(): C:\Users\fuzzy\agroelevateweb\agro-fair-chain
[env] resolved .env path: C:\Users\fuzzy\agroelevateweb\agro-fair-chain\.env
[env] .env file exists: true
[env] VITE_SUPABASE_URL detected: true
[env] VITE_SUPABASE_ANON_KEY detected: true

✗ Farmer account ready — signUp farmer: email rate limit exceeded
RATE_LIMITED=1
```

**Exit code:** 1 — **env loading succeeded**; failure is Supabase signup rate limit (documented in `MANUAL_COMMERCE_TEST.md`).

**Workaround for verify:** add `SUPABASE_SERVICE_ROLE_KEY` to `.env` or use pre-created test account emails.

---

## Usage notes

- Run scripts from **`agro-fair-chain/`** (where `package.json` and `.env` live):
  ```powershell
  cd agro-fair-chain
  npm run commerce:smoke
  npm run commerce:verify
  ```
- Debug `[env]` lines print on every run to confirm loading.
- Optional: set `SUPABASE_SERVICE_ROLE_KEY` in `.env` for verify to bypass signup rate limits.
