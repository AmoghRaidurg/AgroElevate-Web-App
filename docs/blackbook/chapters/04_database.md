# Chapter 04 — Database Design

## 4.1 Introduction

AgroElevate's database is hosted on **Supabase PostgreSQL 15**. The production schema uses a **hybrid naming convention**: camelCase for legacy marketplace tables (`orders`, `order_items`, `wallet_history`, `users`, `crops`) and snake_case for newer extensions (`profiles`, `products`, `payment_intents`, `manufacturing_batches`). This chapter documents all tables with columns, primary keys, foreign keys, relationships, the RPC function catalog, RLS overview, and trigger inventory.

The authoritative ER diagram is provided in `../diagrams/02_er_diagram.mmd` (Figure 4.1). Migrations are applied in sequence documented in `supabase/migrations/production/README.md` (001 through 018).

**Note:** No database triggers (`CREATE TRIGGER`) are defined in the migration set—business logic is implemented exclusively through RPC functions and CHECK constraints.

---

## 4.2 Entity-Relationship Overview

Core relationship clusters:

1. **Identity:** `auth.users` → `profiles` (1:1 UUID) → `users` (1:1 TEXT uid bridge).
2. **Catalog:** `profiles` → `products` (seller); optional `crops` parallel catalog.
3. **Commerce:** `orders` → `order_items` → optional `crops`/`products` via `cropId`.
4. **Finance:** `users` → `wallet_history`; `payment_intents` → `payment_receipts`.
5. **Royalty:** `manufacturing_batches` → `royalty_obligations` → `processed_products`.
6. **Intelligence:** `profiles`/`users` → `ai_*` recommendation and forecast tables.

---

## 4.3 Table Specifications

### 4.3.1 `profiles`

Auth-linked user profile (snake_case). Created on registration via `ensure_profile_from_auth`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK**, FK → `auth.users(id)` ON DELETE CASCADE | Supabase Auth user ID |
| `email` | TEXT | NOT NULL | User email |
| `name` | TEXT | NOT NULL | Display name |
| `role` | TEXT | NOT NULL, CHECK | `farmer`, `middleman`, `trader`, `industrialist`, `customer`, `admin` |
| `address` | TEXT | nullable | Physical address |
| `phone` | TEXT | nullable | Contact number |
| `bank_account` | TEXT | nullable | Bank account for settlements |
| `suspended` | BOOLEAN | NOT NULL DEFAULT false | Admin suspend flag (migration 006) |
| `approved` | BOOLEAN | NOT NULL DEFAULT true | Admin approval flag (migration 006) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Registration timestamp |

**Indexes:** `idx_profiles_role` on `(role)`.

**RLS:** Users read/update own row; admin SELECT/UPDATE all via `is_admin()`.

---

### 4.3.2 `users`

Legacy/Android-compatible wallet identity store (camelCase).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `uid` | TEXT | **PK** | User ID as text (= `profiles.id::text`) |
| `name` | TEXT | nullable | Display name |
| `role` | TEXT | CHECK | `farmer`, `trader`, `middleman`, `industrialist`, `customer`, `admin` |
| `walletBalance` | NUMERIC | nullable | Cached wallet balance |
| `approved` | BOOLEAN | nullable | Account approval |
| `createdAt` | TIMESTAMPTZ | nullable | Row creation |

**Relationships:** Referenced by `wallet_history.userId`, `orders.buyerId`, `payment_intents.user_id`.

**RLS:** Self read; admin update; insert own on registration (migration 006).

---

### 4.3.3 `products`

Web marketplace catalog (snake_case). Primary listing surface for React app.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** DEFAULT gen_random_uuid() | Product identifier |
| `name` | TEXT | NOT NULL | Listing title |
| `crop_type` | TEXT | NOT NULL | Category (e.g., Grain) |
| `price_per_unit` | NUMERIC(12,2) | NOT NULL, CHECK > 0 | Unit price INR |
| `unit` | TEXT | NOT NULL DEFAULT 'kg' | Measurement unit |
| `quantity` | INTEGER/BIGINT | NOT NULL, CHECK ≥ 0 | Available stock |
| `seller_id` | UUID | NOT NULL, FK → `profiles(id)` CASCADE | Current seller |
| `description` | TEXT | nullable | **Royalty metadata JSON** when relisted |
| `image_url` | TEXT | nullable | Product image URL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Listing time |
| `crop_id` | UUID | nullable | FK bridge to crops (migration 003/010) |
| `district_id` | UUID | nullable | Geo reference (future) |
| `quality_grade` | TEXT | nullable | Quality classification |
| `harvest_date` | DATE | nullable | Harvest date |
| `ai_suggested_price` | NUMERIC(12,2) | nullable | AI pricing hint |

