# Option B — Migration Plan

**Date:** 2025-06-25  
**Status:** Plan only — **do not apply SQL**  
**Supersedes:** Monolithic `CUSTOMER_ROLE_PATCH.sql` apply  
**Production state:** Migrations 007 + 008 applied; 009 failed; 010 + 011 not applied

---

## 1. Executive summary

Option B splits commerce work into **three independent phases**:

| Phase | Goal | Risk | Depends on |
|-------|------|------|------------|
| **Phase 1** | Wallet provisioning + `customer` compatibility | Low | 007, 008 |
| **Phase 2** | Trader resale immediate royalty (rule 3) | Medium | Phase 1 |
| **Phase 3** | Manufacturing + deferred downstream royalty (rules 4–5) | High | Phase 2 |

**Do not apply `CUSTOMER_ROLE_PATCH.sql` as a single file.** Its sections map to phases below.

---

## 2. `CUSTOMER_ROLE_PATCH.sql` section mapping

| Patch section | Lines (approx) | Target phase | Apply in Phase 1? |
|---------------|----------------|--------------|-------------------|
| §1 Role helpers | 10–69 | Phase 1 | **Yes** |
| §2 Constraint expansion | 71–89 | Phase 1 | **Yes** |
| §3 Provisioning + backfill | 91–278 | Phase 1 | **Yes** |
| §4 `order_items` columns | 280–294 | Phase 2 | **No** — defer |
| §5 Commerce helpers | 296–435 | Phase 2 (partial) | **No** |
| §6 `checkout_order` rewrite | 437–594 | Phase 2 (revised) | **No** — needs role-pair matrix |
| §7 AI role CHECK expansion | 596–634 | Phase 1 (optional) | **Optional** |

### Phase 1 deliverable (future SQL file)

`PHASE_1_WALLET_CUSTOMER.sql` — extract §1–§3 (+ optional §7) only.

- **Does not** alter `checkout_order` beyond current production (migration 003).
- **Does not** add `order_items` royalty columns.
- Ensures Android `customer` and web `middleman` can provision wallets and checkout at zero royalty.

### Phase 2 deliverable (future SQL file)

`PHASE_2_TRADER_ROYALTY.sql` — new checkout logic with explicit role-pair matrix.

- Additive `order_items` columns (from patch §4).
- `_parse_product_commerce_meta`, `_build_ownership_chain`, `_commerce_settle_sale`.
- `checkout_order` v2: rules 1–3 only; **no manufacturing**.

### Phase 3 deliverable (future SQL file)

`PHASE_3_MANUFACTURING_ROYALTY.sql` — new tables + RPCs.

- `manufacturing_batches`, `processed_products`, `royalty_obligations`.
- Obligation creation on farmer → industrialist.
- Deferred settlement on processed product sale.
- RLS for new tables.

---

## 3. Phase 1 — Wallet provisioning and customer compatibility

### 3.1 Objectives

1. Fix failed migration 009 (`middleman` / `customer` vs `users_role_check`).
2. Backfill `users` rows for all `profiles` without corrupting roles.
3. Preserve Android `customer` accounts.
4. **Leave checkout semantics stable** (production 003 RPC) until Phase 2.

### 3.2 Scope (from patch)

| Component | Action |
|-----------|--------|
| `_is_valid_profile_role` / `_is_valid_users_role` | Create |
| `_role_for_profiles_table` / `_role_for_users_table` | Create — `middleman` ↔ `trader` only |
| `_buyer_participates_in_royalty_chain` | Create — used in Phase 2, harmless in Phase 1 |
| `profiles_role_check` / `users_role_check` | Expand to full role union incl. `customer` |
| `_resolve_user_identity` | Replace |
| `_ensure_users_row` | Replace — full NOT NULL columns |
| `ensure_profile_from_auth` | Replace |
| Profiles → users backfill | Idempotent INSERT |
| AI table role CHECKs | Optional expand |

