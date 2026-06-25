# Option B — Database Changes Specification

**Date:** 2025-06-25  
**Status:** Design specification only — **no executable SQL**  
**Companion docs:** `OPTION_B_ROYALTY_ARCHITECTURE.md`, `OPTION_B_MIGRATION_PLAN.md`

---

## 1. Design principles

1. **Additive only** — no `DROP TABLE`, no `DELETE`, no `UPDATE` on existing business rows.
2. **Preserve** `orders`, `order_items`, `wallet_history`, `products`, `profiles`, `users` as-is; extend with nullable columns or new tables.
3. **Android + Web** share RPCs; direct table writes only where RLS already allows (e.g. `products` insert by seller).
4. **camelCase** on legacy tables (`orders`, `order_items`, `wallet_history`, `users`); **snake_case** on new tables and `profiles`/`products`.

---

## 2. Phase 1 changes (wallet + customer)

### 2.1 Constraint modifications (existing tables)

#### `profiles_role_check`

| Property | Value |
|----------|-------|
| Operation | DROP IF EXISTS + ADD |
| Allowed values | `farmer`, `middleman`, `trader`, `industrialist`, `customer`, `admin` |
| Data impact | None if all existing rows validate |

#### `users_role_check`

| Property | Value |
|----------|-------|
| Operation | DROP IF EXISTS + ADD |
| Allowed values | `farmer`, `trader`, `middleman`, `industrialist`, `customer`, `admin` |
| Data impact | None if all existing rows validate |

### 2.2 New functions (replace existing)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `_is_valid_profile_role` | `(p_role TEXT)` | BOOLEAN | Immutable |
| `_is_valid_users_role` | `(p_role TEXT)` | BOOLEAN | Immutable |
| `_role_for_profiles_table` | `(p_role TEXT)` | TEXT | `trader` → `middleman`; `customer` pass-through |
| `_role_for_users_table` | `(p_role TEXT)` | TEXT | `middleman` → `trader`; `customer` pass-through |
| `_buyer_participates_in_royalty_chain` | `(p_buyer_role TEXT)` | BOOLEAN | `true` for B2B buyers except `customer`, `admin` |
| `_resolve_user_identity` | `(p_uid TEXT)` | TABLE(name, role, phone, address, bank, email) | Profile-first; expanded role whitelist |
| `_ensure_users_row` | `(p_uid, p_name?, p_role?)` | VOID | Maps role; inserts full NOT NULL columns |
| `ensure_profile_from_auth` | `()` | VOID | Profiles canonical role; users mapped role |

### 2.3 Data operation (Phase 1 only)

| Operation | Type | Description |
|-----------|------|-------------|
| Profiles → users backfill | `INSERT … ON CONFLICT DO NOTHING` | Missing wallet rows only |

### 2.4 Optional (if migration 005 applied)

Expand `role` CHECK on:

- `ai_crop_recommendations`
- `ai_income_forecasts`
- `ai_user_insights`

Add `customer` to allowed set. No row changes.

### 2.5 Tables unchanged in Phase 1

`orders`, `order_items`, `products`, `wallet_history`, `transactions` — **no schema changes**.

---

## 3. Phase 2 changes (trader resale royalty)

### 3.1 `order_items` — additive columns

| Column | Type | Default | Nullable | Purpose |
|--------|------|---------|----------|---------|
| `royaltyAmount` | NUMERIC | 0 | NOT NULL | ₹ paid to original farmer (immediate) |
| `royaltyPercent` | NUMERIC | 0 | NOT NULL | Rate applied on this line |
| `ownershipChain` | JSONB | NULL | YES | Chain snapshot; NULL for customer purchases |
| `sellerId` | TEXT | NULL | YES | Seller `profiles.id` at time of sale |

**Existing rows:** defaults apply; no backfill required.

### 3.2 New / replaced functions

| Function | Purpose |
|----------|---------|
| `_parse_product_commerce_meta(p_description TEXT)` | Parse `products.description` JSON |
| `_build_ownership_chain(...)` | Append seller/buyer to JSON chain |
| `_resolve_sale_royalty_mode(p_buyer_role, p_seller_role, p_product_kind TEXT)` | Returns `none` \| `immediate` |
| `_commerce_settle_sale(...)` | Wallet split for immediate royalty |
| `checkout_order(cart JSONB)` | Full cart checkout with role matrix |

#### `_resolve_sale_royalty_mode` logic (spec)

| Input | Output |
|-------|--------|
| `buyer_role = customer` | `none` |
| `seller_role = farmer` | `none` |
| `seller_role IN (middleman, trader)` AND `buyer_role = industrialist` | `immediate` |
| All other pairs | `none` |