**Indexes:** `idx_products_seller_id`, `idx_products_quantity` (partial WHERE quantity > 0).

**RLS:** Public/authenticated read for marketplace; seller insert/update own listings.

---

### 4.3.4 `crops`

Legacy/native marketplace catalog (camelCase). Coexists with `products`; referenced by `order_items.cropId`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | **PK** |
| `farmerId` | TEXT | Original listing farmer |
| `farmerName` | TEXT | Farmer display name |
| `name` | TEXT | Crop name |
| `quantity` | NUMERIC | Available quantity |
| `unit` | TEXT | Unit of measure |
| `pricePerUnit` | NUMERIC | Price per unit |
| `originalFarmerId` | TEXT | Lineage for royalty |
| `originalPrice` | NUMERIC | Original farm-gate price |
| `status` | TEXT | Listing status |
| `soldQuantity` | NUMERIC | Cumulative sold |
| `rating` | NUMERIC | Optional rating |
| `category` | TEXT | Crop category |
| `location` | TEXT | Geo location |
| `harvestDate` | TEXT | Harvest date string |
| `description` | TEXT | Description |
| `imageBase64` | TEXT | Inline image (legacy) |
| `createdAt` | TIMESTAMPTZ | Created timestamp |

**Relationship:** `order_items.cropId` → `crops.id`; RPC maps `products.id` into `cropId` at checkout.

---

### 4.3.5 `orders`

Marketplace order header (camelCase).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** | Order identifier |
| `buyerId` | TEXT | NOT NULL | Buyer uid (text) |
| `buyerName` | TEXT | nullable | Snapshot name |
| `buyerRole` | TEXT | nullable | Role at purchase time |
| `totalAmount` | NUMERIC(12,2) | NOT NULL | Order total INR |
| `shippingAddress` | TEXT | nullable | Delivery address |
| `status` | TEXT | NOT NULL | e.g., `completed`, `pending` |
| `createdAt` | TIMESTAMPTZ | NOT NULL | Creation time |
| `updatedAt` | TIMESTAMPTZ | nullable | Last update |
| `metadata` | JSONB | DEFAULT '{}' | Extension metadata (migration 010) |
| `ai_recommendation_id` | UUID | nullable | AI linkage |
| `forecast_price_at_purchase` | NUMERIC(12,2) | nullable | Price forecast snapshot |
| `landed_cost_breakdown` | JSONB | nullable | Cost analysis |

**Relationships:** 1:N → `order_items`; referenced by `wallet_history.orderId`, `manufacturing_batches.source_order_id`.

**Indexes:** `idx_orders_buyer_status`, `idx_orders_created_at`, `idx_orders_wallet_tx`.

---

### 4.3.6 `order_items`

Normalized line items (camelCase).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** | Line item ID |
| `orderId` | UUID | NOT NULL, FK → `orders(id)` | Parent order |
| `cropId` | UUID | nullable, FK → `crops(id)` | Product/crop reference |
| `farmerId` | TEXT | nullable | Selling farmer uid |
| `cropName` | TEXT | nullable | Product name snapshot |
| `quantity` | NUMERIC | NOT NULL | Quantity purchased |
| `unit` | TEXT | nullable | Unit |
| `pricePerUnit` | NUMERIC | NOT NULL | Unit price at sale |
| `totalPrice` | NUMERIC | NOT NULL | Line total |
| `originalFarmerId` | TEXT | nullable | Royalty beneficiary |
| `seller_id` | UUID | nullable, FK → `profiles(id)` | Seller profile (migration 010) |
| `original_farmer_id` | UUID | nullable, FK → `profiles(id)` | UUID lineage (migration 010) |
| `royaltyObligationId` | UUID | nullable, FK → `royalty_obligations(id)` | Deferred royalty link (014) |

**RLS:** Buyer reads via order ownership; farmer reads own sales (`farmerId` match — migration 007).

---

### 4.3.7 `wallet_history`

Append-only wallet ledger (camelCase).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** | Ledger entry ID |
| `userId` | TEXT | NOT NULL | Account uid |
| `type` | TEXT | NOT NULL | Transaction type (see §4.3.8) |
| `amount` | NUMERIC | NOT NULL | Signed amount (+ credit, − debit) |
| `orderId` | UUID | nullable, FK → `orders(id)` | Related order |
| `description` | TEXT | nullable | Human-readable note |
| `createdAt` | TIMESTAMPTZ | NOT NULL | Entry timestamp |
| `reference_type` | TEXT | nullable, CHECK | `payment_intent`, `royalty_obligation`, `order`, `transfer`, `demo_credit` |
| `reference_id` | UUID | nullable | Polymorphic reference |
| `royaltyObligationId` | UUID | nullable, FK → `royalty_obligations(id)` | Obligation settlement |

