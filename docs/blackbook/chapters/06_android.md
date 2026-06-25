# Chapter 06 — Android Client (Planned)

## 6.1 Introduction

AgroElevate v1.0.0-rc explicitly **freezes the web platform** as the delivered artifact. The Android mobile client is **architecturally planned and documented** but **contains no source code in the repository**. This chapter describes the intended Android implementation based on `ANDROID_RAZORPAY_INTEGRATION.md`, `RAZORPAY_ARCHITECTURE.md`, and shared Supabase backend contracts—suitable for Black Book completeness and future semester extension.

The Android client is designed as a **peer consumer** of the same Supabase Auth, PostgreSQL RPC, and Edge Function infrastructure as the React web SPA—ensuring wallet balances, orders, and royalty behavior remain consistent across platforms without duplicate business logic on-device.

---

## 6.2 Design Rationale

Mobile access is critical for Indian agricultural users who primarily interact via smartphones. However, duplicating commerce logic in Kotlin would introduce security risks (client-side balance manipulation) and royalty calculation drift. AgroElevate therefore mandates:

1. **Thin client architecture** — UI, navigation, and Razorpay SDK presentation only.
2. **Server-authoritative wallet** — all credits via Razorpay webhook path or admin demo RPC.
3. **Shared RPC surface** — `checkout_order`, `get_wallet_balance`, `transfer_funds`.
4. **Never call `add_funds`** — retired RPC; coordinated app release with migration 016.

---

## 6.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Android Application                     │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ UI Layer │  │ Navigation   │  │ Razorpay SDK    │  │
│  │ (Compose)│  │ (NavHost)    │  │ Standard Checkout│  │
│  └────┬─────┘  └──────┬───────┘  └────────┬────────┘  │
│       │               │                    │            │
│  ┌────┴───────────────┴────────────────────┴────────┐  │
│  │           Supabase Kotlin SDK                     │  │
│  │  Auth · Postgrest · Functions · Realtime          │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    Supabase Auth   PostgreSQL RPC   Edge Functions
                          │
                    Razorpay Cloud
```

**Workflow diagram placeholder:** `[Fig 6.1 — Android commerce workflow diagram]`

---

## 6.4 Proposed Folder Structure

Although not implemented in-repo, the recommended Kotlin Multi-module layout for a Final Year continuation is:

```
agroelevate-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/agroelevate/
│   │   │   ├── MainActivity.kt
│   │   │   ├── AgroElevateApp.kt
│   │   │   ├── navigation/
│   │   │   │   ├── NavGraph.kt
│   │   │   │   └── Routes.kt
│   │   │   ├── ui/
│   │   │   │   ├── auth/          # Login, Register
│   │   │   │   ├── marketplace/   # Listings, Detail, Cart
│   │   │   │   ├── wallet/        # Balance, History, Top-up
│   │   │   │   ├── orders/        # Order history
│   │   │   │   ├── dashboard/     # Role dashboards
│   │   │   │   └── theme/
│   │   │   ├── data/
│   │   │   │   ├── SupabaseClient.kt
│   │   │   │   ├── WalletRepository.kt
│   │   │   │   ├── MarketplaceRepository.kt
│   │   │   │   └── PaymentRepository.kt
│   │   │   └── domain/
│   │   │       ├── models/
│   │   │       └── usecases/
│   │   └── res/
│   └── build.gradle.kts
├── build.gradle.kts
└── gradle/libs.versions.toml
```

**Dependencies (planned):**

- Supabase Kotlin SDK (Auth, Postgrest, Functions)
- Razorpay Android Standard SDK (Test Mode)
- Jetpack Compose + Material 3
- Kotlin Coroutines + Flow
- Navigation Compose

---

## 6.5 Navigation Design

### 6.5.1 Navigation Graph

| Route | Screen | Auth Required |
|-------|--------|---------------|
| `splash` | Splash / session restore | No |
| `login` | Email/password login | No |
| `register` | Role selection registration | No |
| `dashboard` | Role-specific home | Yes |
| `marketplace` | Product grid | Yes |
| `product/{id}` | Product detail | Yes |
| `wallet` | Balance + history | Yes |
| `wallet/deposit` | Razorpay top-up | Yes |
| `orders` | Order list | Yes |
| `profile` | Profile edit | Yes |

Bottom navigation (authenticated): **Dashboard · Marketplace · Wallet · Orders · Profile**

Role `admin` adds optional **Admin** destination (WebView or native table)—parity with web `/admin`.

### 6.5.2 Screen Placeholders

| # | Screen | Placeholder |
|---|--------|-------------|
| 1 | Login | `[Fig 6.2 — Android login screen mockup]` |
| 2 | Register role picker | `[Fig 6.3 — Android registration roles]` |
| 3 | Marketplace grid | `[Fig 6.4 — Android marketplace]` |
| 4 | Wallet balance | `[Fig 6.5 — Android wallet screen]` |
| 5 | Razorpay checkout | `[Fig 6.6 — Razorpay Android SDK]` |
| 6 | Payment processing | `[Fig 6.7 — Processing poll UI]` |
| 7 | Order history | `[Fig 6.8 — Android orders list]` |

---

## 6.6 Supabase Integration

### 6.6.1 Authentication

Mirror web flow:

1. `supabase.auth.signUpWith(Email)` including user metadata: `name`, `role`, `address`, `phone`, `bank_account`.
2. On session established, invoke RPC `ensure_profile_from_auth()`.
3. Persist session in EncryptedSharedPreferences via SDK session manager.
4. Attach JWT to Edge Function calls and RLS-scoped queries automatically.

Role mapping identically bridges `middleman`/`trader` through server helpers—Android sends `middleman` in profile metadata to match web Register.tsx.

### 6.6.2 Data Access Patterns

| Feature | Supabase API |
|---------|--------------|
| List products | `from("products").select().gt("quantity", 0)` |
| Wallet balance | `rpc("get_wallet_balance")` |
| Wallet history | `from("wallet_history").select().eq("userId", uid)` |
| Checkout | `rpc("checkout_order", cart)` |
| Transfer | `rpc("transfer_funds", {...})` |
| Payment status | `from("payment_intents").select().eq("id", intentId)` |

Column naming respects production camelCase on `wallet_history`, `orders`, `order_items`.

---

## 6.7 Marketplace Module (Android)

### 6.7.1 Listing Browse

- Pull-to-refresh on product grid.
- Product cards show name, price_per_unit, unit, seller role badge.
- Royalty badge when `description` JSON contains `original_farmer_id` (parse client-side for display only—settlement remains server-side).

### 6.7.2 Checkout

1. Validate cart quantities against live `products.quantity`.
2. Pre-check `get_wallet_balance() >= cart total`.
3. Invoke `checkout_order` with JSON array `[{ "id": "<uuid>", "qty": n }]`.
4. On success, navigate to order confirmation; refresh wallet balance.

Error handling maps PostgreSQL exceptions to user-friendly toasts (insufficient balance, out of stock).

---

## 6.8 Wallet and Razorpay Flow

Documented in `ANDROID_RAZORPAY_INTEGRATION.md` (Phase G):

### 6.8.1 Deposit Sequence

```
User → Enter amount
     → supabase.functions.invoke("razorpay-create-order", { amount_inr, platform: "android" })
     ← { order_id, key_id, intent_id, receipt_number }
     → RazorpayCheckout.open(order_id)  // NEVER construct order on device
     → User completes payment in Razorpay UI
     → Show "Processing…" spinner
     → Poll payment_intents.status until "paid" OR poll get_wallet_balance
     ← Display receipt from payment_receipts
