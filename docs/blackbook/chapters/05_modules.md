# Chapter 05 — Module Description

## 5.1 Introduction

This chapter documents each functional module of AgroElevate v1.0.0-rc: purpose, workflow, business logic, APIs/RPCs invoked, UI screens/routes, and screenshot placeholders for the Black Book appendix. Modules are organized by stakeholder role and cross-cutting concern. All descriptions reflect **actual implementation** in the `agro-fair-chain` repository.

### Module Summary Matrix

| Module | Primary Routes | Key RPCs / APIs | Roles |
|--------|----------------|-----------------|-------|
| Farmer | `/dashboard`, `/marketplace`, `/wallet` | `checkout_order`, listing inserts | farmer |
| Trader | `/dashboard`, `/marketplace`, `/wallet` | `checkout_order`, relist metadata | middleman |
| Industrialist | `/dashboard`, `/marketplace`, `/intelligence` | `checkout_order`, manufacturing RPCs | industrialist |
| Customer | `/dashboard`, `/marketplace`, `/wallet` | `checkout_order` | customer |
| Admin | `/admin`, `/admin/payments` | `admin_demo_wallet_credit`, profile updates | admin |
| Wallet | `/wallet` | `get_wallet_balance`, Razorpay EF, `transfer_funds` | all authenticated |
| Royalty | Embedded in checkout | `_commerce_settle_sale` | farmer (beneficiary), trader/industrialist (payer) |
| Marketplace | `/marketplace`, `/marketplace/:id` | `checkout_order`, product CRUD | all |
| Orders | `/orders` | `orders`, `order_items` SELECT | buyers/sellers |
| Analytics | `/dashboard`, `/intelligence` | Supabase aggregates, AI dashboards | role-specific |
| AI | `/intelligence` | FastAPI `/api/intelligence/*` | farmer, trader, industrialist |
| Copilot | `/intelligence` (chat panel) | POST `/api/intelligence/copilot` | all intelligence roles |

---

## 5.2 Farmer Module

### 5.2.1 Purpose

Enable cultivators to list produce, receive direct sale proceeds, and **automatically collect downstream royalties** when traders relist and industrialists purchase—without additional farmer action at resale time.

### 5.2.2 Workflow

1. Register with role `farmer` (`Register.tsx`) including bank account.
2. `ensure_profile_from_auth` provisions `profiles` + `users` wallet row.
3. Create listing on Marketplace → INSERT into `products` with `seller_id = farmer UUID`.
4. Receive payment when buyer completes `checkout_order` → `wallet_history` type `sale` (as seller) or observe buyer purchases where farmer is seller.
5. When trader relists with metadata, royalty arrives as `royalty_income` on industrialist purchase.

### 5.2.3 Business Logic

- Farmer listings decrement `products.quantity` atomically in checkout RPC.
- Farmer sales stats aggregated from `order_items` WHERE `farmerId = auth.uid()` (RLS-permitted).
- Royalty rate default **12.5%**, clamped **10–12.5%** server-side.
- Farmer dashboard (`FarmerDashboardSection.tsx`) shows sales totals, royalty KPIs, obligations.

### 5.2.4 APIs and Data Access

| Operation | Method |
|-----------|--------|
| List product | Supabase INSERT `products` |
| View sales | SELECT `order_items` + join `orders` |
| Wallet balance | RPC `get_wallet_balance()` |
| Wallet history | SELECT `wallet_history` |
| Intelligence | GET `/api/intelligence/farmer/dashboard` |

### 5.2.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Farmer Dashboard | `/dashboard` | `[Fig 5.1 — Farmer Dashboard with sales metrics]` |
| My Listings | `/marketplace` (filtered) | `[Fig 5.2 — Farmer product listing form]` |
| Wallet with royalty | `/wallet` | `[Fig 5.3 — Royalty income ledger entries]` |
| Farmer Intelligence | `/intelligence` | `[Fig 5.4 — Crop recommendations panel]` |

---

