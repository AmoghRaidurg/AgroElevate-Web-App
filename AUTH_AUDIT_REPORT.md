# Authentication Audit Report — Phase D

**Project:** AgroElevate (`agro-fair-chain`)  
**Date:** 2025-06-24  
**Scope:** Pre- and post-implementation audit of authentication and authorization

---

## Executive Summary

Before Phase D, the app used **real Supabase Auth** for sign-in/sign-up but had **incomplete account provisioning** (no `users` wallet row on registration), **no password reset**, **no email verification UX**, **duplicate auth state** in the navbar, and **limited admin controls**. A commented demo Supabase shim existed in `supabaseClient.ts` but was not active.

Phase D replaces remaining gaps with production-grade flows: unified `useAuth`, profile + wallet row provisioning, route guards, profile page, and admin suspend/approve.

---

## 1. Current Login Flow (Post Phase D)

| Step | Component / Module | Behavior |
|------|-------------------|----------|
| 1 | `Login.tsx` | Wrapped in `GuestRoute` — redirects if already authenticated |
| 2 | `signInWithEmail()` in `lib/auth.ts` | Calls `supabase.auth.signInWithPassword` |
| 3 | Email verification check | If `!email_confirmed_at` → `/verify-email` |
| 4 | `useAuth` `onAuthStateChange` | On `SIGNED_IN`, calls `ensureUserRecords()` |
| 5 | `ensureUserRecords()` | Creates `profiles` + `users` rows if missing |
| 6 | `ProtectedRoute` | Blocks unauthenticated access to protected pages |
| 7 | Redirect | User sent to `location.state.from` or `/dashboard` |

**Password reset path:** `/forgot-password` → email link → `/reset-password` → `updatePassword()`.

---

## 2. Current Registration Flow (Post Phase D)

| Step | Behavior |
|------|----------|
| 1 | User selects role: `farmer`, `middleman`, or `industrialist` |
| 2 | `signUpWithEmail()` stores metadata (`name`, `role`, `address`, `phone`, `bank_account`) |
| 3 | If **session returned** (email confirm OFF): `ensureUserRecords()` inserts `profiles` + `users` |
| 4 | If **no session** (email confirm ON): user directed to `/verify-email`; records created on first verified login via `ensureUserRecords()` or RPC `ensure_profile_from_auth` |
| 5 | `users` row: `uid`, `name`, `role`, `walletBalance: 0`, `approved: true` |

---

## 3. Demo Users

| Item | Status |
|------|--------|
| Hardcoded demo login credentials | **None** in production code |
| `src/data/demo.ts` | Static **product/transaction** fixtures only — **not imported** by any page |
| Commented demo Supabase client in `supabaseClient.ts` | **Removed** in Phase D |
| Synthetic AI training data | Unrelated to auth (`ai-service/data/`) |

**No demo auth users exist.** All accounts are real Supabase Auth users.

---

## 4. Hardcoded Roles

| Location | Finding |
|----------|---------|
| `Register.tsx` | Role chosen at signup via radio — stored in `profiles.role` and `users.role` |
| `RoleRoute.tsx` | Admin route requires `profile.role === 'admin'` |
| `is_admin()` SQL function | Checks `profiles.role = 'admin'` (migration 001) |
| Default fallback in `ensure_profile_from_auth` | Defaults to `farmer` if metadata missing |

**Admin role** is not self-assignable at registration (constraint `profiles_role_check` allows admin in DB but UI only offers farmer/middleman/industrialist).

---

## 5. Bypasses & Gaps (Before → After)

| Issue | Before | After Phase D |
|-------|--------|---------------|
| Register without `users` row | Wallet RPC created row lazily | `ensureUserRecords()` on signup/login |
| Navigate to dashboard without email verify | Yes | Redirect to `/verify-email` |
| No password reset | `alert()` on login error only | `/forgot-password`, `/reset-password` |
| Navbar separate `getUser()` | Race with `useAuth` | Single `useAuth` source |
| Admin sees all users | RLS blocked cross-user reads | Migration 006 admin policies |
| Suspend / approve | Not implemented | Admin UI + `profiles.suspended`, `approved` |
| Marketplace public | Public (by design) | Unchanged — intentional |
| Session persistence | Supabase default | Explicit `persistSession`, `localStorage` |

---

## 6. Route Protection Matrix

| Route | Guard | Notes |
|-------|-------|-------|
| `/dashboard` | `ProtectedRoute` | Auth required |
| `/wallet` | `ProtectedRoute` | Auth required |
| `/orders` | `ProtectedRoute` | Auth required |
| `/intelligence` | `ProtectedRoute` | Auth required |
| `/admin` | `RoleRoute` (admin) | Admin role only |
| `/profile` | `ProtectedRoute` | Auth required |
| `/marketplace` | None | Public browsing |
| `/login`, `/register` | `GuestRoute` | Redirect if logged in |

Additional gates inside `ProtectedRoute`:
- Unverified email → `/verify-email`
- `profile.suspended` → `/suspended`
- `profile.approved === false` → `/pending-approval`

---

## 7. Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabaseClient.ts` | Supabase client with session persistence |
| `src/lib/auth.ts` | Auth helpers (signup, reset, ensure records, admin) |
| `src/hooks/useAuth.tsx` | Global session + profile context |
| `src/components/auth/ProtectedRoute.tsx` | Route guard |
| `src/components/auth/RoleRoute.tsx` | Role-based guard |
| `src/components/auth/GuestRoute.tsx` | Inverse guard for login/register |
| `supabase/migrations/production/20250625100006_prod_auth_profiles.sql` | RLS + suspend/approve columns |

---

## 8. Required Supabase Dashboard Settings

1. **Authentication → URL Configuration:** Add site URL and redirect URLs for `/login`, `/reset-password`
2. **Email confirmation:** Enable for production; app handles both modes
3. **Email templates:** Customize confirmation and reset emails (optional)

---

## 9. Migration Required

Apply **`20250625100006_prod_auth_profiles.sql`** after migration 005 for:
- `profiles.suspended`, `profiles.approved` columns
- Admin SELECT/UPDATE policies on `profiles`
- `users_insert_own` policy
- `ensure_profile_from_auth()` RPC fallback

Without migration 006, admin user list and suspend/approve may fail at the database layer; self-registration still works via direct insert policies from migration 001.