```

### 6.8.2 Kotlin Invoke Example (from integration guide)

```kotlin
val response = supabase.functions.invoke(
  function = "razorpay-create-order",
  body = buildJsonObject {
    put("amount_inr", amountInr)
    put("platform", "android")
  }
)
// Use response.order_id, response.key_id, response.intent_id, response.receipt_number
```

### 6.8.3 Breaking Change Coordination

All legacy `add_funds` RPC calls must be removed from Android codebase before release. App store release gates on migration 016 deployment to production Supabase.

### 6.8.4 Demo Credits

When admin assigns demo wallet credit, Android displays `wallet_history.type === 'demo_credit'` with **"Demo" badge**—matching web wallet UI behavior.

---

## 6.9 Android Testing Plan

| ID | Test Case | Type | Expected |
|----|-----------|------|----------|
| A-T01 | Login valid credentials | UI | Dashboard displayed |
| A-T02 | Register farmer role | UI | Profile + wallet row created |
| A-T03 | Session persistence | Integration | Cold start restores session |
| A-T04 | Marketplace product load | Integration | Products with qty > 0 shown |
| A-T05 | Checkout insufficient balance | System | Error message, no order |
| A-T06 | Checkout success | System | Order + wallet debit |
| A-T07 | Razorpay create order | Integration | intent_id returned |
| A-T08 | Razorpay Test payment | E2E | payment_intents.status = paid |
| A-T09 | Wallet history deposit row | System | type=deposit, receipt linked |
| A-T10 | add_funds call absent | Security | No client path to add_funds |
| A-T11 | Royalty display on relisted product | UI | 12.5% badge visible |
| A-T12 | JWT expired refresh | Security | Silent token refresh |

**Parity goal:** Android E2E should mirror web `commerce:verify` flows using Espresso/UI Automator against Test Mode Supabase project.

---

## 6.10 Non-Goals for Android v1

- Offline marketplace caching with sync conflict resolution.
- AI intelligence dashboards (defer to WebView or v2 native charts).
- Push notifications via FCM (schema has `notifications` table—future work).
- Manufacturing batch UI (industrialist advanced features—web-first).

---

## 6.11 Integration Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Supabase Kotlin SDK configured | Planned |
| 2 | Razorpay Test keys in Edge Function secrets | ✅ Server-side ready |
| 3 | Migration 016 applied | Required |
| 4 | remove `add_funds` calls | Required |
| 5 | Poll payment_intents after checkout | Spec documented |
| 6 | Demo credit badge | Spec documented |
| 7 | Role metadata on signup | Match web Register.tsx |
| 8 | Commerce parity test suite | Planned |

---

## 6.12 Summary

The AgroElevate Android client is specified as a **thin, secure companion** to the verified web platform—sharing Supabase RPC commerce logic and Razorpay server-order patterns. While source code is outside v1.0.0-rc scope, this chapter provides sufficient architectural detail, folder structure, navigation map, integration sequences, and test plan for academic evaluators to assess mobile readiness and for future implementation without redesigning backend contracts. All wallet and royalty invariants proven at **26/26** web verification automatically apply to Android once the documented SDK integration is completed.

---

*Primary reference: `ANDROID_RAZORPAY_INTEGRATION.md`, `RAZORPAY_ARCHITECTURE.md`, `FINAL_RELEASE_REPORT.md` (Android explicitly out of scope for RC).*