## 5.3 Trader Module

### 5.3.1 Purpose

Traders (stored as role `middleman` in `profiles`, `trader` in `users`) procure from farmers, manage inventory, and relist with **ownership metadata** enabling downstream royalty enforcement.

### 5.3.2 Workflow

1. Fund wallet via Razorpay top-up (Edge Function → Checkout → webhook/poll).
2. Purchase farmer listing via cart checkout (`checkout_order`).
3. Relist purchased goods: INSERT new `products` row with `description` JSON:

```json
{
  "original_farmer_id": "<farmer-uuid>",
  "source_order_item_id": "<order-item-uuid>",
  "source_order_item_qty": 5,
  "purchase_price_per_unit": 50
}
```

4. Industrialist purchases relisted product → royalty auto-credited to farmer; trader receives net sale proceeds.

### 5.3.3 Business Logic

- `_parse_product_commerce_meta` extracts lineage from description at checkout.
- `_resolve_sale_royalty_mode` determines immediate vs. none based on buyer/seller roles.
- Trader inventory stats via `loadTraderInventory()` in `marketplaceData.ts`.
- Toast on industrialist purchase: "12.5% royalty credited to original farmer" (`Marketplace.tsx`).

### 5.3.4 APIs

| Operation | RPC / API |
|-----------|-----------|
| Checkout | `checkout_order(cart)` |
| Transfer to farmer | `transfer_funds(p_receiver_id, p_amount)` |
| Trader intelligence | GET `/api/intelligence/trader/dashboard` |

### 5.3.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Trader Dashboard | `/dashboard` | `[Fig 5.5 — Inventory health metrics]` |
| Relist dialog | `/marketplace` | `[Fig 5.6 — Relist with metadata]` |
| Purchase history | `/orders` | `[Fig 5.7 — Trader order list]` |

---

## 5.4 Industrialist Module

### 5.4.1 Purpose

Industrial processors procure agricultural inputs, optionally run **manufacturing batches**, list processed products, and participate in royalty settlements to original farmers.

### 5.4.2 Workflow

1. Fund wallet (Razorpay).
2. Purchase trader relisted goods → triggers immediate farmer royalty.
3. Optional: create `manufacturing_batches` from procurement → deferred `royalty_obligations`.
4. Complete batch → `complete_manufacturing_batch` → `list_processed_product` links to marketplace.
5. Downstream processed sales settle obligations via `_record_obligation_settlement`.

### 5.4.3 Business Logic

- Industrialist dashboard shows batches, processed products, obligations (`manufacturingData.ts`).
- `IndustrialistDashboardSection.tsx` displays royalty obligation summary.
- Copilot explains deferred royalty rules for industrialist role.

### 5.4.4 APIs

| Operation | RPC |
|-----------|-----|
| Checkout | `checkout_order` |
| Manufacturing | `complete_manufacturing_batch`, `list_processed_product` |
| Queries | `get_my_manufacturing_batches`, `get_my_royalty_obligations`, `get_my_processed_products` |
| Intelligence | GET `/api/intelligence/industrialist/dashboard` |

### 5.4.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Industrialist Dashboard | `/dashboard` | `[Fig 5.8 — Manufacturing batches panel]` |
| Procurement view | `/marketplace` | `[Fig 5.9 — Industrialist checkout]` |
| Intelligence | `/intelligence` | `[Fig 5.10 — Supplier ranking chart]` |

---

## 5.5 Customer Module

### 5.5.1 Purpose

End consumers purchase directly from farmers (or other sellers) without participating in the royalty chain—representing retail demand without relisting intent.

### 5.5.2 Workflow

1. Register with role `customer` (bank account optional).
2. Razorpay wallet top-up.
3. Browse marketplace → checkout farmer listing.
4. No royalty triggered on farmer → customer path (verified in commerce harness).

### 5.5.3 Business Logic

