# AgroElevate Web App

**Fair-chain agricultural commerce platform** connecting farmers, traders, industrialists, and customers through transparent royalties, digital wallets, AI intelligence, and role-based dashboards.

[![Release](https://img.shields.io/badge/release-v1.0.0--rc-blue)](https://github.com/AmoghRaidurg/AgroElevate-Web-App)
[![Web](https://img.shields.io/badge/web-Vercel-black)](https://agro-fair-chain.vercel.app)
[![AI](https://img.shields.io/badge/AI-Render-green)](https://agroelevate-ai.onrender.com/health)

---

## Description

AgroElevate is a production-ready **multi-role agricultural marketplace** that tracks produce from farm to processed product. The platform enforces **12.5% farmer royalty** on marketplace sales, supports **Razorpay wallet top-ups**, and provides **live AI analytics** grounded in full commerce history — no synthetic data, no deployment cutoff.

Verified end-to-end flows include farmer listing → trader purchase → relist → industrialist procurement → manufacturing → processed product sale → royalty settlement.

---

## Features

| Area | Capabilities |
|------|----------------|
| **Multi-role auth** | Farmer, Trader, Industrialist, Customer, Admin |
| **Marketplace** | Listings, cart, checkout, inventory, ownership chain metadata |
| **Wallet** | Balance, Razorpay deposit, purchase debit, sale credit, transfers |
| **Royalty** | 12.5% farmer royalty + deferred industrialist obligations |
| **Orders** | Full lifecycle with `checkout_order` RPC |
| **Manufacturing** | Procurement batches, processing queue, marketplace listing |
| **Analytics** | Role dashboards, supply-chain charts, income projections |
| **Admin** | User management, payment oversight |

---

## AI Intelligence

The FastAPI service (`ai-service/`) provides read-only analytics over live Supabase commerce data:

- **Crop recommendations** — district-aware, history-grounded
- **Income forecasting** — monthly trends from wallet + order data
- **Demand intelligence** — crop-level demand signals
- **Market predictions** — price and volume outlook
- **Role dashboards** — farmer, trader, industrialist with `commerce_totals`
- **Copilot** — semantic TF-IDF intent classification with commerce-grounded replies

**Model version:** `v3-commerce` · **API version:** `1.0.0-rc`

```
GET /health
GET /api/intelligence/{role}/dashboard?user_id=...
POST /api/intelligence/copilot
```

---

## Wallet System

- Razorpay integration via Supabase Edge Functions (`razorpay-create-order`, `razorpay-webhook`)
- `wallet_history` as primary audit trail
- `get_wallet_balance` RPC with balance sync
- Client-side `add_funds` blocked — deposits via Razorpay only
- Demo credit excluded from AI revenue baselines

---

## Royalty Distribution

**Option B — 12.5% farmer royalty** on marketplace sales:

1. **Direct sale** (farmer → trader/customer): immediate royalty transfer at checkout
2. **Trader relist**: `originalFarmerId` preserved in product metadata
3. **Industrialist procurement**: deferred royalty obligation linked to manufacturing batch
4. **Processed product sale**: royalty settled to original farmer on customer purchase

---

## Manufacturing Workflow

```
Farmer lists crop
  → Trader purchases (checkout_order)
  → Trader relists with originalFarmerId
  → Industrialist purchases trader listing
  → manufacturing_batch auto-created (draft)
  → complete_manufacturing_batch → processed_products
  → list_processed_product → Customer purchases
  → Royalty settled, inventory decremented
```

RPCs: `sync_industrialist_procurement_batches`, `complete_manufacturing_batch`, `list_processed_product`, `get_my_manufacturing_batches`

---

## Android + Web Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                             │
│  React SPA (Vercel)          │  Android (planned — Kotlin thin client)│
└───────────────┬──────────────┴──────────────────┬───────────────────┘
                │ Supabase JWT                     │
                ▼                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  SUPABASE — Auth · PostgreSQL + RLS · RPCs · Edge Functions           │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ Razorpay (server-side)
┌───────────────────────────────┴───────────────────────────────────────┐
│  AI SERVICE (Render) — FastAPI read-only analytics + Copilot            │
└───────────────────────────────────────────────────────────────────────┘
```

- **Web** is the primary client (React + Vite + TypeScript)
- **Android** — API-compatible via Supabase Kotlin SDK; documented in [`docs/api/ANDROID_RAZORPAY_INTEGRATION.md`](docs/api/ANDROID_RAZORPAY_INTEGRATION.md) and [`ANDROID_BACKEND_ANALYSIS.md`](ANDROID_BACKEND_ANALYSIS.md)
- No native Android module in this repository yet

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | TanStack Query, React Context |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Payments | Razorpay (server-side via Edge Functions) |
| AI | Python 3.12, FastAPI, pandas, scikit-learn |
| Charts | Recharts |
| Deploy | Vercel (web), Render (AI), Docker |

---

## Deployment URLs

| Service | URL |
|---------|-----|
| **Web (production)** | https://agro-fair-chain.vercel.app |
| **AI service** | https://agroelevate-ai.onrender.com |
| **AI health** | https://agroelevate-ai.onrender.com/health |
| **Supabase** | Project `aosnytcfcazlaolozehx` |

---

## Screenshots

> Add production screenshots to `docs/screenshots/` before public launch.

| Screen | Path |
|--------|------|
| Landing | `docs/screenshots/landing.png` |
| Dashboard | `docs/screenshots/dashboard.png` |
| Marketplace | `docs/screenshots/marketplace.png` |
| Wallet | `docs/screenshots/wallet.png` |
| AI Copilot | `docs/screenshots/copilot.png` |
| Manufacturing | `docs/screenshots/manufacturing.png` |

---

## Installation

**Prerequisites:** Node.js 18+, npm, Python 3.12+ (for AI), Supabase project

```bash
git clone https://github.com/AmoghRaidurg/AgroElevate-Web-App.git
cd AgroElevate-Web-App
npm install
cp .env.example .env
# Edit .env with Supabase URL and anon key
npm run dev
```

Dev server: [http://localhost:8080](http://localhost:8080)

---

## Environment Variables

### Frontend (`.env` — `VITE_*` only, safe for browser)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | `https://<project>.supabase.co` (no `/rest/v1`) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_AI_API_URL` | Yes | AI service URL (e.g. `https://agroelevate-ai.onrender.com`) |

See [`.env.example`](.env.example). **Never commit `.env`.**

### Server-side only (never in Vercel frontend)

| Variable | Where |
|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | AI service (Render), CI scripts |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Supabase Edge Function secrets |
| `RAZORPAY_WEBHOOK_SECRET` | Supabase Edge Function secrets |
| `ALLOWED_ORIGINS` | AI service CORS |

---

## Running Locally

```bash
# Frontend
npm run dev

# AI service (separate terminal)
cd ai-service
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Verify
npm run commerce:verify    # 26-point commerce RPC check
npm run ai:verify          # AI health check
```

---

## Production Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React + Vite   │────▶│  Supabase        │────▶│  PostgreSQL     │
│  (Vercel)       │     │  Auth + RLS +    │     │  + 20 migrations│
│                 │     │  Edge Functions  │     │  + RPCs         │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │              Razorpay (wallet)
         ▼
┌─────────────────┐
│  FastAPI        │
│  AI Service     │
│  (Render/Docker)│
└─────────────────┘
```

**Key deployment files:**

| File | Purpose |
|------|---------|
| `vercel.json` | SPA routing, Vercel build |
| `render.yaml` | Render Blueprint (AI service) |
| `ai-service/Dockerfile` | Docker image for AI |
| `ai-service/requirements.txt` | Python dependencies |
| `supabase/migrations/production/` | Database migrations (001–020) |

Guides: [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) · [`ai-service/DEPLOYMENT.md`](ai-service/DEPLOYMENT.md)

---

## Future Scope

- Native Android app (Kotlin + Supabase SDK + Razorpay Android SDK)
- Live mandi price and weather API feeds
- Multi-language UI (Hindi, Marathi)
- Push notifications for orders and royalties
- Supply-chain QR traceability
- AI persistence schema alignment (`district`, `cagr`, `demand_trend` columns)

---

## Contributors

**AgroElevate Development Team** — BE Final Year Project

| Role | Contribution |
|------|--------------|
| Full-stack | React web app, Supabase schema, RPCs |
| AI / ML | FastAPI intelligence service, Copilot |
| DevOps | Vercel, Render, Docker, CI verification |

---

## License

Proprietary — AgroElevate academic / commercial project.  
Update with your institution or organization license before open-sourcing.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build → `dist/` |
| `npm run commerce:verify` | 26-point commerce RPC verification |
| `npm run ai:verify` | AI service health check |
| `npm run lint` | ESLint |

---

## Repository

- **Primary:** https://github.com/AmoghRaidurg/AgroElevate-Web-App
- **Archive:** https://github.com/AmoghRaidurg/agro-fair-chain (backup, unchanged)

<!-- Deployment test -->
