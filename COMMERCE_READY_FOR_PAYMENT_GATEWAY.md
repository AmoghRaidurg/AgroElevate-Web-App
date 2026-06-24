# Commerce Ready for Payment Gateway — Phase F0

**Date:** 2025-06-24  
**Gateway:** Razorpay (not implemented)  
**Verdict:** ⚠️ **NOT YET SAFE** — apply database migrations and pass E2E verification first

---

## Readiness Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Wallet recharge (`add_funds`) | ⚠️ Conditional | RPC correct; requires `users` row + migration 002 applied |
| Wallet balance updates | ⚠️ Conditional | Fixed by migration 008 — **must be deployed** |
| Wallet history updates | ✅ | `_wallet_ledger_entry` writes `wallet_history` |
| Transfer funds | ✅ | RPC + UI wired |
| Checkout (`checkout_order`) | ✅ | Buyer debit, seller credit, royalty split |
| Orders created | ✅ | camelCase `orders` insert in RPC |
| Order items created | ✅ | camelCase `order_items` insert in RPC |
| Dashboard updates (buyer roles) | ✅ | Trader/industrialist buyer queries work |
| Dashboard updates (farmer sales) | ⚠️ Conditional | Fixed by migration 007 — **must be deployed** |
| Farmer royalty | ✅ RPC / ⚠️ UI | Royalty transfers work; dashboard now includes royalty in revenue |
| Frontend build | ✅ | `npm run build` passed |
| Automated E2E | ⚠️ Pending | `scripts/commerce-verify.mjs` — blocked by Supabase signup rate limit during audit run |

---

## Blocking Items Before Razorpay

### 1. Deploy migrations 007 and 008 (required)

Run in Supabase SQL Editor:

- `supabase/migrations/production/20250625100007_prod_commerce_rls_fix.sql`
- `supabase/migrations/production/20250625100008_prod_wallet_balance_sync.sql`

### 2. Run E2E verification (required)

```bash
node scripts/commerce-verify.mjs
```

Expected: all checks pass (✓ farmer/trader/industrialist flow, royalty, RLS reads).

If signup rate-limited, use existing test accounts and sign in manually, or wait and re-run.

### 3. Manual smoke test (recommended)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Log in as trader → Wallet → Add ₹5000 | Balance updates, history shows deposit |
| 2 | Marketplace → buy farmer product | Checkout succeeds, balance decreases |
| 3 | Log in as farmer → Dashboard / Orders | Sale visible with buyer info |
| 4 | Trader relists → industrialist buys | Checkout succeeds |
| 5 | Farmer wallet | Royalty `transfer_in` in history |
| 6 | Wallet → Transfer to another user ID | Both balances update |

---

## What Is Safe Today (post code fix, pre-migration deploy)

| Component | Safe to rely on |
|-----------|-----------------|
| `checkout_order` RPC logic | Yes — code review + atomic function |
| `add_funds` / `transfer_funds` RPC logic | Yes |
| Frontend RPC wiring | Yes — errors now surfaced |
| Production RLS for sellers | **No** — until migration 007 |
| Wallet balance accuracy | **No** — until migration 008 if desync exists |

---

## Razorpay Integration Guidance (when unblocked)

After migrations are applied and E2E passes:

1. Replace `add_funds` mock path with Razorpay order creation + webhook confirmation
2. Webhook handler should call `_wallet_ledger_entry` (or a new `confirm_deposit` RPC) — **do not** let clients self-credit
3. Keep `checkout_order` on wallet balance — Razorpay only funds the wallet, not per-checkout
4. Add idempotency keys on deposit webhooks
5. Add `build:check` script (`tsc --noEmit && vite build`) to CI

---

## Final Verdict

| Question | Answer |
|----------|--------|
| Is Razorpay integration safe to begin **now**? | **No** |
| What remains? | Apply SQL migrations 007–008, run `commerce-verify.mjs` or manual smoke test |
| When safe? | After E2E checklist is green |

**Estimated effort to unblock:** ~15 minutes (SQL deploy + verification run)

---

## Sign-off Criteria (all must be ✓)

- [ ] Migration 007 applied
- [ ] Migration 008 applied
- [ ] `node scripts/commerce-verify.mjs` exits 0
- [ ] Manual wallet recharge confirmed in UI
- [ ] Farmer sees sale after trader purchase
- [ ] Royalty appears in farmer wallet history

Once all boxes are checked, proceed to Razorpay Phase.