- `_buyer_participates_in_royalty_chain` excludes `customer` role from royalty triggers.
- Customer dashboard (`CustomerDashboardSection.tsx`) shows order summary metrics.
- Intelligence hub redirects customers to dashboard (by design — `FINAL_QA_REPORT.md`).

### 5.5.4 APIs

| Operation | RPC |
|-----------|-----|
| Checkout | `checkout_order` |
| Balance | `get_wallet_balance` |

### 5.5.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Customer Dashboard | `/dashboard` | `[Fig 5.11 — Customer order summary]` |
| Marketplace browse | `/marketplace` | `[Fig 5.12 — Customer product grid]` |

---

## 5.6 Admin Module

### 5.6.1 Purpose

Platform governance: user moderation, payment audit visibility, demo wallet credits for academic demonstrations.

### 5.6.2 Workflow

1. Admin registers/logs in with `role = admin`.
2. `/admin` — review profiles, suspend/unapprove users.
3. `/admin/payments` — payment audit summary, receipt review.
4. Demo credits via `admin_demo_wallet_credit` (₹1000/5000/10000 presets or custom amounts migration 018).

### 5.6.3 Business Logic

- `is_admin()` gates RLS policies and admin RPCs.
- Suspended users redirected to `/suspended`; unapproved to `/pending-approval`.
- Demo credits write `demo_wallet_credits` audit + `wallet_history.type = demo_credit`.

### 5.6.4 APIs

| Operation | RPC / Query |
|-----------|-------------|
| Demo credit | `admin_demo_wallet_credit` |
| Payment audit | `get_payment_audit_summary` |
| Profile moderation | UPDATE `profiles`, UPDATE `users` |

### 5.6.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Admin panel | `/admin` | `[Fig 5.13 — User moderation table]` |
| Payments audit | `/admin/payments` | `[Fig 5.14 — Payment intents summary]` |

---

## 5.7 Wallet Module

### 5.7.1 Purpose

Unified digital wallet for all commerce: deposits, purchases, sales, royalties, transfers, demo credits—with immutable audit trail.

### 5.7.2 Workflow

1. **Deposit:** User enters amount → `razorpay-create-order` Edge Function → Razorpay Checkout → poll balance / webhook confirms.
2. **Spend:** Checkout debits buyer via `_wallet_ledger_entry` type `purchase`.
3. **Receive:** Seller credited `sale`; farmer may receive `royalty_income`.
4. **Transfer:** User specifies receiver UUID + amount → `transfer_funds`.
5. **History:** `wallet.ts` reads `wallet_history` ordered by `createdAt DESC`.

### 5.7.3 Business Logic

- Balance source: `users.walletBalance` reconciled by `_reconcile_wallet_balance`.
- Client `add_funds` blocked — security invariant verified E2E.
- Reference linking: `reference_type` + `reference_id` on new ledger rows.
- Demo badge in UI for `demo_credit` entries.

### 5.7.4 APIs

| Operation | Endpoint |
|-----------|----------|
| Balance | RPC `get_wallet_balance()` |
| Deposit | Edge Function `razorpay-create-order` |
| Transfer | RPC `transfer_funds` |
| History | SELECT `wallet_history` |
| Payment status | SELECT `payment_intents` |

### 5.7.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Wallet overview | `/wallet` | `[Fig 5.15 — Balance + add funds]` |
| Transaction history | `/wallet` | `[Fig 5.16 — Ledger with deposit receipt]` |
| Razorpay modal | `/wallet` | `[Fig 5.17 — Razorpay checkout overlay]` |

---

## 5.8 Royalty Module

### 5.8.1 Purpose

Core innovation: programmatic remittance of **12.5%** to original farmers on qualifying downstream resales (Option B architecture).

### 5.8.2 Workflow

See `../diagrams/03_royalty_workflow.mmd`:

1. Trader relists with metadata embedding `original_farmer_id`.
2. Industrialist checkout invokes `_commerce_settle_sale`.
3. Royalty = line total × royalty_percent (default 0.125).
4. `_wallet_transfer` moves royalty buyer → farmer; seller receives net.
5. `wallet_history` records `royalty_income` scoped by `orderId`.

