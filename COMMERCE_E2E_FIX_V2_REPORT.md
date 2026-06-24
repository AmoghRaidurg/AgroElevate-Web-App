# Commerce E2E Fix V2 Report

**Date:** 2025-06-24  
**Migration:** `supabase/migrations/production/20250625100015_prod_commerce_e2e_fix_v2.sql`  
**Supersedes:** `20250625100015_prod_commerce_e2e_fix.sql` (v1 — syntax error)

---

## Failure on v1

```
ERROR: 42601
syntax error at or near "ROWTYPE"
```

**Location:** `_resolve_crop_id_for_product` function signature.

```sql
-- INVALID in PostgreSQL function parameters:
CREATE OR REPLACE FUNCTION public._resolve_crop_id_for_product(
  p_product public.products%ROWTYPE
)
```

PostgreSQL allows `%ROWTYPE` only in **DECLARE** blocks (local variables), not in **function parameter lists**. Composite types must be passed explicitly or referenced by a scalar key (e.g. `UUID`).

---

## SQL corrections (v1 → v2)

### 1. `_resolve_crop_id_for_product` — parameter type

| v1 (invalid) | v2 (valid) |
|--------------|------------|
| `p_product public.products%ROWTYPE` | `p_product_id UUID` |

**v2 implementation:**

- Declares `v_product public.products%ROWTYPE` inside the function body (valid).
- Loads the row: `SELECT * INTO v_product FROM public.products WHERE id = p_product_id`.
- Raises if `p_product_id IS NULL` or product not found.
- All references changed from `p_product.*` to `v_product.*`.

### 2. `REVOKE` signature for `_resolve_crop_id_for_product`

| v1 (invalid / mismatched) | v2 (valid) |
|---------------------------|------------|
| `REVOKE ... ON FUNCTION public._resolve_crop_id_for_product(public.products)` | `REVOKE ... ON FUNCTION public._resolve_crop_id_for_product(UUID)` |

`public.products` is a table name, not a function argument type. The revoke must match the function signature `(UUID)`.

### 3. `checkout_order` — call site

| v1 | v2 |
|----|-----|
| `v_crop_id := public._resolve_crop_id_for_product(v_product);` | `v_crop_id := public._resolve_crop_id_for_product(v_product.id);` |

No other logic change; `checkout_order` still uses `v_product public.products%ROWTYPE` in its own DECLARE block, which is valid PostgreSQL.

---

## Full migration audit (v2)

Audited all statements in `20250625100015_prod_commerce_e2e_fix_v2.sql` for PostgreSQL / Supabase compatibility.

| Construct | Location | Verdict |
|-----------|----------|---------|
| `%ROWTYPE` in function **parameter** | v1 only | **Removed** in v2 |
| `%ROWTYPE` in DECLARE (`v_product`) | `_resolve_crop_id_for_product`, `checkout_order` | Valid — kept |
| `LANGUAGE sql` + `STABLE` + `SECURITY DEFINER` | `user_is_order_buyer`, `user_is_order_seller` | Valid |
| `LANGUAGE plpgsql` + `STABLE` | `get_wallet_balance` | Valid (read-only body) |
| `DROP POLICY IF EXISTS` / `CREATE POLICY` | orders, order_items | Valid |
| `jsonb_build_object`, `?` operator, `->>` | crop bridge meta | Valid PostgreSQL JSONB |
| `btrim`, `COALESCE`, `GREATEST` | helpers | Valid |
| `EXCEPTION WHEN OTHERS` | description JSON parse | Valid PL/pgSQL |
| `FOR v_item IN SELECT value FROM jsonb_array_elements(cart)` | checkout_order | Valid |
| `SELECT * INTO v_settlement FROM ...` (RECORD) | checkout_order | Valid |
| `CURRENT_DATE::text` for `harvestDate` | crops INSERT | Valid (production `harvestDate` is text) |
| `status = 'available'` | crops INSERT | Valid (production values: `available`, `sold`) |
| Oracle `%TYPE` / `%ROWTYPE` params | — | None |
| PL/SQL-only (`FORALL`, `BULK COLLECT`, `/`, packages) | — | None |

**No additional syntax changes required** beyond the three corrections above.

---

## Compatibility

| Requirement | How v2 satisfies it |
|-------------|---------------------|
| Supabase PostgreSQL | Standard PL/pgSQL and SQL functions only |
| `products` table | Loads row by `id UUID`; uses `seller_id`, `name`, `quantity`, `unit`, `price_per_unit`, `crop_type`, `description` |
| `order_items."cropId"` FK → `crops.id` | `_resolve_crop_id_for_product` returns UUID from `crops`; checkout inserts `v_crop_id` |
| Existing data | Additive; bridge `crops` rows created only when no match exists |
| Business rules / royalty % | Unchanged from v1 intent |

---

## Apply

**Do not run v1.** In Supabase SQL Editor, run:

`supabase/migrations/production/20250625100015_prod_commerce_e2e_fix_v2.sql`

Or:

```bash
npm run commerce:apply-migration   # uses v2 path
npm run commerce:verify
```

---

## Files updated

| File | Change |
|------|--------|
| `20250625100015_prod_commerce_e2e_fix_v2.sql` | **New** — corrected migration |
| `20250625100015_prod_commerce_e2e_fix.sql` | Marked superseded (do not apply) |
| `scripts/commerce-apply-migration.mjs` | Points to v2 file |
| `supabase/migrations/production/README.md` | Apply order references v2 |

---

## Expected outcome after apply

`npm run commerce:verify` → **17/17 checks passed** (same targets as original E2E fix plan).
