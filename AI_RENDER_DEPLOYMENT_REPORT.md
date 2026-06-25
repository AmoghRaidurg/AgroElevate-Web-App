# AgroElevate AI Service — Render Deployment Report

**Date:** 2026-06-25  
**Status:** ⏸️ **Awaiting Render Blueprint deploy** (config pushed to GitHub)

---

## Pre-Deployment Work Completed

### Step 1 — Deployment files verified

| File | Status | Notes |
|------|--------|-------|
| `ai-service/Dockerfile` | Production-ready | Python 3.12-slim, multi-stage deps, ships `app/`, `data/`, `scripts/` |
| `ai-service/requirements.txt` | Production-ready | FastAPI, Uvicorn, pandas, scikit-learn, supabase |
| `ai-service/render.yaml` | Updated | CORS fixed for live Vercel URL |
| `render.yaml` (repo root) | **Added** | Default Blueprint path for Render |

### Step 2 — Render configuration

| Setting | Value |
|---------|-------|
| **Runtime** | Docker |
| **Dockerfile** | `./ai-service/Dockerfile` |
| **Context** | `./ai-service` |
| **Build command** | Docker build (automatic) |
| **Start command** | `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| **Python version** | 3.12 |
| **Port** | `8000` (Render injects `PORT`) |
| **Health check** | `GET /health` |
| **Plan** | `free` |

### Deployment-only fixes applied (no AI logic changes)

1. **`ALLOWED_ORIGINS`** — added `https://agro-fair-chain.vercel.app`
2. **Dockerfile `CMD`** — explicit shell form for reliable `${PORT}` expansion on Render
3. **Root `render.yaml`** — added for one-click Blueprint (no custom path needed)

### Git commits pushed

- `4f2e2bb` — CORS + PORT binding fixes
- `5e85401` — root `render.yaml`

**Repository:** https://github.com/AmoghRaidurg/agro-fair-chain  
**Branch:** `main`

---

## Step 3 — Environment Variables (names only)

Set these in Render when prompted:

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Dashboard → Settings → API → service_role |
| `ALLOWED_ORIGINS` | Pre-set in blueprint | Includes Vercel + localhost |
| `PORT` | Pre-set | `8000` |

**Never set on Vercel frontend:** `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 5 — Render Dashboard Instructions (MANUAL)

### 1. Open Render

Go to: https://dashboard.render.com

### 2. Click

**New +** (top right) → **Blueprint**

### 3. Connect repository

- **Git provider:** GitHub
- **Repository:** `AmoghRaidurg/agro-fair-chain`
- If GitHub is not connected, click **Connect GitHub** and authorize Render

### 4. Blueprint settings

| Field | Value |
|-------|-------|
| **Blueprint name** | `agroelevate-ai` (or any name) |
| **Branch** | `main` |
| **Blueprint path** | `render.yaml` (default — at repo root) |

### 5. Environment variables (paste when prompted)

| Name | Where to get value |
|------|-------------------|
| `SUPABASE_URL` | Your local `.env` → `VITE_SUPABASE_URL` (same URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → **service_role** key |

`ALLOWED_ORIGINS` and `PORT` are pre-filled from `render.yaml`.

### 6. Click

**Deploy Blueprint**

### 7. Wait

First deploy takes **5–15 minutes** (Docker build + free tier cold start).

### 8. Note your service URL

Expected: **https://agroelevate-ai.onrender.com**  
(Render may assign a slightly different hostname — copy from the service **Settings** page.)

---

## Step 6–9 — Automated follow-up (after you deploy)

Once `/health` returns 200, the following will run automatically:

1. Verify all AI endpoints (`/health`, dashboards, copilot)
2. Update `VITE_AI_API_URL` on Vercel → redeploy frontend
3. Smoke-test https://agro-fair-chain.vercel.app intelligence features
4. Finalize this report with live results

---

## Current Production Status

| Check | Result |
|-------|--------|
| `https://agroelevate-ai.onrender.com/health` | **404** (not deployed yet) |
| Vercel `VITE_AI_API_URL` | Set to Render URL (from prior deploy) |
| Local AI service | Working (`localhost:8000`) |

---

## Verification Checklist (pending)

- [ ] `GET /health` → 200
- [ ] Farmer dashboard → 200
- [ ] Trader dashboard → 200
- [ ] Industrialist dashboard → 200
- [ ] Copilot POST → 200
- [ ] Vercel redeploy with live AI URL
- [ ] Live site AI dashboard online
- [ ] No CORS errors

---

## Remaining Issues

1. **Render service not created yet** — requires Blueprint deploy (steps above)
2. **First request on free tier** — may take 30–60s cold start
3. **Supabase keys** — rotate if ever exposed in git history

---

*Reply **"Render deployed"** when Blueprint deploy finishes, or paste your Render service URL.*