### 5.8.3 Business Logic

| Path | Royalty |
|------|---------|
| Farmer → Trader | None |
| Farmer → Customer | None |
| Trader → Industrialist (relisted) | **12.5% immediate** |
| Processed product sale | Deferred via obligations (Phase 3) |

Verified: ₹43.75 on 5×₹70 (`ROYALTY_VERIFICATION_REPORT.md`).

### 5.8.4 APIs

Internal only: `_commerce_settle_sale`, `_parse_product_commerce_meta`, `_build_ownership_chain`, `_record_obligation_settlement`.

External observable: `wallet_history` WHERE `type = 'royalty_income'`.

### 5.8.5 UI Indicators

- `ProductCard.tsx`: "12.5% royalty goes to the original farmer"
- Marketplace toast on qualifying checkout
- Farmer wallet and dashboard royalty KPIs

**Screenshot:** `[Fig 5.18 — Royalty verification in wallet history]`

---

## 5.9 Marketplace Module

### 5.9.1 Purpose

Public product discovery, cart management, and checkout orchestration.

### 5.9.2 Workflow

1. Load active products (`quantity > 0`) from `products`.
2. User adds items to cart (client state).
3. Checkout validates session + wallet balance.
4. RPC `checkout_order({ cart: [{ id, qty }] })` executes atomically.
5. Product detail at `/marketplace/:id` shows seller info, royalty notice if applicable.

### 5.9.3 Business Logic

- Stock enforced with `FOR UPDATE` on products in RPC.
- Insufficient balance raises exception before order creation.
- Cart processes multiple line items in single transaction.

### 5.9.4 APIs

| Operation | API |
|-----------|-----|
| List products | SELECT `products` |
| Product detail | SELECT by `id` |
| Checkout | RPC `checkout_order` |
| Create listing | INSERT `products` |

### 5.9.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Marketplace grid | `/marketplace` | `[Fig 5.19 — Marketplace product cards]` |
| Product detail | `/marketplace/:id` | `[Fig 5.20 — Product detail + add to cart]` |
| Cart checkout | `/marketplace` | `[Fig 5.21 — Checkout confirmation]` |

---

## 5.10 Orders Module

### 5.10.1 Purpose

Post-purchase visibility for buyers: order headers, line items, status, amounts.

### 5.10.2 Workflow

1. Successful checkout creates `orders` row + `order_items` rows.
2. `/orders` page queries orders WHERE `buyerId = auth.uid()`.
3. Expandable line item details show crop name, quantity, price.

### 5.10.3 Business Logic

- Order status set to `completed` on successful checkout RPC.
- Farmers access sales via `order_items` RLS (not `/orders` buyer view).

### 5.10.4 APIs

SELECT `orders`, SELECT `order_items` with joins.

### 5.10.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Order list | `/orders` | `[Fig 5.22 — Buyer order history]` |

---

## 5.11 Analytics Module

### 5.11.1 Purpose

Role-specific operational metrics on dashboards plus AI-enhanced analytics on intelligence pages.

### 5.11.2 Workflow

- **Farmer:** `fetchFarmerSalesStats` — revenue, units sold, royalty totals from `order_items` + `wallet_history`.
- **Trader:** Inventory value, purchase orders, relist counts.
- **Industrialist:** Batch throughput, obligation balances.
- **AI layer:** District analytics, seasonal calendars, historical trends from `order_items` time series.

### 5.11.3 Business Logic

- `ThemedChart.tsx`, `MetricCard`, `AnimatedCounter` render dashboard KPIs.
- Insufficient data gates prevent misleading charts (`InsufficientDataPanel`).

### 5.11.4 APIs

Supabase aggregate queries + AI dashboard endpoints.

### 5.11.5 UI Screens

**Screenshot:** `[Fig 5.23 — Dashboard analytics charts]`

---

## 5.12 AI Intelligence Module

