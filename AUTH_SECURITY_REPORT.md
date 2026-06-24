# Authentication Security Report — Phase D

**Project:** AgroElevate (`agro-fair-chain`)  
**Date:** 2025-06-24  
**Reviewer:** Phase D implementation (automated design review)

---

## 1. Threat Model (Scope)

| Asset | Risk |
|-------|------|
| User credentials | Credential stuffing, weak passwords |
| Session tokens | XSS theft from `localStorage` |
| Profile PII (phone, address, bank) | Unauthorized read/write |
| Wallet / orders | IDOR via missing RLS |
| Admin actions | Privilege escalation |

---

## 2. Controls Implemented

### 2.1 Authentication

| Control | Implementation | Rating |
|---------|----------------|--------|
| Email + password | Supabase Auth (`signInWithPassword`, `signUp`) | ✅ Strong |
| Password minimum length | 6 chars (Zod) — consider 8+ for production | ⚠️ Moderate |
| Email verification | `email_confirmed_at` gate in `ProtectedRoute` | ✅ Strong |
| Password reset | `resetPasswordForEmail` + `updateUser` on recovery session | ✅ Strong |
| Global logout | `signOut({ scope: 'global' })` | ✅ Good |
| Session refresh | `autoRefreshToken: true` | ✅ Good |

### 2.2 Authorization

| Control | Implementation | Rating |
|---------|----------------|--------|
| Row Level Security | Enabled on `profiles`, `users`, orders, wallet (migration 001) | ✅ Strong |
| Own-row policies | `profiles_select_own`, `users_select_own` | ✅ Strong |
| Admin policies | `profiles_admin_select/update`, `users_admin_update` (migration 006) | ✅ Strong |
| Role route guard | `RoleRoute` checks `profile.role === 'admin'` | ✅ Good (UI layer) |
| Suspended users | `ProtectedRoute` blocks app access | ✅ Good |
| Pending approval | Optional workflow via `profiles.approved` | ✅ Good |

**Defense in depth:** UI guards + Postgres RLS + `is_admin()` SQL function.

### 2.3 Account Lifecycle

| Control | Implementation |
|---------|----------------|
| Registration metadata | Stored in `auth.users.raw_user_meta_data`, copied to `profiles` |
| Wallet row creation | `ensureUserRecords()` + RPC fallback — prevents orphan auth users |
| Role assignment | User-selected at signup; not client-writable after insert (no role field on profile update form) |

---

## 3. Findings & Recommendations

### 3.1 Medium — Session storage in localStorage

**Finding:** Supabase JS persists sessions in `localStorage` by default. Any XSS vulnerability allows token theft.

**Mitigation:**
- Keep dependencies updated; avoid `dangerouslySetInnerHTML`
- Consider Supabase PKCE + httpOnly cookies via SSR proxy (future enhancement)
- Content Security Policy headers on hosting platform

**Current status:** Acceptable for SPA + student project; document risk.

### 3.2 Medium — Password policy (6 characters)

**Finding:** Minimum password length is 6 characters.

**Recommendation:** Increase to 8+ and enable Supabase leaked-password protection in dashboard.

### 3.3 Low — Bank account in profile

**Finding:** Bank account stored in plaintext `profiles.bank_account`.

**Recommendation:** For production payments, use tokenized payment provider; never store full account numbers. Mask in UI (show last 4 digits).

### 3.4 Low — Email enumeration on forgot password

**Finding:** Supabase may reveal whether an email exists depending on project settings.

**Recommendation:** Enable "secure email change" and consistent response messaging in Supabase Auth settings.

### 3.5 Informational — Admin role assignment

**Finding:** Admin role cannot be self-assigned via UI. Must be set directly in `profiles` table (or Supabase dashboard).

**Recommendation:** Document admin bootstrap procedure for deployers.

### 3.6 Resolved — Previous gaps

| Gap | Resolution |
|-----|------------|
| Missing `users` row on signup | `ensureUserRecords()` |
| No email verification UX | `/verify-email` + guard |
| Duplicate auth in Navbar | Unified `useAuth` |
| Admin could not list users | Migration 006 RLS |
| Demo client commented in source | Removed |

---

## 4. RLS Policy Summary

```
profiles:
  SELECT  — own row OR is_admin()
  INSERT  — id = auth.uid()
  UPDATE  — own row OR is_admin()

users:
  SELECT  — uid = auth.uid() OR is_admin()
  INSERT  — uid = auth.uid()::text
  UPDATE  — is_admin() (wallet balance via SECURITY DEFINER RPC only)
```

Wallet mutations remain restricted to `SECURITY DEFINER` RPCs from migration 002 — clients cannot arbitrarily set `walletBalance`.

---

## 5. Security Checklist for Deployment

- [ ] Apply migration `20250625100006_prod_auth_profiles.sql`
- [ ] Enable email confirmation in Supabase Auth
- [ ] Configure Site URL + redirect URLs (`/login`, `/reset-password`)
- [ ] Set strong password requirements in Supabase dashboard
- [ ] Bootstrap at least one admin: `UPDATE profiles SET role = 'admin' WHERE email = '...'`
- [ ] Never commit `.env` or service role key to git
- [ ] Use only `VITE_SUPABASE_ANON_KEY` in frontend (current setup ✅)
- [ ] Enable HTTPS on production host

---

## 6. Conclusion

Phase D establishes **production-ready Supabase Authentication** with layered authorization (client guards + RLS). Remaining risks are typical for client-side SPAs (XSS/session storage, password policy). No demo auth bypasses remain in the codebase. Apply migration 006 and Supabase dashboard hardening before public launch.