### 3.3 Explicitly out of scope

- `checkout_order` rewrite
- `order_items` royalty columns
- `_commerce_settle_sale`
- Manufacturing tables
- Frontend changes (recommended in parallel, not blocking DB)

### 3.4 Checkout behavior during Phase 1

Production continues using **migration 003** `checkout_order`:

| Path | Current 003 behavior | Option B rule | Phase 1 acceptable? |
|------|---------------------|---------------|---------------------|
| Farmer → Customer | No royalty if no relist meta | Rule 1: royalty = 0 | ✓ |
| Farmer → Trader | Full payment to farmer | Rule 2: royalty = 0 | ✓ |
| Trader → Industrialist | Royalty if `original_farmer_id` in meta | Rule 3: royalty | ✓ (if relist meta present) |
| Farmer → Industrialist | Full payment | Rule 4: deferred | ✓ (no deferred yet — OK until Phase 3) |

**Known Phase 1 gap:** 003 may apply royalty when `original_farmer_id` is set but buyer is `customer`. Phase 2 checkout must fix this. **Mitigation:** customer purchases are typically direct from farmer listings (no relist meta). Document in manual test.

### 3.5 Frontend recommendations (parallel, not SQL)

| File | Change |
|------|--------|
| `src/types/auth.ts` | Add `customer` to `UserRole` |
| `src/pages/Markplace.tsx` | `canPurchase` includes `customer` |
| `src/pages/Dashboard.tsx` | Customer-specific view or redirect to orders |

### 3.6 Verification

```bash
npm run commerce:smoke
# Manual: customer wallet add_funds + buy farmer listing
# SQL: profiles_missing_users = 0
# SQL: no users.role = 'farmer' where profiles.role = 'customer'
```

### 3.7 Rollback strategy

Functions are `CREATE OR REPLACE` — prior versions restorable from git. Constraints: re-ADD previous CHECK only if all rows validate (keep backup before apply).

---

## 4. Phase 2 — Trader resale royalty

### 4.1 Objectives

Implement rules **1–3** with an explicit **buyer × seller role matrix**. Do not introduce manufacturing yet.

### 4.2 Royalty trigger matrix (Phase 2)

| seller_role | buyer_role | Royalty |
|-------------|------------|---------|
| `farmer` | `customer` | 0 |
| `farmer` | `middleman` / `trader` | 0 |
| `farmer` | `industrialist` | 0 |
| `middleman` / `trader` | `industrialist` | 10–12.5% immediate |
| `middleman` / `trader` | `customer` | 0 |
| `middleman` / `trader` | `farmer` | 0 |
| `industrialist` | * | 0 (processed logic = Phase 3) |

### 4.3 Scope

| Component | Action |
|-----------|--------|
| `order_items` | Add `royaltyAmount`, `royaltyPercent`, `ownershipChain`, `sellerId` (IF NOT EXISTS) |
| `_parse_product_commerce_meta` | Create / replace |
| `_build_ownership_chain` | Create — only when royalty chain applies |
| `_commerce_settle_sale` | Create — immediate royalty only |
| `_resolve_sale_royalty_mode` | **New** — role-pair decision |
| `checkout_order` | Replace — use matrix; customer always excluded |
| `royalty_obligations` | **Optional** audit rows for immediate settlements (type = `immediate`, status = `settled`) |

### 4.4 Out of scope

- `manufacturing_batches`, `processed_products`
- Deferred obligation creation
- Farmer → Industrialist special handling beyond royalty = 0

### 4.5 Gaps fixed vs `CUSTOMER_ROLE_PATCH.sql` §6

| Patch behavior | Phase 2 fix |
|--------------|-------------|
| Royalty when any chain participant buys relist | Only `industrialist` buyer + `trader` seller |
| `farmer` in `_buyer_participates_in_royalty_chain` | Remove from settlement trigger (keep for chain extension only if needed) |
| Default buyer `customer` | Keep — correct for Android |

### 4.6 Frontend alignment

