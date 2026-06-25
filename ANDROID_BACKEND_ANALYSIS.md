# AgroElevate — Android Backend Analysis

**Date:** 2026-06-25  
**Purpose:** Architecture reference for Android client integration  
**Rule:** Web platform is the **primary source of truth**. Android is a **thin client** only.  
**Status:** Analysis only — **no code or backend changes made**

---

## Executive Summary

AgroElevate is a multi-role agricultural commerce platform with:

| Layer | Technology | Production URL (reference) |
|-------|------------|--------------------------|
| **Web frontend** | React + Vite + TypeScript | https://agro-fair-chain.vercel.app |
| **Database + Auth** | Supabase (PostgreSQL + RLS) | Project URL from `VITE_SUPABASE_URL` |
| **Payments** | Razorpay via Supabase Edge Functions | Server-side only |
| **AI** | FastAPI (`ai-service/`) on Render | `VITE_AI_API_URL` (e.g. `https://agroelevate-ai.onrender.com`) |

**Android project status:** **No Android source code exists in this repository.** Integration is documented in `docs/api/ANDROID_RAZORPAY_INTEGRATION.md` and `docs/blackbook/chapters/06_android.md` as a **planned thin client** using Supabase Kotlin SDK + Razorpay Android SDK.

**Commerce verification:** `npm run commerce:verify` — **26/26 checks** against production Supabase (farmer, trader, industrialist, customer paths, royalty 12.5%, Razorpay simulate).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CLIENTS (Web + Android)                          │
│   React SPA (Vercel)          │    Android (planned — Kotlin)        │
└───────────────┬───────────────┴──────────────────┬──────────────────┘
                │ JWT (Supabase Auth)                 │
                ▼                                     ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        SUPABASE CLOUD                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Auth        │  │ PostgreSQL   │  │ Edge Functions              │  │
│  │ (email/pw)  │  │ + RLS        │  │ razorpay-create-order       │  │
│  │             │  │ + RPCs       │  │ razorpay-webhook            │  │
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ Razorpay API (server-side)
                                ▼
                         Razorpay Cloud
                                │
