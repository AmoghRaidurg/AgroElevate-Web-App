# PGRST125 Render Fix — Deployment Report

**Date:** 2026-06-25  
**Commit:** `bf97861` — `fix: normalize Supabase URL to prevent PGRST125 on Render`  
**Service:** https://agroelevate-ai.onrender.com  

---

## Root Cause

**Not a query-syntax bug in `commerce_queries.py`.** The Supabase Python client builds requests correctly; Render’s `SUPABASE_URL` environment variable includes the `/rest/v1` path suffix.

`supabase-py` **always appends** `/rest/v1` internally. When `SUPABASE_URL` is already:

```
https://aosnytcfcazlaolozehx.supabase.co/rest/v1
```

the client issues:

```
GET https://aosnytcfcazlaolozehx.supabase.co/rest/v1/rest/v1/orders?...
```

PostgREST returns **PGRST125** — `Invalid path specified in request URL` (HTTP 404).

### Trace (Render logs)

```
load_marketplace_data()
  → fetch_platform_orders()
    → fetch_all_orders_completed()
      → _paginate()
        → fetch_page(offset, limit)
          → sb.table("orders").select(...).eq("status","completed")
             .order("createdAt", desc=True).range(offset, offset+limit-1).execute()
```

### Exact request (before `execute()`)

| Field | Value |
|-------|-------|
| **table** | `orders` |
| **select()** | `id, buyerId, buyerRole, totalAmount, status, createdAt` |
| **filters** | `.eq("status", "completed")` |
| **order()** | `.order("createdAt", desc=True)` |
| **range()** | `.range(0, 999)` (page 1: offset=0, limit=1000) |
| **limit()** | *(not used — pagination via `range`)* |
| **offset** | `0` (first page inside `_paginate`) |

**Correct full URL (local):**

```
GET https://aosnytcfcazlaolozehx.supabase.co/rest/v1/orders
  ?select=id,buyerId,buyerRole,totalAmount,status,createdAt
  &status=eq.completed
  &order=createdAt.desc
  &offset=0&limit=1000
```

**Broken full URL (Render with `/rest/v1` in env):**

```
GET https://aosnytcfcazlaolozehx.supabase.co/rest/v1/rest/v1/orders?...
→ PGRST125
```

Reproduced locally by setting `create_client("https://…supabase.co/rest/v1", key)`.

---

## Why Local Succeeded but Render Failed

| | Local | Render |
|---|-------|--------|
| `SUPABASE_URL` | `https://aosnytcfcazlaolozehx.supabase.co` | `https://aosnytcfcazlaolozehx.supabase.co/rest/v1` *(inferred)* |
| Resolved path | `/rest/v1/orders` ✓ | `/rest/v1/rest/v1/orders` ✗ |
| `/health` | 200 | 200 *(no Supabase calls)* |
| Dashboards | 200 | 500 PGRST125 |

Local `.env` uses the project URL from `VITE_SUPABASE_URL` (no `/rest/v1`). Render env was likely copied from the Supabase **API URL** field, which includes `/rest/v1`.

---

## Package Versions

### `requirements.txt` (after fix)

```
supabase==2.11.0
postgrest==0.19.3   # newly pinned
```

### Local install

| Package | Version |
|---------|---------|
| supabase | 2.11.0 |
| postgrest | 0.19.3 |
| httpx | 0.28.1 |

Query syntax (`.table().select().eq().order().range().execute()`) matches **supabase-py 2.11 / postgrest 0.19** API. No version mismatch caused the failure.

---

## Fix Applied (minimal — no AI/forecasting/business-rule changes)

**File:** `ai-service/app/supabase_client.py`

Added `normalize_supabase_url()` to strip trailing `/rest/v1` before `create_client()`.

```python
def normalize_supabase_url(url: str) -> str:
    cleaned = (url or "").strip().rstrip("/")
    cleaned = re.sub(r"/rest/v1/?$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.rstrip("/")
```

**Also:** pinned `postgrest==0.19.3` in `requirements.txt` for reproducible Docker builds.

---

## Git & Deploy

| Step | Status |
|------|--------|
| Commit | `bf97861` on `main` |
| Push | https://github.com/AmoghRaidurg/agro-fair-chain |
| Render | Auto-deploy on push (Docker rebuild) |

---

## Post-Deploy Verification

**Verified:** 2026-06-25T19:52Z (after Render auto-deploy of `bf97861`)

| Endpoint | Expected | Result |
|----------|----------|--------|
| `GET /health` | 200 | **200** (~831 ms) |
| `GET /api/intelligence/farmer/dashboard` | 200 | **200** (~10.5 s) — `live_data: true`, `commerce_ready: true` |
| `GET /api/intelligence/trader/dashboard` | 200 | **200** (~11.7 s) — `live_data: true`, `commerce_ready: true` |
| `GET /api/intelligence/industrialist/dashboard` | 200 | **200** (~14.7 s) — `live_data: true`, `commerce_ready: true` |

### Pre-fix (baseline)

| Endpoint | Status |
|----------|--------|
| `/health` | 200 |
| `/api/intelligence/farmer/dashboard` | **500** PGRST125 |
| `/api/intelligence/trader/dashboard` | **500** PGRST125 |
| `/api/intelligence/industrialist/dashboard` | **500** PGRST125 |

---

## Optional Render Dashboard Cleanup

After deploy, you may simplify Render env to match local:

```
SUPABASE_URL=https://aosnytcfcazlaolozehx.supabase.co
```

The code fix tolerates either format.

---

## Recommendation

**APPROVE** — URL normalization is the correct minimal fix. No changes to `commerce_queries.py` query logic were required.
