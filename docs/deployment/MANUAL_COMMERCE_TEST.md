# Manual Commerce Test Guide

**Use when:** `npm run commerce:verify` fails with `email rate limit exceeded`  
**Migrations required:** 001–008 applied (including 007 RLS fix, 008 balance sync)

---

## Option A — Automated (recommended after rate limit clears)

### 1. Create fixed test accounts (one-time)

Register these three accounts in the app (`/register`) **or** set `SUPABASE_SERVICE_ROLE_KEY` in `.env` and run `npm run commerce:verify` (admin provisioning bypasses rate limits):

| Role | Email | Password |
|------|-------|----------|
| Farmer | `commerce.verify.farmer@example.com` | `CommerceTest!123` |
| Trader | `commerce.verify.trader@example.com` | `CommerceTest!123` |
| Industrialist | `commerce.verify.ind@example.com` | `CommerceTest!123` |

### 2. Run verification

```bash
npm run commerce:verify
```

Expected: all checks pass (exit code 0).

### 3. RPC smoke test (no accounts needed)

```bash
npm run commerce:smoke
```

Confirms RPCs exist on Supabase (6/6 checks).

---

## Option B — Full manual UI walkthrough

### Prerequisites

- Three browser profiles or incognito windows (Farmer, Trader, Industrialist)
- Migrations 007 and 008 applied

---

### Test 1 — `add_funds`

| Step | Actor | Action | Pass criteria |
|------|-------|--------|---------------|
| 1 | Trader | Log in → `/wallet` | Page loads, balance shown |
| 2 | Trader | Click **Add Funds** → enter ₹5000 → Pay | Success toast |
| 3 | Trader | Refresh wallet | Balance = ₹5000 (or prior + 5000) |
| 4 | Trader | Transaction timeline | `deposit` row for ₹5000 |

---

### Test 2 — `transfer_funds`

| Step | Actor | Action | Pass criteria |
|------|-------|--------|---------------|
| 1 | Farmer | Log in → Profile or browser devtools | Copy User ID (UUID) |
| 2 | Trader | `/wallet` → **Transfer** | |
| 3 | Trader | Receiver ID = Farmer UUID, Amount = ₹100 | Success toast |
| 4 | Trader | Balance decreased by ₹100 | |
| 5 | Farmer | `/wallet` | Balance increased by ₹100, `transfer_in` in history |

---

### Test 3 — `checkout_order` (Farmer → Trader)

| Step | Actor | Action | Pass criteria |
|------|-------|--------|---------------|
| 1 | Farmer | `/marketplace` → List produce (e.g. Wheat, 100 kg @ ₹50/kg) | Listed successfully |
| 2 | Trader | Ensure wallet ≥ ₹500 (add funds if needed) | |
| 3 | Trader | Add farmer product to cart (10 kg) → **Pay & Checkout** | Success toast, total ₹500 |
| 4 | Trader | Wallet balance reduced by ₹500 | |
| 5 | Trader | `/orders` | Purchase visible |
| 6 | Farmer | `/dashboard` and `/orders` | **Sale visible** (RLS fix 007) |
| 7 | Farmer | `/wallet` | `transfer_in` ₹500 from sale |

---

### Test 4 — Royalty (Trader → Industrialist)

| Step | Actor | Action | Pass criteria |
|------|-------|--------|---------------|
| 1 | Trader | `/marketplace` → **My Inventory** → **Sell** 5 kg @ ₹70/kg | Relisted product appears |
| 2 | Industrialist | Add ₹5000 funds | |
| 3 | Industrialist | Buy relisted product (5 kg) → checkout | Total ₹350 |
| 4 | Trader | `/wallet` | Credit ~₹306.25 (87.5% of ₹350) |
| 5 | Farmer | `/wallet` | Royalty `transfer_in` **₹43.75** (12.5% of ₹350) |
| 6 | Farmer | `/dashboard` | Total revenue includes royalty |

---

### Test 5 — Wallet balance sync (migration 008)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Note `wallet_history` sum for a user (Supabase Table Editor) | |
| 2 | Call `get_wallet_balance` via Wallet page display | Balance matches ledger sum |
| 3 | If balance was 0 with history rows before 008 | After refresh, balance reconciled |

---

## Verification checklist

| Flow | Manual ☐ | Automated (`commerce:verify`) ☐ |
|------|----------|----------------------------------|
| `add_funds` | | |
| `get_wallet_balance` / balance sync | | |
| `wallet_history` reads | | |
| `transfer_funds` | | |
| `checkout_order` (direct sale) | | |
| `checkout_order` (royalty resale) | | |
| Farmer sales dashboard (RLS) | | |
| Farmer royalty in wallet | | |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Balance stays ₹0 after deposit | Migration 008 not applied | Run `20250625100008_prod_wallet_balance_sync.sql` |
| Farmer sees no sales | Migration 007 not applied | Run `20250625100007_prod_commerce_rls_fix.sql` |
| `add_funds` / checkout fails | No `users` row | Log out/in; triggers `ensure_profile_from_auth` |
| Transfer fails | Wrong receiver ID format | Use full UUID from Profile (not email) |
| Signup rate limit | Supabase Auth throttle | Wait 1h or use Option A service role |
| RPC "does not exist" | Migrations 002/003 not applied | Run production migration set |

---

## Unblocking automated verify

Add to `.env` (do not commit):

```
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Settings → API>
```

Then:

```bash
npm run commerce:verify
```

The script provisions test users via Admin API when sign-in fails.
