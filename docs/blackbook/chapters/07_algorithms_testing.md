# Chapter 07 — Algorithms and Testing

## 7.1 Introduction

This chapter presents pseudocode for core AgroElevate algorithms—authentication, registration, checkout, royalty distribution, wallet deposit, AI recommendation, and copilot chat—and documents the project's verification strategy with professional test case tables. All test results reference **actual harness output** from AgroElevate v1.0.0-rc: **`npm run commerce:verify` 26/26 PASS**, **`npm run commerce:smoke` 7/7 PASS**, **`npm run build` PASS**, **`npm run ai:verify` Health OK**, and **royalty 12.5% (₹43.75) verified**.

---

## 7.2 Algorithm: User Login

```
ALGORITHM Login(email, password)
INPUT: email, password
OUTPUT: session JWT or error

BEGIN
    client ← SupabaseClient(anon_key)
    result ← client.auth.signInWithPassword(email, password)

    IF result.error IS NOT NULL THEN
        RETURN Failure(result.error.message)
    END IF

    session ← result.data.session
    userId ← result.data.user.id

    // Ensure profile and wallet row exist (recovery path)
    client.rpc("ensure_profile_from_auth")

    profile ← SELECT * FROM profiles WHERE id = userId

    IF profile.suspended = TRUE THEN
        RETURN Redirect("/suspended")
    END IF

    IF profile.approved = FALSE THEN
        RETURN Redirect("/pending-approval")
    END IF

    STORE session locally (Supabase SDK)
    RETURN Success(session, profile)
END
```

**Implementation:** `src/lib/auth.ts`, `src/pages/Login.tsx`, `ProtectedRoute.tsx`.

---

## 7.3 Algorithm: User Registration

```
ALGORITHM Register(name, email, password, role, address, phone, bankAccount)
INPUT: registration form fields
OUTPUT: user account, profile, wallet row

BEGIN
    VALIDATE role IN {farmer, middleman, industrialist, customer}
    IF role ≠ customer AND bankAccount invalid THEN
        RETURN ValidationError("Bank account required")
    END IF

    client ← SupabaseClient(anon_key)
    signup ← client.auth.signUp({
        email, password,
        options: { data: { name, role, address, phone, bank_account: bankAccount } }
    })

    IF signup.error IS NOT NULL THEN
        RETURN Failure(signup.error)
    END IF

    IF signup.data.session IS NULL THEN
        RETURN PendingEmailVerification(email)
    END IF

    // Provision profiles + users via RPC and direct inserts
    CALL ensureUserRecords(signup.data.user)
        → INSERT profiles (id, email, name, role, ...)
        → RPC ensure_profile_from_auth()
        → users row with walletBalance = 0

    RETURN Success(Redirect("/dashboard"))
END
```

**Role bridge:** Server maps `middleman` (profiles) ↔ `trader` (users) in `_role_for_*` helpers.

---

## 7.4 Algorithm: Checkout Order

```
ALGORITHM CheckoutOrder(buyerId, cart[])
INPUT: authenticated buyer, cart = [{ product_id, qty }, ...]
OUTPUT: order_id, total_amount OR exception

BEGIN
    buyerRole ← SELECT role FROM profiles WHERE id = buyerId
    total ← 0
    lineItems ← []

    BEGIN TRANSACTION
        FOR EACH item IN cart DO
            product ← SELECT * FROM products WHERE id = item.product_id FOR UPDATE
            IF product.quantity < item.qty THEN
                ROLLBACK; RETURN Error("Insufficient stock")
            END IF
            lineTotal ← product.price_per_unit * item.qty
            total ← total + lineTotal
            lineItems.APPEND(product, item.qty, lineTotal)
        END FOR

        balance ← GetWalletBalance(buyerId)
        IF balance < total THEN
            ROLLBACK; RETURN Error("Insufficient wallet balance")
        END IF

        orderId ← INSERT orders(buyerId, buyerRole, totalAmount, status='completed')

        FOR EACH line IN lineItems DO
            orderItemId ← INSERT order_items(orderId, cropId, farmerId, ...)
            CommerceSettleSale(buyerId, sellerId, line, orderId, orderItemId)
            UPDATE products SET quantity = quantity - line.qty
        END FOR

    COMMIT
    RETURN { order_id: orderId, total_amount: total }
END
```

