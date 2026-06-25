# Phase 1 Report — Wallet & Customer Compatibility

**Date:** 2025-06-25  
**Status:** Implemented (code + migration ready)  
**Build:** `npm run build` — passed

---

## Objective

Fix wallet provisioning for all production roles including Android `customer`, without changing checkout royalty logic (remains migration 003 until Phase 2).

---

## Migration

**File:** `supabase/migrations/production/20250625100012_phase1_wallet_customer.sql`

| Component | Action |
|-----------|--------|
| `_is_valid_profile_role` / `_is_valid_users_role` | Created |
| `_role_for_profiles_table` / `_role_for_users_table` | `middleman` ↔ `trader`; `customer` pass-through |
| `_buyer_participates_in_royalty_chain` / `_is_trader_role` | Created (used in Phase 2) |
| `profiles_role_check` / `users_role_check` | Expanded to full role union |
| `_resolve_user_identity` | Profile-first with all roles |
| `_ensure_users_row` | Full NOT NULL columns (`phoneNumber`, `address`, `bankUPI`) |
| `ensure_profile_from_auth` | Profiles canonical role; users mapped role |
| Profiles → users backfill | Idempotent INSERT |
| `add_funds` | Ensures users row + reconcile before deposit |
| `transfer_funds` | Ensures sender + receiver users rows |
| AI table role CHECKs | Optional expand for `customer` |

---

## Frontend

| File | Change |
|------|--------|
| `src/types/auth.ts` | Added `customer` to `UserRole` |
| `src/pages/Marketplace.tsx` | `canPurchase` includes `customer` |
| `src/components/dashboard/CustomerDashboardSection.tsx` | New customer dashboard |
| `src/pages/Dashboard.tsx` | Routes `customer` to customer section |
| `src/lib/commerceMeta.ts` | `product_kind` types (prep for Phase 2) |

---

## Roles preserved

`farmer`, `trader`, `middleman`, `industrialist`, `customer`, `admin`

---

## Apply instructions

```text
Supabase SQL Editor → run 20250625100012_phase1_wallet_customer.sql
(after 007 + 008)
```

---

## Verification checklist

- [ ] Pre-flight: `SELECT DISTINCT role FROM profiles` / `users`
- [ ] Apply migration 012
- [ ] `SELECT COUNT(*) FROM profiles p LEFT JOIN users u ON u.uid = p.id::text WHERE u.uid IS NULL` → 0
- [ ] Customer login → Wallet → Add funds (no `phoneNumber` error)
- [ ] Customer buys farmer listing (checkout via 003 — royalty 0 on direct listing)
- [ ] `npm run commerce:smoke`

---

## Not in Phase 1

- `checkout_order` rewrite (Phase 2)
- `order_items` royalty columns (Phase 2)
- Manufacturing tables (Phase 3)