┌───────────────────────────────┴───────────────────────────────────────┐
│  AI Service (FastAPI) — separate host, read-only from Android/Web      │
│  GET /health · /api/intelligence/*                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Design principle:** All money movement, royalty calculation, inventory decrement, and order creation happen in **PostgreSQL RPCs** (`SECURITY DEFINER`). Clients never compute balances or royalties.

---

## 2. Android Project Status

| Item | Status |
|------|--------|
| Kotlin/Java source in repo | **None** |
| Gradle project | **None** |
| Planned location | Separate repo or `agroelevate-android/` (documented only) |
| Integration guide | `docs/api/ANDROID_RAZORPAY_INTEGRATION.md` |
| Black Book chapter | `docs/blackbook/chapters/06_android.md` |

Android must mirror web client patterns — not invent parallel APIs.

---

## 3. Supabase Configuration

### 3.1 Connection (reuse existing — do not regenerate)

| Setting | Web env var | Android equivalent |
|---------|-------------|-------------------|
| Project URL | `VITE_SUPABASE_URL` | Same Supabase URL |
| Public anon key | `VITE_SUPABASE_ANON_KEY` | Same anon key (safe in mobile app) |
| Service role key | Local scripts / AI only | **NEVER embed in Android** |

Client: `@supabase/supabase-js` (web) → **Supabase Kotlin SDK** (Android): Auth, Postgrest, Functions.

### 3.2 Features used by web (Android should match)

| Feature | Used? | Notes |
|---------|-------|-------|
| **Auth** | Yes | Email/password, session JWT |
| **Postgrest** | Yes | Tables + RPCs |
| **Edge Functions** | Yes | `razorpay-create-order` |
| **Realtime** | No | Not used in web `src/` |
| **Storage** | No | Not used in web `src/` |

### 3.3 Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `razorpay-create-order` | POST | User JWT | Create Razorpay order + `payment_intents` row |
| `razorpay-webhook` | POST | Razorpay HMAC | Credit wallet via `confirm_wallet_deposit` RPC |

**Android wallet top-up flow** (from `ANDROID_RAZORPAY_INTEGRATION.md`):

1. `functions.invoke("razorpay-create-order", { amount_inr, platform: "android" })`
2. Razorpay Android SDK with server `order_id` only
3. Poll `payment_intents` until `status == "paid"`
4. Display receipt from `payment_receipts`
5. **Never** call `add_funds` (retired on clients)

---

## 4. Database Schema

### 4.1 Schema conventions (critical for Android models)

Production uses **mixed column casing**:

| Table | Casing | Example columns |
|-------|--------|-----------------|
| `profiles` | snake_case | `id`, `email`, `role`, `bank_account` |
| `products` | snake_case | `seller_id`, `price_per_unit`, `crop_type` |
| `orders` | **camelCase** | `"buyerId"`, `"totalAmount"`, `"createdAt"` |
| `order_items` | **camelCase** | `"orderId"`, `"cropId"`, `"originalFarmerId"`, `"royaltyAmount"` |
| `wallet_history` | **camelCase** | `"userId"`, `"orderId"`, `"createdAt"` |
| `users` | **camelCase** | `uid`, `walletBalance` |
| `payment_intents` | snake_case | `user_id`, `razorpay_order_id`, `status` |

Android Postgrest models must use **exact column names** as in production.

### 4.2 Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, role, approval/suspension |
| `users` | Wallet balance row (`walletBalance`) — provisioned via RPC |
| `products` | Marketplace listings; `description` holds JSON commerce metadata |
| `orders` | Order headers |
| `order_items` | Line items with royalty columns |
| `wallet_history` | Immutable ledger (source of truth for display) |
| `transactions` | Purchase audit rows |
| `crops` | Crop reference (legacy/bridge) |
| `notifications` | User notifications |

### 4.3 Payment tables (Phase G)

| Table | Purpose |
|-------|---------|
| `payment_intents` | Razorpay order tracking (`created` → `paid`) |
| `payment_receipts` | Settled receipts with IST timestamp |
| `razorpay_webhook_events` | Webhook idempotency audit |
| `payment_receipt_counters` | Receipt number generation |
| `wallet_transfers` | Transfer audit |
| `demo_wallet_credits` | Admin demo credit audit |

### 4.4 Manufacturing / deferred royalty (Phase 3)

| Table | Purpose |
|-------|---------|
| `manufacturing_batches` | Industrialist batch processing |
| `royalty_obligations` | Deferred royalty tracking |
| `processed_products` | Processed goods for relist |

### 4.5 AI persistence tables (server-written)

| Table | Purpose |
|-------|---------|
| `ai_crop_recommendations` | Cached recommendations |
| `ai_market_predictions` | Market forecasts |
| `ai_income_forecasts` | Income scenarios |
| `ai_user_insights` | Generated insights |

Android reads AI via **FastAPI HTTP**, not direct table access (unless mirroring web — web uses HTTP only).

### 4.6 Migrations (source of truth)

All production logic lives in:

```
supabase/migrations/production/
  20250625100001_prod_rls.sql
  20250625100002_prod_wallet_rpc.sql
  ...
  20250625100018_demo_wallet_credit_custom_amount.sql
```

**Android must not add migrations.** Apply order documented in `supabase/migrations/production/README.md`.

---

## 5. Authentication

### 5.1 Roles (exact set — no new roles)

| Role | `profiles.role` | Intelligence UI | Notes |
|------|-----------------|-----------------|-------|
| Farmer | `farmer` | `FarmerInsights` | Lists produce, receives royalty |
| Trader | `middleman` | `TraderInsights` | Web Register uses `middleman`; DB also accepts `trader` in `users` |
| Industrialist | `industrialist` | `IndustrialistInsights` | Bulk buyer, manufacturing |
| Customer | `customer` | Redirect to `/dashboard` | Marketplace checkout only |
| Admin | `admin` | `/admin`, `/admin/payments` | User + payment oversight |

### 5.2 Registration flow (web — Android must match)

```typescript
// src/lib/auth.ts
supabase.auth.signUp({
  email, password,
  options: {
    data: { name, role, address, phone, bank_account }
  }
});
// Then: ensure_profile_from_auth() RPC
// Provisions profiles + users wallet row
```

### 5.3 Session gates (web)

| Gate | Check |
|------|-------|
| `ProtectedRoute` | Valid session |
| `RoleRoute` | `profile.role === allowedRole` |
| Suspended | `profiles.suspended` → `/suspended` |
| Pending approval | `profiles.approved` → `/pending-approval` |
| Email verified | `email_confirmed_at` |

### 5.4 Auth RPCs

| RPC | Caller | Purpose |
|-----|--------|---------|
| `ensure_profile_from_auth()` | authenticated | Bridge `auth.users` → `profiles` + `users` |

---

## 6. Row Level Security (RLS)

Key policies (from `20250625100001_prod_rls.sql` + later fixes):

| Table | SELECT | INSERT/UPDATE |
|-------|--------|---------------|
| `profiles` | Own row or admin | Own row |
| `products` | Public read | Seller only |
| `orders` | Buyer or admin | **RPC only** |
| `order_items` | Via order ownership | **RPC only** |
| `wallet_history` | Own `userId` or admin | **RPC only** |
| `users` | Own `uid` or admin | **RPC only** |

`is_admin()` — `profiles.role = 'admin'`.

Android relies on same JWT + RLS — no bypass.

---

## 7. Wallet

### 7.1 Rules

- Balance source: `get_wallet_balance()` RPC (reconciled from ledger)
- History: `wallet_history` table (never compute locally)
- Transfers: `transfer_funds(p_receiver_id, p_amount)` RPC
- Top-up: Razorpay Edge Function path only
- **`add_funds` is retired** — web throws error if called

### 7.2 Web implementation reference

| File | Operations |
|------|------------|
| `src/lib/wallet.ts` | `get_wallet_balance`, `wallet_history` select, `transfer_funds` |
| `src/lib/razorpayWallet.ts` | Edge Function invoke, poll `payment_intents`, `payment_receipts` |

### 7.3 Wallet history types (display only)

From `src/lib/commerceMeta.ts`:

`deposit`, `demo_credit`, `withdrawal`, `purchase`, `sale_income`, `royalty_income`, `royalty_paid`, `transfer_in`, `transfer_out`, `refund`

Android displays types returned by server — **does not assign types**.

### 7.4 Public RPCs

| RPC | Parameters | Returns |
|-----|------------|---------|
| `get_wallet_balance()` | none | `NUMERIC` balance |
| `transfer_funds` | `p_receiver_id TEXT`, `p_amount NUMERIC` | void |

---

## 8. Royalty (server-only — most critical)

### 8.1 Business rules (Option B — verified 12.5%)

| Sale path | Royalty? |
|-----------|----------|
| Farmer → Trader | No (direct sale) |
| Trader → Industrialist | **Yes** (12.5% default) |
| Farmer → Industrialist | No at purchase |
| Farmer → Customer | No |
| Trader relist → downstream | Yes when `original_farmer_id ≠ seller_id` |

### 8.2 Where royalty is calculated

**Only inside PostgreSQL:**

- `checkout_order(cart JSONB)` — atomic checkout
- `_commerce_settle_sale` — internal settlement
- `_wallet_transfer` / `_wallet_ledger_entry` — ledger writes
- Phase 3: `_create_deferred_royalty_from_procurement`, `royalty_obligations`

Rate: **12.5%** default, clamped **10%–12.5%** from `products.description` JSON (`royalty_percent`).

### 8.3 Product metadata (Android writes JSON, server interprets)

Stored in `products.description` as JSON string:

```json
{
  "product_kind": "raw_farmer | trader_relist | processed",
  "original_farmer_id": "<uuid>",
  "current_owner_id": "<uuid>",
  "ownership_chain": [...],
  "royalty_percent": 12.5,
  "source_order_item_id": "...",
  "source_order_item_qty": 50,
  "purchase_price_per_unit": 45
}
```

Web builders: `buildFarmerListingMeta()`, `buildRelistMeta()` in `src/lib/commerceMeta.ts`.

**Android must use identical JSON structure** when listing — not duplicate royalty math.

### 8.4 Android royalty display

Read-only sources:

- `wallet_history` where `type = 'royalty_income'` or `'royalty_paid'`
- `order_items."royaltyAmount"`, `"royaltyPercent"`, `"originalFarmerId"`
- `get_my_royalty_obligations()` RPC (industrialist)

---

## 9. Marketplace & Orders

### 9.1 Product operations

| Operation | API | File |
|-----------|-----|------|
| List all | `from('products').select('*')` | `Marketplace.tsx` |
| Insert listing | `from('products').insert({...})` | `Marketplace.tsx`, `marketplaceData.ts` |
| Detail | `from('products').select().eq('id', id).single()` | `ProductDetail.tsx` |
| Farmer sales stats | `order_items` + joins | `marketplaceData.ts` |
| Trader inventory | `order_items` queries | `marketplaceData.ts` |

### 9.2 Checkout (atomic)

```typescript
// src/lib/checkout.ts
supabase.rpc('checkout_order', { cart: [{ id: productUuid, qty: number }] })
```

Returns: `{ order_id, total_amount, item_count }`

**Cart format:** JSON array of `{ id, qty }` — product UUID + quantity.

### 9.3 Order lifecycle

| Status | Set by |
|--------|--------|
| `completed` | `checkout_order` RPC on success |

Orders inserted only via RPC — clients do not `INSERT INTO orders` directly.

### 9.4 Manufacturing RPCs (industrialist)

| RPC | Purpose |
|-----|---------|
| `get_my_manufacturing_batches()` | List batches |
| `get_my_royalty_obligations()` | Obligation list |
| `get_my_processed_products()` | Processed inventory |
| `complete_manufacturing_batch(...)` | Complete batch |
| `list_processed_product(...)` | List processed product to marketplace |

Web: `src/lib/manufacturingData.ts`

---

## 10. Payments (Razorpay)

### 10.1 Architecture

```
Android/Web → razorpay-create-order (JWT)
           → Razorpay SDK checkout
           → Razorpay webhook → confirm_wallet_deposit (service_role)
           → wallet_history + payment_receipts
```

### 10.2 Edge Function request/response

**Request:**
```json
{ "amount_inr": 1000, "platform": "android" }
```

**Response:**
```json
{
  "key_id": "rzp_test_...",
  "order_id": "order_...",
  "amount_paise": 100000,
  "currency": "INR",
  "intent_id": "<uuid>",
  "receipt_number": "AGR-2026-..."
}
```

### 10.3 Polling pattern (web)

```typescript
// payment_intents where id = intent_id AND user_id = uid
// until status === 'paid' (max ~60s)
```

### 10.4 Admin payment audit

| API | Purpose |
|-----|---------|
| `get_payment_audit_summary()` RPC | Admin dashboard aggregates |
| `payment_receipts` select | Receipt list |
| `payment_intents` select | Intent status |
| `razorpay_webhook_events` select | Webhook audit |

Web: `src/lib/paymentAudit.ts`, `src/pages/admin/AdminPayments.tsx`

---

## 11. AI Service

### 11.1 Base URL

Web: `import.meta.env.VITE_AI_API_URL` (`src/lib/aiApi.ts`)

Android: same URL as build-time/config constant (not Supabase).

### 11.2 Endpoints (FastAPI — do not duplicate)

| Method | Path | Query params | Body |
|--------|------|--------------|------|
| GET | `/health` | — | — |
| GET | `/api/intelligence/farmer/dashboard` | `user_id`, `location?` | — |
| GET | `/api/intelligence/trader/dashboard` | `user_id` | — |
| GET | `/api/intelligence/industrialist/dashboard` | `user_id` | — |
| POST | `/api/intelligence/refresh` | `user_id`, `role`, `location?`, `month?` | — |
| POST | `/api/intelligence/copilot` | `user_id`, `role`, `location?` | `{ message, context? }` |

### 11.3 Response shapes

TypeScript interfaces in `src/lib/aiApi.ts`:

- `FarmerDashboard` — `recommendations`, `market_predictions`, `income_forecasts`, `demand_intelligence`, `insights`, `weather`, insufficient-data flags
- `TraderDashboard` — extends farmer + `trader` block
- `IndustrialistDashboard` — extends farmer + `industrialist` block
- `CopilotResponse` — `reply`, `intent`, `suggestions`

### 11.4 Client behavior (mirror on Android)

- 15s timeout
- Graceful offline fallback (`_fallback: true`, empty arrays)
- `AiStatusBanner` when `/health` fails
- **Customer role:** web redirects away from `/intelligence` — Android should match

### 11.5 AI service env (server only — not Android)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`

---

## 12. Admin

| Feature | API |
|---------|-----|
| List users | `profiles.select(...)` |
| Suspend/approve | `profiles.update`, `users.update` |
| Demo wallet credit | `admin_demo_wallet_credit(target_user_id, amount)` RPC |
| Payment audit | `get_payment_audit_summary()`, payment tables |
| Product overview | `products.select(...)` |

Web: `src/pages/Admin.tsx`, `src/lib/demoWalletCredit.ts`

---

## 13. Complete RPC Inventory (Android-relevant)

### Callable by authenticated mobile client

| RPC | Purpose |
|-----|---------|
| `ensure_profile_from_auth()` | Post-signup provisioning |
| `get_wallet_balance()` | Current balance |
| `transfer_funds(p_receiver_id, p_amount)` | P2P transfer |
| `checkout_order(cart)` | Marketplace checkout |
| `get_my_manufacturing_batches()` | Industrialist |
| `get_my_royalty_obligations()` | Industrialist |
| `get_my_processed_products()` | Industrialist |
| `complete_manufacturing_batch(...)` | Industrialist |
| `list_processed_product(...)` | Industrialist |
| `get_payment_audit_summary()` | Admin only |
| `admin_demo_wallet_credit(...)` | Admin only |

### Must NOT be called from Android

| RPC | Reason |
|-----|--------|
| `add_funds` | Retired — use Razorpay |
| `confirm_wallet_deposit` | service_role — webhook only |
| `generate_receipt_number` | service_role |
| `prepare_test_payment_intent` | CI/service_role |
| `_wallet_transfer`, `_commerce_settle_sale` | Internal |

---

## 14. Web Route → Android Screen Mapping

| Web route | Auth | Role | Backend |
|-----------|------|------|---------|
| `/` | No | — | Marketing |
| `/login`, `/register` | No | — | Supabase Auth |
| `/dashboard` | Yes | All | orders, order_items, wallet |
| `/marketplace` | Partial | All | products |
| `/marketplace/:id` | Partial | All | products |
| `/wallet` | Yes | All | wallet RPCs + Razorpay |
| `/orders` | Yes | All | orders, order_items |
| `/intelligence` | Yes | farmer/trader/industrialist | AI HTTP |
| `/profile` | Yes | All | profiles |
| `/admin` | Yes | admin | profiles |
| `/admin/payments` | Yes | admin | payment audit |

---

## 15. Environment Variables

### Android app (safe to embed)

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | Same as web `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as web `VITE_SUPABASE_ANON_KEY` |
| `AI_API_URL` | Same as web `VITE_AI_API_URL` |

### Never in Android APK logic

| Variable | Location |
|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | AI server, Edge Functions, CI |
| `RAZORPAY_KEY_SECRET` | Edge Function secrets |
| `RAZORPAY_WEBHOOK_SECRET` | Edge Function secrets |

Razorpay `key_id` returned by `razorpay-create-order` at runtime — not hardcoded.

---

## 16. Android Integration Checklist

### Must do

- [ ] Supabase Kotlin SDK — Auth, Postgrest, Functions
- [ ] Mirror web auth metadata (`name`, `role`, `address`, `phone`, `bank_account`)
- [ ] Call `ensure_profile_from_auth()` after signup
- [ ] Use `checkout_order` RPC for cart — never local payment logic
- [ ] Use `get_wallet_balance` + `wallet_history` for wallet UI
- [ ] Razorpay flow via `razorpay-create-order` + poll `payment_intents`
- [ ] Display royalty from `wallet_history` / `order_items` only
- [ ] AI via HTTP to same FastAPI base URL
- [ ] Respect camelCase column names on `orders`, `order_items`, `wallet_history`, `users`
- [ ] Use `platform: "android"` in Razorpay create-order body

### Must not do

- [ ] Modify schema, RLS, RPCs, Edge Functions
- [ ] Call `add_funds`
- [ ] Calculate royalty or wallet balance on-device
- [ ] Create duplicate REST endpoints
- [ ] Embed service role or Razorpay secrets

---

## 17. Known Gaps / Backend Change Requests

**None required for MVP Android client** if the above contracts are followed.

If Android needs a capability not exposed today, file `ANDROID_BACKEND_CHANGE_REQUEST.md` and wait for approval. Examples that would **require approval**:

- New RPC for mobile-only checkout
- Schema column renames
- New roles
- Client-side royalty calculation endpoint

---

## 18. Reference Files (Web — API contract source)

| Domain | Primary files |
|--------|---------------|
| Supabase client | `src/lib/supabaseClient.ts` |
| Auth | `src/lib/auth.ts`, `src/hooks/useAuth.tsx` |
| Wallet | `src/lib/wallet.ts`, `src/lib/razorpayWallet.ts` |
| Checkout | `src/lib/checkout.ts` |
| Marketplace | `src/lib/marketplaceData.ts`, `src/pages/Marketplace.tsx` |
| Commerce meta | `src/lib/commerceMeta.ts` |
| Manufacturing | `src/lib/manufacturingData.ts` |
| AI | `src/lib/aiApi.ts` |
| Admin | `src/pages/Admin.tsx`, `src/lib/paymentAudit.ts`, `src/lib/demoWalletCredit.ts` |
| Types | `src/types/auth.ts` |
| Edge Functions | `supabase/functions/razorpay-create-order/`, `razorpay-webhook/` |
| Architecture | `docs/architecture/ROYALTY_ARCHITECTURE.md`, `RAZORPAY_ARCHITECTURE.md`, `AI_ARCHITECTURE.md` |
| Android guide | `docs/api/ANDROID_RAZORPAY_INTEGRATION.md` |
| Verification | `scripts/commerce-verify.mjs` |

---

## 19. Verification Baseline (do not break)

Before and after any Android work:

```bash
npm run build          # Web build must pass
npm run commerce:verify  # 26/26 against production Supabase
```

Web production: https://agro-fair-chain.vercel.app

---

**End of analysis. No modifications were made to backend, web, AI, or database.**