**Implementation:** PostgreSQL `checkout_order(cart JSONB)` — migrations 013, 014, 015 v2.

---

## 7.5 Algorithm: Royalty Distribution

```
ALGORITHM CommerceSettleSale(buyerId, sellerId, line, orderId, orderItemId)
INPUT: sale line with product metadata
OUTPUT: wallet transfers recorded

BEGIN
    meta ← ParseProductCommerceMeta(product.description)
    royaltyMode ← ResolveSaleRoyaltyMode(buyerRole, sellerRole, meta)

    lineTotal ← line.qty * line.price_per_unit
    royaltyPercent ← CLAMP(meta.rate OR 12.5, 10.0, 12.5)
    royaltyAmount ← 0

    IF royaltyMode = IMMEDIATE AND meta.original_farmer_id IS NOT NULL THEN
        royaltyAmount ← lineTotal * (royaltyPercent / 100)
        farmerId ← meta.original_farmer_id

        WalletTransfer(buyerId → farmerId, royaltyAmount,
                       type='royalty_income', orderId=orderId)
        sellerNet ← lineTotal - royaltyAmount
        WalletTransfer(buyerId → sellerId, sellerNet, type='sale', orderId=orderId)
    ELSE IF royaltyMode = DEFERRED THEN
        CreateDeferredObligation(orderItemId, royaltyPercent, lineTotal)
        WalletTransfer(buyerId → sellerId, lineTotal, type='sale', orderId=orderId)
    ELSE
        // Direct sale — no royalty
        WalletTransfer(buyerId → sellerId, lineTotal, type='sale', orderId=orderId)
    END IF

    WalletTransfer(buyerId, -lineTotal, type='purchase', orderId=orderId)
END
```

**Verified instance:** qty=5, price=₹70 → lineTotal=₹350 → royalty=₹43.75 (12.5%).

---

## 7.6 Algorithm: Wallet Deposit (Razorpay)

```
ALGORITHM WalletDeposit(userId, amountInr)
INPUT: authenticated user, amount 1–100000 INR
OUTPUT: payment intent, Razorpay order

BEGIN
    // Client-side — never credits wallet directly
    response ← EdgeFunction("razorpay-create-order", {
        amount_inr: amountInr,
        platform: "web" | "android"
    })

    intentId ← response.intent_id
    razorpayOrderId ← response.order_id

    DISPLAY RazorpayCheckout(razorpayOrderId)

    // After user pays — server path
    ON Webhook(payment.captured) DO
        confirm_wallet_deposit(razorpay_order_id, razorpay_payment_id, amount_paise)
            → INSERT wallet_history(type='deposit')
            → UPDATE users.walletBalance
            → INSERT payment_receipts
            → UPDATE payment_intents.status = 'paid'
    END

    // Client polling fallback
    REPEAT
        WAIT 2 seconds
        status ← SELECT status FROM payment_intents WHERE id = intentId
    UNTIL status = 'paid' OR timeout

    RETURN GetWalletBalance(userId)
END
```

**Security invariant:** `add_funds(p_amount)` raises exception for authenticated clients.

---

## 7.7 Algorithm: AI Crop Recommendation