#### `p_product_kind` derivation

| Condition | Kind |
|-----------|------|
| `description.product_kind = processed` | `processed` (Phase 3 only — Phase 2 returns `none` for royalty) |
| `description.source_order_item_id` present | `trader_relist` |
| `seller_role = farmer` | `raw_farmer` |
| else | `unknown` → `none` |

### 3.3 Optional table: `royalty_obligations` (Phase 2 lightweight)

If created in Phase 2 for audit uniformity (recommended):

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `obligation_type` | TEXT | `immediate` \| `deferred` |
| `status` | TEXT | `settled` for Phase 2 immediate |
| `beneficiary_farmer_id` | TEXT | Original farmer |
| `obligor_id` | TEXT | Trader seller |
| `royalty_percent` | NUMERIC | 10–12.5 |
| `source_order_item_id` | UUID FK → `order_items.id` | Nullable until line inserted |
| `settled_amount` | NUMERIC | = royalty paid |
| `pending_amount` | NUMERIC | 0 for immediate |
| `created_at` | TIMESTAMPTZ | |
| `settled_at` | TIMESTAMPTZ | |

**Phase 2:** only `obligation_type = immediate` rows created at checkout.  
**Phase 3:** reuses same table for `deferred`.

*Alternative:* defer `royalty_obligations` creation to Phase 3; Phase 2 uses only `order_items` + `wallet_history`. Architecture doc recommends early table for uniform dashboard queries.

### 3.4 `wallet_history` — optional additive column (Phase 2 or 3)

| Column | Type | Purpose |
|--------|------|---------|
| `royaltyObligationId` | UUID NULL | FK → `royalty_obligations.id` |

Nullable; existing rows unaffected. Links ledger entries to obligations for dashboard drill-down.

### 3.5 `products.description` JSON schema extension

| Key | Type | Phase | Purpose |
|-----|------|-------|---------|
| `product_kind` | string | 2 | `raw_farmer` \| `trader_relist` \| `processed` |
| `original_farmer_id` | string | 2 | Existing |
| `ownership_chain` | array | 2 | Existing |
| `royalty_percent` | number | 2 | Existing |
| `source_order_item_id` | string | 2 | Trader relist trace |

---

## 4. Phase 3 changes (manufacturing + deferred royalty)

### 4.1 Table: `manufacturing_batches`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `industrialist_id` | UUID | NOT NULL, FK → `profiles.id` | Batch owner |
| `original_farmer_id` | UUID | NOT NULL, FK → `profiles.id` | Royalty beneficiary |
| `source_order_id` | UUID | FK → `orders.id` | Procurement order |
| `source_order_item_id` | UUID | NOT NULL, FK → `order_items.id` | Raw line consumed |
| `source_product_id` | UUID | FK → `products.id` | Raw listing |
| `input_crop_name` | TEXT | NOT NULL | Denormalized label |
| `input_qty` | NUMERIC | NOT NULL, > 0 | Raw qty purchased |
| `input_unit` | TEXT | NOT NULL DEFAULT `kg` | |
| `output_qty` | NUMERIC | NULL | Finished qty (set on complete) |
| `output_unit` | TEXT | NULL | |
| `waste_qty` | NUMERIC | NULL DEFAULT 0 | |
| `status` | TEXT | NOT NULL | `draft`, `in_progress`, `completed`, `cancelled` |
| `royalty_percent` | NUMERIC | NOT NULL | 10–12.5, copied from source |
| `notes` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `completed_at` | TIMESTAMPTZ | NULL | |

**Indexes:**

- `(industrialist_id, status)`
- `(original_farmer_id)`
- `(source_order_item_id)` UNIQUE — one batch per source line (MVP)

### 4.2 Table: `royalty_obligations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `obligation_type` | TEXT | NOT NULL | `immediate` \| `deferred` |
| `status` | TEXT | NOT NULL | `pending`, `partially_settled`, `settled`, `cancelled` |
| `beneficiary_farmer_id` | TEXT | NOT NULL | `profiles.id` as text (matches `order_items.farmerId` style) |
| `obligor_id` | TEXT | NOT NULL | Trader or industrialist uid text |
| `royalty_percent` | NUMERIC | NOT NULL | 10–12.5 |
| `basis_type` | TEXT | NOT NULL DEFAULT `sale_price` | `sale_price` for % of downstream sale |
| `source_order_item_id` | UUID | FK → `order_items.id` | Creating procurement/resale line |
| `manufacturing_batch_id` | UUID | NULL FK → `manufacturing_batches.id` | Set for deferred |
| `pending_amount` | NUMERIC | NOT NULL DEFAULT 0 | Estimated or qty-based hint |
| `settled_amount` | NUMERIC | NOT NULL DEFAULT 0 | Running total paid |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `settled_at` | TIMESTAMPTZ | NULL | Final settlement timestamp |
| `cancelled_at` | TIMESTAMPTZ | NULL | |