**Indexes:** `idx_wallet_history_reference` on `(reference_type, reference_id)`.

**RLS:** User reads own rows only (`userId = auth.uid()::text`).

---

### 4.3.8 Wallet History Transaction Types

| Type | Direction | Trigger |
|------|-----------|---------|
| `deposit` | Credit | Razorpay `confirm_wallet_deposit` |
| `demo_credit` | Credit | `admin_demo_wallet_credit` |
| `purchase` | Debit | Buyer checkout |
| `sale` | Credit | Seller checkout proceeds (net of royalty) |
| `royalty_income` | Credit | Original farmer royalty |
| `transfer_in` | Credit | `transfer_funds` receiver |
| `transfer_out` | Debit | `transfer_funds` sender |

---

### 4.3.9 `transactions`

Parallel financial log (camelCase, legacy). Columns mirror wallet patterns: `userId`, `type`, `amount`, `orderId`, `description`, `createdAt`. Retained for production compatibility; primary audit path is `wallet_history`.

---

### 4.3.10 `notifications`

User notification store (camelCase): `userId`, message fields, read status. Present in production schema; optional UI consumption.

---

### 4.3.11 Payment Tables (Migration 016)

#### `payment_receipt_counters`

| Column | Type | Constraints |
|--------|------|-------------|
| `year` | INT | **PK** |
| `last_value` | BIGINT | NOT NULL DEFAULT 0 |

Supports `generate_receipt_number()` → format `AGR-YYYY-NNNNNN`.

#### `payment_intents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** | Intent ID |
| `user_id` | TEXT | NOT NULL | Payer uid |
| `amount_inr` | NUMERIC(12,2) | CHECK > 0 | Amount rupees |
| `amount_paise` | INTEGER | CHECK > 0 | Amount paise |
| `currency` | TEXT | DEFAULT 'INR' | Currency code |
| `razorpay_order_id` | TEXT | UNIQUE | Razorpay order |
| `razorpay_payment_id` | TEXT | UNIQUE | Razorpay payment |
| `status` | TEXT | CHECK | `created`, `paid`, `failed`, `expired` |
| `receipt_number` | TEXT | UNIQUE | AGR receipt |
| `wallet_history_id` | UUID | FK → `wallet_history(id)` | Ledger link |
| `idempotency_key` | TEXT | UNIQUE | Duplicate prevention |
| `metadata` | JSONB | DEFAULT '{}' | Platform notes |
| `failure_reason` | TEXT | nullable | Failure detail |
| `created_at` | TIMESTAMPTZ | NOT NULL | Created |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Updated |
| `paid_at` | TIMESTAMPTZ | nullable | UTC paid time |
| `paid_at_ist` | TIMESTAMPTZ | nullable | IST paid time |
| `expires_at` | TIMESTAMPTZ | DEFAULT now()+30min | Expiry |

#### `payment_receipts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | **PK** |
| `intent_id` | UUID | UNIQUE FK → `payment_intents(id)` |
| `user_id` | TEXT | NOT NULL |
| `receipt_number` | TEXT | UNIQUE |
| `amount_inr` | NUMERIC(12,2) | NOT NULL |
| `razorpay_order_id` | TEXT | NOT NULL |
| `razorpay_payment_id` | TEXT | UNIQUE |
| `razorpay_signature` | TEXT | nullable |
| `payment_method` | TEXT | nullable |
| `paid_at` | TIMESTAMPTZ | NOT NULL |
| `paid_at_ist` | TIMESTAMPTZ | NOT NULL |
| `wallet_history_id` | UUID | NOT NULL FK → `wallet_history(id)` |
| `issued_at` | TIMESTAMPTZ | DEFAULT now() |

#### `razorpay_webhook_events`

Audit log for webhook processing: `event_id` UNIQUE, `event_type`, Razorpay IDs, `payload` JSONB, `status` (`processed`, `ignored`, `failed`, `duplicate`).

#### `wallet_transfers`

P2P transfer audit: `sender_id`, `receiver_id`, `amount_inr`, `status`, `created_at`.

---

### 4.3.12 Manufacturing and Royalty Tables (Migration 014)

