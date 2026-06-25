# Commerce Redesign Plan — AgroElevate

**Date:** 2025-06-24  
**Scope:** Wallet fix + royalty model alignment (no Razorpay)

---

## Problem Statement

1. **Wallet broken:** `users.phoneNumber` NOT NULL violated on `_ensure_users_row`
2. **Wrong ledger semantics:** Checkout used `transfer_out`/`transfer_in` instead of `purchase`/`sale_income`/`royalty_income`
3. **Incomplete ownership:** Product metadata lacked structured `ownership_chain` and `royalty_percent`
4. **Dashboard gaps:** Farmer royalty not separated from direct sales; industrialist royalty obligations not shown

---

## Implementation Phases

### Phase F1 — Wallet provisioning (COMPLETE)

| Deliverable | Status |
|-------------|--------|
| Migration 009 | ✅ Created |
| `_resolve_user_identity` | ✅ |
| `_ensure_users_row` full columns | ✅ |
| `ensure_profile_from_auth` fix | ✅ |
| Profiles → users backfill | ✅ |
| `auth.ts` RPC-only provisioning | ✅ |
| `WALLET_FIX_REPORT.md` | ✅ |
| `npm run build` | ✅ Passed |

**Deploy:** Apply `20250625100009_prod_users_wallet_provision_fix.sql`

---

### Phase F2 — Royalty commerce RPC (COMPLETE)

| Deliverable | Status |
|-------------|--------|
| Migration 010 | ✅ Created |
| `order_items` royalty + chain columns | ✅ Additive |
| `_commerce_settle_sale` | ✅ |
| `checkout_order` rewrite | ✅ |
| `ROYALTY_ARCHITECTURE.md` | ✅ |
| `npm run build` | ✅ Passed |

**Deploy:** Apply `20250625100010_prod_commerce_royalty_v2.sql`

---

### Phase F3 — Frontend alignment (COMPLETE)

| File | Change |
|------|--------|
| `src/lib/commerceMeta.ts` | **New** — ownership JSON helpers |
| `src/lib/wallet.ts` | Full transaction type union |
| `src/lib/marketplaceData.ts` | Royalty stats, order item fields |
| `src/pages/Marketplace.tsx` | Farmer listing meta on create |
| `src/components/dashboard/FarmerDashboardSection.tsx` | Direct + royalty KPIs |
| `src/pages/Orders.tsx` | Royalty + ownership chain display |
| `src/pages/Wallet.tsx` | Outflow types include royalty_paid |
| `scripts/commerce-verify.mjs` | `royalty_income` type check |

---

## Migration Apply Order

```
001 prod_rls
002 prod_wallet_rpc
003 prod_checkout_rpc
004 prod_status_constraint
005 prod_ai_tables
006 prod_auth_profiles
007 prod_commerce_rls_fix
008 prod_wallet_balance_sync
009 prod_users_wallet_provision_fix   ← REQUIRED for add_funds
010 prod_commerce_royalty_v2          ← REQUIRED for royalty model
```

---

## Verification Checklist

```bash
npm run commerce:smoke    # 6/6 RPC checks
npm run commerce:verify   # Full E2E (needs test accounts)
npm run build             # Production build
```

Manual: see `MANUAL_COMMERCE_TEST.md`

---

## Out of Scope (this phase)

- Razorpay integration
- `withdrawal` / `refund` RPCs (types defined, not wired)
- Inventory RPC (trader relist still client-side)
- `crops` table unification

---

## Success Criteria

| Criterion | Target |
|-----------|--------|
| `add_funds` | No phoneNumber error |
| Farmer → Trader checkout | Farmer `sale_income`, no royalty |
| Trader → Industrialist | `royalty_income` to farmer at 12.5% |
| Farmer → Industrialist | Full payment to farmer, chain stored |
| Wallet history | Semantic types on every movement |
| Orders page | Royalty amount + chain visible |
| Farmer dashboard | Direct sales + royalty split |
| Build | Passes |

---

## Next Steps

1. Apply migrations **009** and **010** to Supabase
2. Run `npm run commerce:verify` or manual test guide
3. Update `COMMERCE_READY_FOR_PAYMENT_GATEWAY.md` when E2E green
4. Only then begin Razorpay design