```
ALGORITHM GenerateCropRecommendations(userId, role, location, month)
INPUT: user context
OUTPUT: ranked crop list with confidence scores

BEGIN
    orderHistory ← LOAD order_items aggregated by crop for userId/region
    seasonalFeatures ← ComputeSeasonalFeatures(location, month)  // india_geo.py
    weather ← FetchOpenMeteo(location) OPTIONAL

    IF orderHistory.count < MIN_SAMPLES THEN
        RETURN SyntheticBaselineRecommendations(location, month)
            WITH flag use_synthetic = TRUE
    END IF

    featureMatrix ← FeatureEngineering(orderHistory, seasonalFeatures, weather)
    predictions ← CropRecommenderModel.predict(featureMatrix)  // sklearn

    ranked ← SORT predictions BY suitability_score DESC
    topN ← TAKE ranked, 10

    FOR EACH crop IN topN DO
        PERSIST ai_crop_recommendations(userId, role, crop, rank, confidence)
    END FOR

    insights ← InsightGenerator(topN, market_signals)
    PERSIST ai_user_insights(userId, insights)

    RETURN DashboardPayload(recommendations=topN, insights, weather)
END
```

**Implementation:** `ai-service/app/services/intelligence_service.py`, `crop_recommender.py`.

---

## 7.8 Algorithm: Copilot Chat

```
ALGORITHM CopilotChat(userId, role, message, location, context)
INPUT: user message and role context
OUTPUT: reply, intent, suggestions

BEGIN
    intent ← ClassifyIntent(message)  // keyword + role rules

    profile ← LOAD user profile and recent wallet/order summary
    geo ← ResolveGeo(location)

    replyParts ← []

    SWITCH intent
        CASE ROYALTY_QUESTION:
            IF role IN {middleman, trader} THEN
                replyParts.APPEND("12.5% royalty on resale to industrialist...")
            ELSE IF role = industrialist THEN
                replyParts.APPEND("Deferred 12.5% royalty on processed sales...")
            END IF
        CASE CROP_ADVICE:
            recs ← GetLatestRecommendations(userId)
            replyParts.APPEND(FORMAT recs[0..3])
        CASE WALLET_HELP:
            balance ← GetWalletBalance(userId)
            replyParts.APPEND("Balance: ₹" + balance)
        DEFAULT:
            replyParts.APPEND(GeneralPlatformGuidance(role))
    END SWITCH

    IF weather available AND intent relates to farming THEN
        replyParts.APPEND(FORMAT weather.farming_note)
    END IF

    suggestions ← GenerateFollowUpSuggestions(intent, role)

    RETURN { reply: JOIN(replyParts), intent, suggestions, location: geo }
END
```

**Implementation:** `ai-service/app/models/copilot.py`.

---

## 7.9 Testing Strategy Overview

AgroElevate employs a four-layer testing pyramid:

| Layer | Tool / Script | Scope |
|-------|---------------|-------|
| **Unit** | ESLint, TypeScript compiler, Python model functions | Component and model logic |
| **Integration** | `commerce:smoke`, Supabase RPC existence | API contract verification |
| **System / E2E** | `commerce:verify` (26 checks) | Full multi-role commerce |
| **Security** | RLS policies, `add_funds` block test | Client cannot inflate wallet |
| **AI Health** | `ai:verify` | FastAPI liveness + dashboard endpoint |

---

## 7.10 Commerce E2E Verification — 26 Tests

