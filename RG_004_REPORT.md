# RG-004 Report — Retire Direct `add_funds`

**Date:** 2025-06-24  
**Phase:** RG-004  
**Migration:** `20250625100016_phase_g_razorpay_wallet.sql` (section RG-004)

## Objective

Remove client-accessible direct wallet credits; webhook settlement becomes the only deposit path.

## Deliverables

| Layer | Change | Status |
|-------|--------|--------|
| Postgres | `add_funds` raises exception; REVOKE from `authenticated` / `anon` | ✅ Written |
| Frontend | `wallet.ts` `addFunds()` throws immediately | ✅ Written |
| Wallet UI | Razorpay top-up replaces manual add | ✅ Written |

## Build

```
npm run build — PASS
```

## Verification

| Check | Pre-migration | Post-migration (expected) |
|-------|---------------|----------------------------|
| `add_funds blocked for clients` | FAIL (still credits) | PASS |
| `commerce:smoke` add_funds exists | PASS | PASS (raises / not authenticated) |

## Android note

See `ANDROID_RAZORPAY_INTEGRATION.md` — remove `add_funds` calls in coordinated release.