**Indexes:**

- `(beneficiary_farmer_id, status)`
- `(obligor_id, status)`
- `(manufacturing_batch_id)`
- `(source_order_item_id)`

**State machine:**

```
deferred: pending → partially_settled → settled
immediate: created as settled (Phase 2)
cancelled: from batch cancellation only; no wallet reversal in MVP
```

### 4.3 Table: `processed_products`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `manufacturing_batch_id` | UUID | NOT NULL FK → `manufacturing_batches.id` | |
| `royalty_obligation_id` | UUID | NOT NULL FK → `royalty_obligations.id` | One obligation per processed SKU (MVP) |
| `industrialist_id` | UUID | NOT NULL FK → `profiles.id` | |
| `original_farmer_id` | UUID | NOT NULL FK → `profiles.id` | Denormalized |
| `name` | TEXT | NOT NULL | e.g. "Wheat Flour 1kg" |
| `sku` | TEXT | NULL | Optional code |
| `unit` | TEXT | NOT NULL | |
| `qty_produced` | NUMERIC | NOT NULL | From batch output |
| `qty_listed` | NUMERIC | NOT NULL DEFAULT 0 | Qty on marketplace |
| `qty_sold` | NUMERIC | NOT NULL DEFAULT 0 | Running total |
| `royalty_percent` | NUMERIC | NOT NULL | Copied from obligation |
| `product_id` | UUID | NULL FK → `products.id` | Set when listed |
| `status` | TEXT | NOT NULL | `created`, `listed`, `depleted`, `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `listed_at` | TIMESTAMPTZ | NULL | |

**Indexes:**

- `(industrialist_id, status)`
- `(product_id)` UNIQUE WHERE `product_id IS NOT NULL`
- `(royalty_obligation_id)`

### 4.4 `products` integration (no alter required)

Processed listing insert sets:

```json
{
  "product_kind": "processed",
  "processed_product_id": "<uuid>",
  "royalty_obligation_id": "<uuid>",
  "original_farmer_id": "<uuid>",
  "royalty_percent": 12.5
}
```

Existing farmer/trader listings unchanged.

### 4.5 `order_items` — Phase 3 additive column (optional)

| Column | Type | Purpose |
|--------|------|---------|
| `royaltyObligationId` | UUID NULL | FK → `royalty_obligations.id` settled on this line |

Enables order history → obligation drill-down.

---

## 5. Phase 3 RPC specifications

### 5.1 `create_manufacturing_batch_from_order_item`

| Property | Value |
|----------|-------|
| Caller | `authenticated` industrialist |
| Input | `p_order_item_id UUID` |
| Validates | Buyer = caller; seller = farmer; line not already batched |
| Creates | `manufacturing_batches` (draft), `royalty_obligations` (deferred, pending) |
| Wallet | None |

### 5.2 `complete_manufacturing_batch`

| Property | Value |
|----------|-------|
| Input | `p_batch_id`, `p_output_qty`, `p_name`, `p_unit` |
| Validates | Caller = industrialist_id; status = draft or in_progress |
| Creates | `processed_products` row |
| Updates | batch status = completed |

### 5.3 `list_processed_product`

| Property | Value |
|----------|-------|
| Input | `p_processed_product_id`, `p_price_per_unit`, `p_qty` |
| Creates | `products` row with processed meta JSON |
| Updates | `processed_products.product_id`, `qty_listed`, status = listed |

### 5.4 `checkout_order` (Phase 3 extension)

Additional branch when `_parse_product_commerce_meta` returns `product_kind = processed`:

1. Validate obligations exist and `status IN (pending, partially_settled)`.
2. Compute `royalty = line_total * royalty_percent / 100`.
3. Call `_commerce_settle_sale` with `p_original_farmer_id` set (immediate wallet path).
4. Call `_record_obligation_settlement(obligation_id, order_item_id, royalty)`.
5. Update `processed_products.qty_sold`.
6. Set `order_items.royaltyObligationId`.

**Customer buying processed:** royalty still flows to farmer (rule 5); customer pays full price; industrialist remits royalty — customer is not in chain JSON.

### 5.5 `_record_obligation_settlement`

| Property | Value |
|----------|-------|
| Input | obligation_id, order_item_id, amount |
| Updates | `settled_amount`, `status`, `settled_at` |
| Links | `wallet_history.royaltyObligationId` on related rows |

---

## 6. RLS policies (new tables)

### 6.1 `manufacturing_batches`

| Policy | Operation | Rule |
|--------|-----------|------|
| `batches_industrialist_all` | ALL | `industrialist_id = auth.uid()` |
| `batches_farmer_select` | SELECT | `original_farmer_id = auth.uid()` |
| `batches_admin` | ALL | `is_admin()` |

### 6.2 `processed_products`

| Policy | Operation | Rule |
|--------|-----------|------|
| `processed_industrialist_all` | ALL | `industrialist_id = auth.uid()` |
| `processed_farmer_select` | SELECT | `original_farmer_id = auth.uid()` |
| `processed_public_select` | SELECT | `status = listed` AND linked `products.quantity > 0` |
| `processed_admin` | ALL | `is_admin()` |

### 6.3 `royalty_obligations`

| Policy | Operation | Rule |
|--------|-----------|------|
| `obligations_beneficiary_select` | SELECT | `beneficiary_farmer_id = auth.uid()::text` |
| `obligations_obligor_select` | SELECT | `obligor_id = auth.uid()::text` |
| `obligations_admin` | ALL | `is_admin()` |
| Writes | — | **RPC only** (SECURITY DEFINER); no direct INSERT for authenticated |

---

## 7. Wallet ledger entries by scenario

| Scenario | purchase | sale_income | royalty_income | royalty_paid |
|----------|----------|-------------|----------------|--------------|
| Farmer → Customer | buyer −total | seller +total | — | — |
| Farmer → Trader | buyer −total | seller +total | — | — |
| Trader → Industrialist | buyer −total | seller +(total−r) | farmer +r | seller −r |
| Farmer → Industrialist | buyer −total | seller +total | — | — |
| Customer → Processed | buyer −total | ind +(total−r) | farmer +r | ind −r |

---

## 8. Dashboard query specifications

### 8.1 Farmer — pending downstream royalty

```sql
-- Conceptual (not executable deliverable)
SELECT SUM(pending_amount - settled_amount)
FROM royalty_obligations
WHERE beneficiary_farmer_id = :uid
  AND obligation_type = 'deferred'
  AND status IN ('pending', 'partially_settled');