#### `manufacturing_batches`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | **PK** | Batch ID |
| `industrialist_id` | UUID | FK → `profiles(id)` | Processor |
| `original_farmer_id` | UUID | FK → `profiles(id)` | Royalty beneficiary |
| `source_order_id` | UUID | FK → `orders(id)` | Procurement order |
| `source_order_item_id` | UUID | NOT NULL, UNIQUE | Source line item |
| `source_product_id` | UUID | FK → `products(id)` | Source product |
| `input_crop_name` | TEXT | NOT NULL | Input commodity |
| `input_qty` | NUMERIC | CHECK > 0 | Input quantity |
| `input_unit` | TEXT | DEFAULT 'kg' | Unit |
| `output_qty` | NUMERIC | nullable | Processed output |
| `output_unit` | TEXT | nullable | Output unit |
| `waste_qty` | NUMERIC | DEFAULT 0 | Waste |
| `status` | TEXT | CHECK | `draft`, `in_progress`, `completed`, `cancelled` |
| `royalty_percent` | NUMERIC | CHECK 10–12.5 | Royalty rate |
| `notes` | TEXT | nullable | Batch notes |
| `created_at` | TIMESTAMPTZ | NOT NULL | Created |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Updated |
| `completed_at` | TIMESTAMPTZ | nullable | Completion time |

#### `royalty_obligations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | **PK** |
| `obligation_type` | TEXT | `immediate` or `deferred` |
| `status` | TEXT | `pending`, `partially_settled`, `settled`, `cancelled` |
| `beneficiary_farmer_id` | TEXT | Farmer uid |
| `obligor_id` | TEXT | Payer uid |
| `royalty_percent` | NUMERIC | 10–12.5 |
| `basis_type` | TEXT | DEFAULT `sale_price` |
| `source_order_item_id` | UUID | nullable |
| `manufacturing_batch_id` | UUID | FK → `manufacturing_batches(id)` |
| `pending_amount` | NUMERIC | Unsettled amount |
| `settled_amount` | NUMERIC | Paid royalty |
| `created_at` | TIMESTAMPTZ | Created |
| `settled_at` | TIMESTAMPTZ | nullable |
| `cancelled_at` | TIMESTAMPTZ | nullable |

#### `processed_products`

Links manufacturing output to marketplace listings: `manufacturing_batch_id`, `royalty_obligation_id`, `industrialist_id`, `original_farmer_id`, `name`, `sku`, `qty_produced`, `qty_listed`, `qty_sold`, `royalty_percent`, `product_id` (FK → `products`), `status` (`created`, `listed`, `depleted`, `archived`).

---

### 4.3.13 Demo Wallet Credits (Migration 017–018)

#### `demo_wallet_credits`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | **PK** |
| `target_user_id` | TEXT | Credited user |
| `admin_user_id` | TEXT | Admin performing credit |
| `amount_inr` | NUMERIC | CHECK > 0 |
| `wallet_history_id` | UUID | FK → `wallet_history(id)` |
| `note` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | Audit timestamp |

Migration 018 extends `admin_demo_wallet_credit` to accept custom amounts ₹1–₹100,000 (admin only).

---

### 4.3.14 AI Tables (Migration 005)

#### `ai_crop_recommendations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | **PK** |
| `user_id` | TEXT | NOT NULL |
| `role` | TEXT | CHECK role enum |
| `location` | TEXT | nullable |
| `season` | TEXT | nullable |
| `month` | INTEGER | CHECK 1–12 |
| `crop_name` | TEXT | NOT NULL |
| `rank` | INTEGER | CHECK 1–20 |
| `confidence_score` | NUMERIC(5,4) | 0–1 |
| `expected_profitability` | NUMERIC(12,2) | nullable |
| `risk_score` | NUMERIC(5,4) | 0–1 |
| `model_version` | TEXT | DEFAULT 'v1' |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `ai_income_forecasts`

Horizon projections: `horizon_years` (1,3,5,10), `forecast_year`, `projected_revenue`, `baseline_revenue`, `growth_rate`, `confidence_score`, `model_version`.

#### `ai_market_predictions`

Crop/regional forecasts: `crop_name`, `region`, `demand_score` (0–100), `trend` (`rising`/`stable`/`falling`), `price_min`, `price_max`, `demand_confidence`, `prediction_month`.

#### `ai_user_insights`

Actionable feed: `insight_type`, `title`, `message`, `priority` (`high`/`medium`/`low`), `crop_name`, `confidence_score`, `is_read`, `expires_at`.

**RLS:** User-scoped SELECT on recommendations, forecasts, insights; authenticated read-all on market predictions; AI service writes via service role.

---

## 4.4 RPC Function Catalog