### 5.12.1 Purpose

Deliver crop recommendations, market predictions, income forecasts, and role-specific decision support grounded in platform data and external weather.

### 5.12.2 Workflow

1. User navigates to `/intelligence` → `IntelligenceHub.tsx`.
2. Role router loads `FarmerInsights`, `TraderInsights`, or `IndustrialistInsights`.
3. `useAiService` hook checks health; `AiStatusBanner` shows online/offline.
4. Dashboard fetched from FastAPI; results cached in React state.
5. Optional refresh via POST `/api/intelligence/refresh`.

### 5.12.3 Business Logic

- Models: `crop_recommender`, `market_predictor`, `income_forecaster`, `demand_intelligence`, role intel modules.
- Persistence to `ai_*` tables via service role.
- `withFallback()` returns empty safe dashboard when AI offline.
- Open-Meteo weather integrated in farmer views.

### 5.12.4 APIs

| Endpoint | Role |
|----------|------|
| GET `/api/intelligence/farmer/dashboard` | Farmer |
| GET `/api/intelligence/trader/dashboard` | Trader |
| GET `/api/intelligence/industrialist/dashboard` | Industrialist |
| POST `/api/intelligence/refresh` | All |
| GET `/health` | Monitoring |

### 5.12.5 UI Screens

| Screen | Route | Screenshot Placeholder |
|--------|-------|------------------------|
| Intelligence Hub | `/intelligence` | `[Fig 5.24 — Intelligence hub landing]` |
| Farmer insights | `/intelligence` | `[Fig 5.25 — Market prediction charts]` |
| Offline banner | `/intelligence` | `[Fig 5.26 — AI offline graceful fallback]` |

---

## 5.13 Copilot Module

### 5.13.1 Purpose

Conversational assistant explaining platform features, crop guidance, and royalty rules in natural language with role context.

### 5.13.2 Workflow

1. User types message in copilot panel within Intelligence Hub.
2. POST `/api/intelligence/copilot?user_id=&role=` with `{ message, context }`.
3. `copilot.py` classifies intent, assembles reply with platform facts (including 12.5% royalty explanation for traders/industrialists).
4. Suggestions returned for follow-up prompts.

### 5.13.3 Business Logic

- Rule-augmented responses for commerce/royalty questions (not ungrounded LLM hallucination in v1.0.0-rc).
- Offline fallback message preserves user confidence in core platform.
- Location and season injected when available from profile/geo context.

### 5.13.4 APIs

POST `/api/intelligence/copilot` — see `aiApi.ts` `sendCopilotMessage()`.

### 5.13.5 UI Screens

**Screenshot:** `[Fig 5.27 — Copilot chat with royalty explanation]`

---

## 5.14 Cross-Cutting Modules

### 5.14.1 Authentication Module

Routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`. Components: `ProtectedRoute`, `RoleRoute`, `GuestRoute`. Library: `src/lib/auth.ts`.

**Screenshot:** `[Fig 5.28 — Registration role selection]`

### 5.14.2 Profile Module

Route: `/profile`. Updates `profiles` fields (name, phone, address, bank_account).

**Screenshot:** `[Fig 5.29 — Profile edit form]`

### 5.14.3 Theme and Layout

`AppLayout`, `MarketingLayout`, dark/light theme via `useTheme`, page transition animations, skeleton loading states.

---

## 5.15 Summary

AgroElevate's modular design maps cleanly to supply chain roles while sharing core infrastructure (auth, wallet, marketplace RPC). The royalty module is embedded rather than bolted-on—invoked inside `checkout_order` for atomic correctness. Each module's UI routes are live in production build; screenshot placeholders mark insertion points for final Black Book PDF compilation. Automated verification covers farmer/trader/industrialist/customer commerce paths at **26/26** checks, providing module-level confidence for academic evaluation.

---

*Source: `src/App.tsx`, `src/pages/*`, `src/lib/*`, `FINAL_QA_REPORT.md`*