```

### 8.2 Farmer — total royalty income

```sql
-- Immediate + deferred settled
SELECT SUM(amount) FROM wallet_history
WHERE userId = :uid AND type = 'royalty_income';
```

### 8.3 Industrialist — open batches

```sql
SELECT * FROM manufacturing_batches
WHERE industrialist_id = :uid AND status IN ('draft', 'in_progress');
```

### 8.4 Industrialist — open obligations

```sql
SELECT * FROM royalty_obligations
WHERE obligor_id = :uid AND status IN ('pending', 'partially_settled');
```

---

## 9. Android compatibility notes

| Topic | Approach |
|-------|----------|
| Role `customer` | Phase 1 constraints + bridge |
| `users.trader` vs `profiles.middleman` | Phase 1 `_role_for_*` |
| Checkout RPC | Single `checkout_order`; versioned behavior via product_kind |
| Manufacturing | Android calls same RPCs as web |
| Offline / legacy app versions | Older apps without manufacturing UI continue to work; new tables unused until RPC called |

---

## 10. Preservation checklist

| Asset | Preservation mechanism |
|-------|------------------------|
| Existing orders | No UPDATE; new columns nullable/defaulted |
| Existing order_items | Same |
| Existing wallet_history | Append-only; optional nullable FK column |
| Existing products | JSON additive keys only on new listings |
| Customer accounts | Role in CHECK + pass-through mapping |
| `crops` table | Untouched (out of scope) |
| Migration 003 checkout | Remains until Phase 2 replaces `checkout_order` |

---

## 11. Entity relationship summary

```
orders
  └── order_items
        ├── manufacturing_batches (source_order_item_id)  [Phase 3]
        └── royalty_obligations (source_order_item_id)    [Phase 2/3]

manufacturing_batches
  └── processed_products
        └── products (via product_id + description JSON)
              └── sold via checkout_order → settles royalty_obligations

wallet_history
  └── royalty_obligations (optional royaltyObligationId)  [Phase 2/3]
```

---

## 12. Next artifacts (not in this deliverable)

| File | When |
|------|------|
| `PHASE_1_WALLET_CUSTOMER.sql` | After plan approval |
| `PHASE_2_TRADER_ROYALTY.sql` | After Phase 1 verified |
| `PHASE_3_MANUFACTURING_ROYALTY.sql` | After Phase 2 verified |

**`CUSTOMER_ROLE_PATCH.sql` remains on hold. Do not apply.**