**Script:** `scripts/commerce-verify.mjs`  
**Command:** `npm run commerce:verify`  
**Result (v1.0.0-rc):** ✅ **26/26 PASS**

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| CV-01 | Farmer account ready | Sign-in or admin provision | ✅ PASS |
| CV-02 | Trader account ready | Sign-in or admin provision | ✅ PASS |
| CV-03 | Industrialist account ready | Sign-in or admin provision | ✅ PASS |
| CV-04 | Farmer users row exists | After ensure_profile_from_auth | ✅ PASS |
| CV-05 | Trader users row exists | Wallet row provisioned | ✅ PASS |
| CV-06 | Industrialist users row exists | Wallet row provisioned | ✅ PASS |
| CV-07 | Farmer lists product | INSERT products success | ✅ PASS |
| CV-08 | Razorpay wallet deposit (trader simulate) | ₹10000 credited via harness | ✅ PASS |
| CV-09 | add_funds blocked for clients | Exception / disabled message | ✅ PASS |
| CV-10 | get_wallet_balance after deposit | Balance ≥ ₹5000 | ✅ PASS |
| CV-11 | Trader wallet_history read | Recent rows returned | ✅ PASS |
| CV-12 | checkout_order (farmer→trader) | Order created, stock deducted | ✅ PASS |
| CV-13 | Wallet balance after checkout | Balance decreased | ✅ PASS |
| CV-14 | Farmer sales dashboard (order_items RLS) | ≥1 sale row | ✅ PASS |
| CV-15 | Farmer wallet balance after direct sale | Balance increased | ✅ PASS |
| CV-16 | Farmer wallet_history read | Ledger accessible | ✅ PASS |
| CV-17 | Trader relists product | Product with metadata JSON | ✅ PASS |
| CV-18 | Industrialist razorpay deposit (simulate) | ₹5000 credited | ✅ PASS |
| CV-19 | checkout_order with royalty | Industrialist purchase succeeds | ✅ PASS |
| CV-20 | Royalty transfer wallet_history | type=royalty_income | ✅ PASS |
| CV-21 | Royalty amount 12.5% | ₹43.75 on 5×₹70 (±₹0.02) | ✅ PASS |
| CV-22 | transfer_funds | ₹100 trader→farmer | ✅ PASS |
| CV-23 | Farmer balance after transfer_funds | Balance reflects credit | ✅ PASS |
| CV-24 | Customer account ready | Sign-in/provision | ✅ PASS |
| CV-25 | Customer users row exists | Wallet provisioned | ✅ PASS |
| CV-26 | checkout_order (farmer→customer) | Direct sale, no royalty | ✅ PASS |

*Note: CV-08, CV-18 require `SUPABASE_SERVICE_ROLE_KEY` for payment simulation harness.*

---

## 7.11 Commerce RPC Smoke Tests — 7 Tests

**Script:** `scripts/commerce-smoke.mjs`  
**Command:** `npm run commerce:smoke`  
**Result:** ✅ **7/7 PASS**

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| SM-01 | get_wallet_balance RPC exists | Auth error, not "function not found" | ✅ PASS |
| SM-02 | add_funds RPC exists (retired) | Callable but disabled/blocked | ✅ PASS |
| SM-03 | confirm_wallet_deposit RPC exists | Function present | ✅ PASS |
| SM-04 | transfer_funds RPC exists | Function present | ✅ PASS |
| SM-05 | checkout_order RPC exists | Function present | ✅ PASS |
| SM-06 | ensure_profile_from_auth RPC exists | Function present | ✅ PASS |
| SM-07 | wallet_history table readable | Table exists (RLS may block) | ✅ PASS |

---

## 7.12 AI Verification

**Script:** `scripts/verify-ai-health.mjs`  
**Command:** `npm run ai:verify`

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| AI-01 | GET /health | status=ok, service=agroelevate-ai | ✅ PASS |
| AI-02 | GET /api/intelligence/farmer/dashboard | HTTP 200, recommendations array | ✅ PASS* |

*Restart AI service after `buyer_role` fix if dashboard returns 500 on stale instance.*

---

## 7.13 Build Verification

| ID | Test Case | Command | Expected | Status |
|----|-----------|---------|----------|--------|
| BD-01 | Production build | `npm run build` | Exit 0, dist/ artifacts | ✅ PASS |
| BD-02 | Main bundle size | Vite output | ~384 KB main chunk (post split) | ✅ PASS |
| BD-03 | TypeScript compile | tsc via Vite | No blocking errors | ✅ PASS |

---

## 7.14 Unit Testing Matrix

| Module | Unit Test Focus | Tool | Coverage |
|--------|-----------------|------|----------|
| Auth forms | Zod schema validation | Manual / lint | Register password, bank rules |
| Wallet lib | History parsing, type labels | TypeScript | `wallet.ts` |
| AI API client | Offline fallback | Manual | `withFallback()` |
| RPC helpers | Role mapping SQL | SQL Editor | `_role_for_*` functions |
| Copilot | Intent classification | Python manual | `copilot.py` |
| Feature engineering | buyer_role merge guard | Regression fix | `feature_engineering.py` |