| File | Change |
|------|--------|
| `src/lib/commerceMeta.ts` | `product_kind` enum |
| `src/lib/marketplaceData.ts` | Royalty stats (existing) |
| `src/pages/Orders.tsx` | Royalty display (existing) |
| `src/components/dashboard/FarmerDashboardSection.tsx` | Immediate royalty KPI |

### 4.7 Verification

| Test | Expected |
|------|----------|
| Farmer → Customer | `royaltyAmount = 0`, full `sale_income` to farmer |
| Farmer → Trader | `royaltyAmount = 0` |
| Trader → Industrialist (relist) | `royalty_income` to farmer, `royalty_paid` on trader |
| Customer → Trader relist | `royaltyAmount = 0` (regression test) |
| `npm run commerce:verify` | Pass trader → industrialist path |

---

## 5. Phase 3 — Industrial manufacturing royalty

### 5.1 Objectives

Implement rules **4–5**: deferred obligations and downstream settlement on processed goods sales.

### 5.2 Business flow

```
1. Industrialist checks out farmer raw product
   → checkout (Phase 2 matrix): royalty = 0
   → INSERT manufacturing_batches (status = draft)
   → INSERT royalty_obligations (type = deferred, status = pending)

2. Industrialist completes manufacturing
   → UPDATE batch (status = completed, output_qty)
   → INSERT processed_products
   → Industrialist lists products row (product_kind = processed)

3. Buyer purchases processed listing
   → checkout detects product_kind = processed
   → _settle_deferred_obligations: royalty from sale to farmer
   → UPDATE obligation settled_amount / status
   → wallet: sale_income, royalty_income, royalty_paid
```

### 5.3 Scope

| Component | Action |
|-----------|--------|
| `manufacturing_batches` | CREATE TABLE + RLS |
| `processed_products` | CREATE TABLE + RLS |
| `royalty_obligations` | CREATE TABLE + RLS |
| `create_manufacturing_batch` RPC | From order line |
| `complete_manufacturing_batch` RPC | Batch → processed product |
| `list_processed_product` RPC | Link to `products` |
| `checkout_order` | Extend — `deferred_settle` path |
| `_settle_deferred_obligations` | New |
| `wallet_history` | Link via `royalty_obligation_id` column (additive, nullable) |

### 5.4 Multi-obligation edge cases

| Case | Handling |
|------|----------|
| Batch uses multiple farmer sources | One obligation per source `order_item`; processed SKU lists multiple obligation IDs |
| Partial batch completion | `output_qty` pro-rates pending obligation basis |
| Processed sale qty < batch output | Partial obligation settlement; status `partially_settled` |
| Cancelled batch | Obligation `cancelled`; no settlement allowed |

### 5.5 Android + Web

| Surface | Phase 3 minimum |
|---------|-----------------|
| Android | Manufacturing batch UI, processed listing, checkout |
| Web | Read-only obligation/batch views initially; listing form later |
| Shared | All writes via SECURITY DEFINER RPCs |

### 5.6 Frontend alignment

| File | Change |
|------|--------|
| New `ManufacturingSection.tsx` | Industrialist batch list |
| `FarmerDashboardSection.tsx` | Pending + downstream royalty KPIs |
| `Orders.tsx` | Obligation status on lines |
| `commerceMeta.ts` | `processed_product_id`, `product_kind` |

### 5.7 Verification

| Test | Expected |
|------|----------|
| Farmer → Industrialist | No royalty wallet entries; obligation `pending` |
| Complete batch + list processed | `processed_products` row exists |
| Customer buys processed | Farmer `royalty_income`; obligation `settled` |
| Farmer → Customer raw | Still royalty = 0 (regression) |
| Trader → Industrialist | Still immediate royalty (regression) |

---

## 6. Apply order and dependencies

