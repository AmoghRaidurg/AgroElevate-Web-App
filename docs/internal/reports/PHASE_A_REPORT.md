# Phase A Implementation Report

**Project:** AgroElevate Student Edition  
**Phase:** A — Foundation (Security + Atomic Commerce)  
**Status:** Complete (code); migrations must be applied to Supabase manually  
**Date:** 2025-06-24

---

## Summary

Phase A establishes a secure, version-controlled database foundation with Row Level Security, server-side wallet and checkout logic via Postgres RPC functions, route guards on protected pages, and frontend integration that no longer performs financial writes from the browser.

---

## Tickets Completed

| Ticket | Description | Status |
|--------|-------------|--------|
| DB-001 | Baseline migrations (`profiles`, `products`, `orders`) | Done |
| BE-001 | Secrets hygiene (`.env.example`, `.gitignore`, remove test scripts) | Done |
| DB-002 | RLS policies | Done |
| FE-002 | Route guards (`ProtectedRoute`, `RoleRoute`) | Done |
| DB-008 | Product/order schema extensions | Done |
| BE-002 | Wallet RPCs (`transfer_funds`, `add_funds`, `get_wallet_balance`) | Done |
| BE-003 | `checkout_order` RPC | Done |
| FE-003 | Wallet RPC integration | Done |
| FE-008 | Checkout RPC integration | Done |

---

## Files Changed

### Created

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase CLI local dev configuration |
| `supabase/migrations/20250624000001_baseline_schema.sql` | DB-001: Core tables and indexes |
| `supabase/migrations/20250624000002_rls_policies.sql` | DB-002: RLS + `is_admin()` helper |
| `supabase/migrations/20250624000003_schema_extensions.sql` | DB-008: Nullable AI/commerce extension columns |
| `supabase/migrations/20250624000004_rpc_wallet.sql` | BE-002: Wallet RPC functions |
| `supabase/migrations/20250624000005_rpc_checkout.sql` | BE-003: Atomic checkout RPC |
| `.env.example` | BE-001: Documented environment variable template |
| `src/components/auth/ProtectedRoute.tsx` | FE-002: Auth-required route wrapper |
| `src/components/auth/RoleRoute.tsx` | FE-002: Role-restricted route wrapper |
| `src/lib/checkout.ts` | FE-008: Checkout RPC client helper |
| `PHASE_A_REPORT.md` | This report |

### Modified

| File | Changes |
|------|---------|
| `.gitignore` | Added `.env`, `.env.local`, `.env.*.local` |
| `src/App.tsx` | Wrapped `/dashboard`, `/wallet` with `ProtectedRoute`; `/admin` with `RoleRoute` |
| `src/lib/wallet.ts` | Uses `get_wallet_balance` and `add_funds` RPCs; removed client-side `transferFunds` |
| `src/pages/Marketplace.tsx` | Checkout calls `checkout_order` RPC instead of client-side transfers |
| `src/pages/Wallet.tsx` | Relies on `ProtectedRoute` for auth (removed inline login gate) |
| `src/pages/Login.tsx` | Redirects to `location.state.from` after login |

### Deleted

| File | Reason |
|------|--------|
| `test-db.js` | BE-001: Contained hardcoded Supabase credentials |
| `test-db-2.js` | BE-001: Contained hardcoded Supabase credentials |
| `test-db-3.js` | BE-001: Contained hardcoded Supabase credentials |
| `test-db-4.js` | BE-001: Contained hardcoded Supabase credentials |

### Not modified (intentionally)

| File | Reason |
|------|--------|
| `supabase/functions/razorpay-create-order/index.ts` | Razorpay deferred to Phase C |
| `src/pages/Dashboard.tsx` | Dashboard redesign deferred |
| AI / ML files | Phase B scope |
| `.env` | Left in place locally; now gitignored for future commits |

---

## Migrations Created

Apply **in order** via Supabase SQL Editor or `supabase db push`:

