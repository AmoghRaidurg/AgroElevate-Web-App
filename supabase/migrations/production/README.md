# Production Phase A Migrations

**Status:** Generated — **NOT APPLIED** — awaiting approval

These migrations target the **actual production schema** (camelCase `orders`, `order_items`, `wallet_history`, `users`).

## Do NOT run

- `supabase/migrations/20250624000001_baseline_schema.sql`
- `supabase/migrations/20250624000001_patch_orders_status.sql`
- `supabase/migrations/20250624000010_upgrade_*` through `00013`

## Apply order (after approval)

1. `20250625100001_prod_rls.sql`
2. `20250625100002_prod_wallet_rpc.sql`
3. `20250625100003_prod_checkout_rpc.sql`
4. `20250625100004_prod_status_constraint.sql`
5. `20250625100005_prod_ai_tables.sql` — Phase B AI tables
6. `20250625100006_prod_auth_profiles.sql` — Phase D auth (suspend/approve, admin RLS, ensure_profile RPC)
7. `20250625100007_prod_commerce_rls_fix.sql` — Phase F0 seller/farmer order_items + orders RLS
8. `20250625100008_prod_wallet_balance_sync.sql` — Phase F0 wallet balance reconciliation

## Option B (approved) — apply instead of 009–011

9. `20250625100012_phase1_wallet_customer.sql` — wallet provisioning + customer/Android roles
10. `20250625100013_phase2_trader_royalty.sql` — role-matrix royalty engine (rules 1–3)
11. `20250625100014_phase3_manufacturing_royalty.sql` — manufacturing + deferred downstream royalty (rules 4–5)
12. `20250625100015_prod_commerce_e2e_fix_v2.sql` — read-only wallet balance, cropId FK bridge, RLS recursion fix (**use v2**, not v1)

**Do NOT apply:** `009`, `010`, `011`, `CUSTOMER_ROLE_PATCH.sql` (superseded by 012–014)

## Prerequisites (verify in SQL Editor first)

```sql
-- users.uid must be PRIMARY KEY or UNIQUE (required for _ensure_users_row)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'users';

-- Identity bridge: profiles.id::text should match users.uid
SELECT p.id::text, u.uid FROM profiles p LEFT JOIN users u ON u.uid = p.id::text LIMIT 5;
```

## Post-migration frontend work (separate PR after approval)

- `src/lib/wallet.ts` → read `wallet_history`, not `orders`
- `src/pages/Marketplace.tsx` → camelCase `order_items` / `orders` columns

See `SCHEMA_COMPATIBILITY_REPORT.md` for full analysis.