### 4.4.1 Public Authenticated RPCs

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `ensure_profile_from_auth()` | — | VOID | Sync profile + users from auth metadata |
| `get_wallet_balance()` | — | NUMERIC | Reconciled wallet balance |
| `add_funds(p_amount)` | NUMERIC | — | **DISABLED** for clients (raises exception) |
| `transfer_funds(p_receiver_id, p_amount)` | TEXT, NUMERIC | JSONB | P2P transfer |
| `checkout_order(cart)` | JSONB `[{id, qty}]` | JSONB | Atomic marketplace checkout |
| `complete_manufacturing_batch(...)` | batch params | JSONB | Industrialist manufacturing |
| `list_processed_product(...)` | product params | JSONB | List processed goods |
| `get_my_manufacturing_batches()` | — | SETOF | Industrialist batches |
| `get_my_royalty_obligations()` | — | SETOF | Royalty obligations |
| `get_my_processed_products()` | — | SETOF | Processed catalog |

### 4.4.2 Admin RPCs

| Function | Description |
|----------|-------------|
| `admin_demo_wallet_credit(target, amount)` | Demo wallet credit with audit |
| `get_payment_audit_summary()` | Payment reconciliation summary |

### 4.4.3 Service Role / Internal RPCs

| Function | Description |
|----------|-------------|
| `generate_receipt_number()` | AGR-YYYY-NNNNNN receipt |
| `confirm_wallet_deposit(...)` | Webhook deposit confirmation |
| `mark_payment_intent_failed(...)` | Failed payment handling |
| `prepare_test_payment_intent(...)` | CI/commerce harness simulation |
| `is_admin()` | Admin role check for RLS |
| `_wallet_ledger_entry(...)` | Core ledger insert + balance update |
| `_wallet_transfer(...)` | Dual-entry transfer with audit |
| `_commerce_settle_sale(...)` | Royalty computation + splits |
| `_parse_product_commerce_meta(...)` | JSON description parser |
| `_build_ownership_chain(...)` | Lineage resolver |
| `_create_deferred_royalty_from_procurement(...)` | Manufacturing obligation |
| `_record_obligation_settlement(...)` | Obligation payment |
| `_ensure_users_row(...)`, `_resolve_user_identity(...)` | Identity bridge |
| `_reconcile_wallet_balance(p_uid)` | Balance reconciliation |

### 4.4.4 Helper SQL Functions

| Function | Purpose |
|----------|---------|
| `_is_valid_profile_role`, `_is_valid_users_role` | Role validation |
| `_role_for_profiles_table`, `_role_for_users_table` | Role name mapping |
| `_buyer_participates_in_royalty_chain` | Royalty eligibility |
| `_is_trader_role` | Trader detection |
| `user_is_order_buyer`, `user_is_order_seller` | RLS helpers |

---

## 4.5 Triggers

**No triggers are defined** in the AgroElevate migration repository. Side effects (balance updates, royalty splits, receipt generation) are executed imperatively within RPC function bodies. This design choice improves debuggability for academic review—全部 commerce logic is searchable in function definitions rather than distributed across trigger handlers.

---

## 4.6 Indexing Strategy

Indexes support:

- Role-based admin queries (`idx_profiles_role`).
- Marketplace availability (`idx_products_quantity WHERE quantity > 0`).
- Order history sorting (`idx_orders_created_at DESC`).
- Payment user timelines (`idx_payment_intents_user_created`).
- Royalty obligation dashboards (`idx_royalty_oblig_beneficiary`).
- AI user feeds (`idx_ai_insights_user`, `idx_ai_crop_rec_user`).

---

## 4.7 Data Integrity Constraints

- **CHECK constraints** on roles, payment statuses, royalty percentages (10–12.5%), positive amounts.
- **UNIQUE constraints** on Razorpay IDs, receipt numbers, webhook event IDs, manufacturing source items.
- **FK cascades** on profile-linked products; SET NULL on optional order_item seller references.
- **Idempotency** on payment intents prevents duplicate wallet credits from webhook retries.

---

## 4.8 Summary

The AgroElevate database integrates legacy camelCase marketplace tables with modern snake_case extensions without destructive migrations. The schema supports multi-role commerce, auditable wallets, Razorpay payments, Option B royalty, manufacturing deferrals, and AI persistence—all guarded by RLS and SECURITY DEFINER RPCs. Chapter 04 provides examiners a complete relational reference aligned with the ER diagram in `../diagrams/02_er_diagram.mmd` and the 18-migration production sequence verified by `commerce:verify` 26/26.

---

*Schema authority: `SCHEMA_COMPATIBILITY_REPORT.md`, `supabase/migrations/production/README.md`*