| # | Migration file | Contents |
|---|----------------|----------|
| 1 | `20250624000001_baseline_schema.sql` | `profiles`, `products`, `orders` tables; constraints; indexes |
| 2 | `20250624000002_rls_policies.sql` | `is_admin()` function; RLS enable + policies |
| 3 | `20250624000003_schema_extensions.sql` | Extension columns on `products` and `orders` |
| 4 | `20250624000004_rpc_wallet.sql` | `_wallet_transfer`, `get_wallet_balance`, `add_funds`, `transfer_funds` |
| 5 | `20250624000005_rpc_checkout.sql` | `checkout_order` |

> **Note:** Migrations use `IF NOT EXISTS` / `DROP POLICY IF EXISTS` where possible so they are safe to run against the existing hosted Supabase project.

---

## RPC Functions Added

| Function | Parameters | Returns | Callable by | Purpose |
|----------|------------|---------|-------------|---------|
| `is_admin()` | — | `BOOLEAN` | `authenticated` | RLS helper — checks if caller is admin |
| `_wallet_transfer` | `p_sender_id`, `p_receiver_id`, `p_amount` | `VOID` | **Internal only** | Double-entry wallet transfer with balance check |
| `get_wallet_balance` | — | `NUMERIC` | `authenticated` | Sum of caller's `wallet_tx` ledger rows |
| `add_funds` | `p_amount` | `VOID` | `authenticated` | Mock deposit (until Razorpay in Phase C) |
| `transfer_funds` | `p_receiver_id`, `p_amount` | `VOID` | `authenticated` | Peer transfer; sender = `auth.uid()` |
| `checkout_order` | `cart` (JSONB) | `JSONB` | `authenticated` | Atomic cart checkout with royalty split |

### `cart` JSON format for `checkout_order`

```json
[
  { "id": "product-uuid", "qty": 2 },
  { "id": "product-uuid", "qty": 5 }
]
```

### `checkout_order` return value

```json
{
  "order_id": "uuid",
  "total_amount": 1500.00,
  "item_count": 2
}
```

### Royalty logic (server-side)

When a product's `description` JSON contains `original_farmer_id`:
- **12.5%** → original farmer
- **87.5%** → seller (trader)

---

## RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Own row or admin | Own row (`id = auth.uid()`) | Own row | — |
| `products` | Everyone (public marketplace browse) | `seller_id = auth.uid()` | Own listings | Own listings |
| `orders` | Own rows (`buyer_id = auth.uid()`) or admin | **RPC only** | **RPC only** | **Denied** |

---

## Route Guard Behavior

| Route | Guard | Unauthenticated | Non-admin on `/admin` |
|-------|-------|-----------------|------------------------|
| `/` | None | Allowed | — |
| `/login`, `/register` | None | Allowed | — |
| `/marketplace` | None | Allowed (browse); checkout requires login in-page | — |
| `/dashboard` | `ProtectedRoute` | → `/login` | — |
| `/wallet` | `ProtectedRoute` | → `/login` | — |
| `/admin` | `RoleRoute` (`admin`) | → `/login` | → `/dashboard` |

Login redirects back to the originally requested page via `location.state.from`.

---

## Manual Steps Required

### 1. Apply migrations to Supabase

**Option A — Supabase Dashboard (recommended for FYP)**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Run each migration file **in order** (copy/paste full contents):
   - `20250624000001_baseline_schema.sql`
   - `20250624000002_rls_policies.sql`
   - `20250624000003_schema_extensions.sql`
   - `20250624000004_rpc_wallet.sql`
   - `20250624000005_rpc_checkout.sql`
3. Confirm no errors in the output panel

**Option B — Supabase CLI**

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase → **Project Settings → API**.

### 3. Stop tracking `.env` in git (if previously committed)

```bash
git rm --cached .env
```

`.env` is now in `.gitignore`. Keep your local copy; do not commit it.

### 4. Create an admin user (optional, for `/admin` testing)