```
[Applied]  007 prod_commerce_rls_fix
[Applied]  008 prod_wallet_balance_sync
[Failed]   009 — DO NOT RE-RUN
[Hold]     010 — DO NOT APPLY (superseded by Phase 2)
[Hold]     011 — DO NOT APPLY (superseded by Phase 1)
[Hold]     CUSTOMER_ROLE_PATCH.sql — DO NOT APPLY (split into phases)

[Phase 1]  PHASE_1_WALLET_CUSTOMER.sql        (to be generated)
[Phase 2]  PHASE_2_TRADER_ROYALTY.sql         (to be generated)
[Phase 3]  PHASE_3_MANUFACTURING_ROYALTY.sql  (to be generated)
```

**Gate:** Do not start Phase 2 until Phase 1 verification passes.  
**Gate:** Do not start Phase 3 until Phase 2 commerce E2E passes.  
**Gate:** Do not integrate Razorpay until Phase 2 minimum passes.

---

## 7. What Option B adds beyond `CUSTOMER_ROLE_PATCH.sql`

| Requirement | In patch? | Phase |
|-------------|---------|-------|
| Customer role preserved | ✓ §1–3 | 1 |
| Farmer → Customer royalty = 0 | ✓ §6 | 2 (matrix) |
| Farmer → Trader royalty = 0 | Implicit | 2 |
| Trader → Industrialist immediate royalty | Partial §6 | 2 (matrix fix) |
| Farmer → Industrialist deferred obligation | **Missing** | 3 |
| Processed product downstream royalty | **Missing** | 3 |
| `manufacturing_batches` table | **Missing** | 3 |
| `processed_products` table | **Missing** | 3 |
| `royalty_obligations` table | **Missing** | 3 |
| Role-pair decision engine | **Missing** | 2 |
| Dashboard pending royalty | **Missing** | 3 |
| Split phased apply | **Missing** | Plan |

---

## 8. Risk register

| Risk | Phase | Mitigation |
|------|-------|------------|
| 003 checkout royalties customer on relist | 1 | Manual test; fix in Phase 2 |
| Phase 1 constraint ADD fails on orphan role | 1 | Pre-flight `SELECT DISTINCT role` |
| 011 applied before stop | 1 | Audit `users.role` for customer→farmer corruption |
| Trader relist without meta | 2 | Enforce `buildRelistMeta` on web; validate in RPC |
| Double settlement on processed sale | 3 | Idempotent obligation settlement keyed by `order_item.id` |
| Android/Web schema drift | 3 | RPC-only writes; shared types doc |

---

## 9. Testing matrix (all phases)

| # | Actor | Action | Phase |
|---|-------|--------|-------|
| T1 | Customer | Wallet fund + buy farmer listing | 1 |
| T2 | Farmer | Wallet fund + list product | 1 |
| T3 | Trader | Buy farmer + relist | 2 |
| T4 | Industrialist | Buy trader relist | 2 |
| T5 | Farmer | Verify royalty_income on T4 | 2 |
| T6 | Customer | Buy trader relist — royalty must be 0 | 2 |
| T7 | Industrialist | Buy farmer raw | 3 |
| T8 | Industrialist | Complete batch, list processed | 3 |
| T9 | Customer | Buy processed — farmer royalty | 3 |
| T10 | Farmer | Dashboard pending → settled | 3 |

---

## 10. Document deliverables

| Document | Status |
|----------|--------|
| `OPTION_B_ROYALTY_ARCHITECTURE.md` | ✅ This plan’s architecture companion |
| `OPTION_B_MIGRATION_PLAN.md` | ✅ This file |
| `OPTION_B_DATABASE_CHANGES.md` | ✅ Table/RPC specs |
| `PHASE_1_WALLET_CUSTOMER.sql` | ⏳ Generate after plan approval |
| `PHASE_2_TRADER_ROYALTY.sql` | ⏳ After Phase 1 applied |
| `PHASE_3_MANUFACTURING_ROYALTY.sql` | ⏳ After Phase 2 applied |

**No SQL files are included in this deliverable.**