Formal Jest/Pytest suites are not included in v1.0.0-rc; verification emphasis is on **integration/E2E harnesses** suitable for CI.

---

## 7.15 Integration Testing Matrix

| Integration Point | Test Method | Result |
|-------------------|-------------|--------|
| Supabase Auth → profiles | Registration flow | ✅ |
| profiles → users bridge | ensure_profile_from_auth | ✅ |
| products → checkout_order → order_items | CV-12, CV-19 | ✅ |
| checkout → wallet_history | All checkout tests | ✅ |
| Razorpay EF → payment_intents | CV-08 simulate | ✅ |
| Webhook → confirm_wallet_deposit | Payment simulate harness | ✅ |
| FastAPI → Supabase ai_* writes | AI refresh endpoint | ✅ |
| Web → Edge Function JWT | razorpay-create-order | ✅ |

---

## 7.16 System Testing Matrix

| Scenario | Roles | Verified By |
|----------|-------|-------------|
| Full royalty chain | Farmer, Trader, Industrialist | CV-07–CV-21 |
| Customer direct buy | Farmer, Customer | CV-24–CV-26 |
| P2P transfer | Trader, Farmer | CV-22–CV-23 |
| Multi-deposit | Trader, Industrialist, Customer | CV-08, CV-18 |
| Admin demo credit | Admin | Manual (migration 017) |
| Manufacturing deferred royalty | Industrialist | Manual QA (not in harness) |

---

## 7.17 Security Testing Matrix

| ID | Test | Expected | Status |
|----|------|----------|--------|
| SEC-01 | add_funds from client | Rejected | ✅ CV-09 |
| SEC-02 | wallet_history cross-user read | RLS blocks | ✅ |
| SEC-03 | Admin routes without admin role | Redirect/deny | ✅ |
| SEC-04 | confirm_wallet_deposit without webhook auth | Service role only | ✅ |
| SEC-05 | Razorpay order created server-side only | No client order_id forge | ✅ |
| SEC-06 | JWT required for Edge Functions | 401 without token | ✅ |

---

## 7.18 Manual Test Documentation

`MANUAL_COMMERCE_TEST.md` provides step-by-step manual verification when Supabase signup rate limits block automated account creation. Manual checklist mirrors CV-01–CV-21 flows with expected ₹43.75 royalty at step 5.

---

## 7.19 Screenshot Placeholder List (Testing Evidence)

| # | Description | Placeholder |
|---|-------------|-------------|
| 1 | Terminal: commerce:verify 26/26 output | `[Fig 7.1]` |
| 2 | Terminal: commerce:smoke 7/7 output | `[Fig 7.2]` |
| 3 | Terminal: npm run build success | `[Fig 7.3]` |
| 4 | Terminal: ai:verify health OK | `[Fig 7.4]` |
| 5 | Supabase SQL: wallet_history royalty row | `[Fig 7.5]` |
| 6 | Web wallet: ₹43.75 royalty_income | `[Fig 7.6]` |
| 7 | Admin payment audit panel | `[Fig 7.7]` |
| 8 | Razorpay Test Mode receipt | `[Fig 7.8]` |

---

## 7.20 Summary

AgroElevate's testing strategy prioritizes **behavioral proof** of the royalty innovation and wallet security over superficial unit test counts. The commerce verification harness provides reproducible **26/26** evidence that multi-role checkout, Razorpay simulation, royalty mathematics (12.5% = ₹43.75), and customer flows operate correctly against live Supabase. Algorithms are centralized in PostgreSQL RPCs and FastAPI services—minimizing client-side divergence and enabling Android parity without re-testing business logic on mobile. Production build passes confirm deployability for Final Year demonstration and evaluation.

---

*Harness source: `scripts/commerce-verify.mjs`, `scripts/commerce-smoke.mjs`, `scripts/verify-ai-health.mjs`. Reports: `FINAL_QA_REPORT.md`, `ROYALTY_VERIFICATION_REPORT.md`, `FINAL_RELEASE_REPORT.md`.*