After registering a normal account, run in SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin@email.com';
```

### 5. Disable email confirmation (optional, for easier local testing)

Supabase Dashboard → **Authentication → Providers → Email** → disable "Confirm email"  
(Already reflected in `supabase/config.toml` for local CLI use.)

---

## How to Test Locally

### Prerequisites

- Node.js 18+
- Supabase project with all 5 migrations applied
- `.env` configured

### Start the app

```bash
cd agro-fair-chain
npm install
npm run dev
```

App runs at **http://localhost:8080**

---

### Test 1 — Route guards

| Step | Action | Expected |
|------|--------|----------|
| 1 | Visit `/wallet` while logged out | Redirect to `/login` |
| 2 | Visit `/dashboard` while logged out | Redirect to `/login` |
| 3 | Visit `/admin` while logged out | Redirect to `/login` |
| 4 | Log in as non-admin, visit `/admin` | Redirect to `/dashboard` |
| 5 | Log in, visit `/wallet` | Wallet page loads |

---

### Test 2 — Wallet RPC (`add_funds` + `get_wallet_balance`)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register/login as any role | Session active |
| 2 | Go to `/wallet` | Balance shows ₹0 |
| 3 | Click **Add Funds**, enter `1000`, submit | Success toast; balance = ₹1,000 |
| 4 | Refresh page | Balance persists; deposit appears in transaction history |

**Verify in Supabase:** `orders` table has a row with `status = 'wallet_tx'`, `total_amount = 1000`, `items = [{"type":"deposit"}]`.

---

### Test 3 — Marketplace listing (farmer)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register as **Farmer** | Profile created |
| 2 | Go to `/marketplace` | "List Produce" form visible |
| 3 | List Wheat, 100 kg, ₹25/kg | Success toast; product appears in grid |

---

### Test 4 — Atomic checkout (`checkout_order`)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register as **Middleman** (trader) | — |
| 2 | Add ₹5,000 via `/wallet` | Balance updated |
| 3 | Go to `/marketplace`, add farmer's product to cart | Cart summary appears |
| 4 | Click **Pay & Checkout** | Success toast with total; balance reduced; product quantity decremented |
| 5 | Check farmer's wallet (login as farmer) | Transfer-in transaction visible |

**Failure cases to verify:**

| Case | Expected error |
|------|----------------|
| Checkout with insufficient balance | Toast: "Insufficient wallet balance" |
| Checkout quantity > stock | Toast: "Insufficient stock for …" |
| Buy own listing | Toast: "Cannot purchase your own listing" |

---

### Test 5 — Royalty split (trader → industrialist chain)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Trader buys from farmer | Inventory item appears |
| 2 | Trader clicks **Sell** on inventory, sets relist price | New product with "Trader Certified" badge |
| 3 | Register/login as **Industrialist**, add wallet funds | — |
| 4 | Buy relisted product | Checkout succeeds |
| 5 | Login as **original farmer**, check `/wallet` | Royalty transfer-in (~12.5% of sale) |

---

### Test 6 — RLS verification

Run in Supabase SQL Editor (as sanity check — not from frontend):

```sql
-- Should return only policies, no direct insert without auth context
SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public';
```

From browser DevTools, confirm that direct `supabase.from('orders').insert(...)` from the client **fails** with an RLS violation (orders writes are RPC-only).

---

### Test 7 — Build passes

```bash
npm run build
```

Expected: exit code 0, `dist/` generated.

---

## Known Limitations (Phase A)

| Item | Notes |
|------|-------|
| Mock wallet deposits | `add_funds` RPC simulates payment; Razorpay in Phase C |
| Trader relist | Still uses `prompt()` + page reload; inventory lots deferred |
| Admin panel | Protected by role but still read-only |
| `transfer_funds` RPC | Exposed but not used by frontend (checkout handles transfers) |
| Email confirmation | Depends on Supabase project settings |
| Migrations | Not auto-applied; manual step required on hosted Supabase |

---

## Next Phase

**Phase B — Farmer AI** (not started):
- Reference crop/district tables
- Farm profile onboarding
- Mandi price ingestion
- Crop recommendation model
- Farmer intelligence dashboard

**Phase C — Authentication & Payments** (not started):
- Razorpay test mode integration
- Password reset UX

---

## Quick Reference — Frontend API Usage

```typescript
// Wallet balance + history
import { getWalletInfo, addFunds } from '@/lib/wallet';
await getWalletInfo(userId);
await addFunds(userId, 1000);

// Checkout
import { checkoutOrder } from '@/lib/checkout';
await checkoutOrder([{ id: 'product-uuid', qty: 2 }]);
```

---

*Phase A implementation complete. Apply migrations before testing. Do not proceed to Phase B until all tests above pass.*
