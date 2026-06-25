# AgroElevate

**Fair-chain agricultural commerce platform** — connecting farmers, traders, industrialists, and customers with transparent royalties, wallet payments, AI intelligence, and role-based dashboards.

Release candidate: **v1.0.0-rc**

---

## Features

| Area | Capabilities |
|------|----------------|
| **Roles** | Farmer, Trader (middleman), Industrialist, Customer, Admin |
| **Marketplace** | Product listings, cart, checkout, royalty-aware pricing |
| **Wallet** | Balance, Razorpay top-up via Supabase Edge Functions |
| **Royalty** | Option B — 12.5% farmer royalty on marketplace sales (verified) |
| **Orders** | Full order lifecycle with status tracking |
| **Analytics** | Role dashboards, supply-chain value charts, income projections |
| **AI Intelligence** | Crop recommendations, market forecasts, Copilot, demand intelligence |
| **Admin** | User management, payment oversight |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React + Vite   │────▶│  Supabase        │────▶│  PostgreSQL     │
│  (Vercel)       │     │  Auth + RLS +    │     │  + RPCs         │
│                 │     │  Edge Functions  │     │                 │
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

Detailed architecture docs: [`docs/architecture/`](docs/architecture/)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | TanStack Query, React Context (auth, theme, AI health) |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Payments | Razorpay (server-side via Edge Functions) |
| AI | Python FastAPI (`ai-service/`) |
| Charts | Recharts |

---

## Installation

**Prerequisites:** Node.js 18+, npm, Supabase project, AI service (optional for local AI)

```bash
git clone <YOUR_REPO_URL>
cd agro-fair-chain
npm install
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm run dev
```

Dev server: [http://localhost:8080](http://localhost:8080)

---

## Environment Variables

### Frontend (`.env` — Vite `VITE_*` only)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_AI_API_URL` | Yes | AI service base URL (e.g. `http://localhost:8000`) |

See [`.env.example`](.env.example) for placeholders. **Never commit `.env`.**

### Server-side (not in Vercel frontend)

- **Supabase Edge Function secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **AI service:** see [`ai-service/.env.example`](ai-service/.env.example)
- **CI/scripts only:** `SUPABASE_SERVICE_ROLE_KEY` (commerce verify harness)

---

## Running Locally

```bash
# Frontend
npm run dev

# AI service (separate terminal)
cd ai-service
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Verify commerce RPCs (requires service role in local .env)
npm run commerce:verify

# Verify AI health
npm run ai:verify
```

---

## AI Service

The FastAPI service in [`ai-service/`](ai-service/) provides:

- Crop recommendations and market predictions
- Income forecasting and demand intelligence
- Role-specific Copilot endpoints
- Weather-enriched analytics

Deploy separately (Docker / Render). See [`ai-service/DEPLOYMENT.md`](ai-service/DEPLOYMENT.md) and [`docs/architecture/AI_DEPLOYMENT_REPORT.md`](docs/architecture/AI_DEPLOYMENT_REPORT.md).

---

## Supabase

Migrations live in [`supabase/migrations/production/`](supabase/migrations/production/). Edge Functions:

- `razorpay-create-order`
- `razorpay-webhook`

Apply migrations via Supabase CLI or Dashboard. See [`docs/deployment/APPLY_GUIDE.md`](docs/deployment/APPLY_GUIDE.md).

---

## Deployment

| Target | Guide |
|--------|-------|
| **Vercel (frontend)** | [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) |
| **Full stack** | [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) |
| **Pre-release checklist** | [`RELEASE_READY_CHECKLIST.md`](RELEASE_READY_CHECKLIST.md) |

```bash
npm run build   # output: dist/
```

---

## Folder Structure

```
agro-fair-chain/
├── src/                 # React application
│   ├── components/      # UI, charts, marketplace, auth
│   ├── hooks/           # useAuth, useTheme, useAiService
│   ├── lib/             # Supabase client, AI API, chart data
│   └── pages/           # Routes (Dashboard, Marketplace, Wallet, …)
├── public/              # Static assets
├── supabase/            # Migrations + Edge Functions
├── ai-service/          # FastAPI AI microservice
├── scripts/             # Commerce verify, smoke tests
├── docs/
│   ├── architecture/    # System design docs
│   ├── api/             # Integration guides
│   ├── deployment/      # Apply guides, test manuals
│   └── internal/        # Dev reports (optional, not for production)
├── vercel.json          # SPA routing for Vercel
├── .env.example         # Frontend env template
└── package.json
```

---

## Screenshots

> Add production screenshots to `docs/screenshots/` before public launch.

| Screen | Path |
|--------|------|
| Landing | `docs/screenshots/landing.png` |
| Dashboard | `docs/screenshots/dashboard.png` |
| Marketplace | `docs/screenshots/marketplace.png` |
| Wallet | `docs/screenshots/wallet.png` |

---

## License

Proprietary — AgroElevate academic / commercial project. Update with your institution or organization license before open-sourcing.

---

## Contributors

AgroElevate development team — BE final year project.

---

## Future Scope

- Native Android app with Razorpay SDK ([`docs/api/ANDROID_RAZORPAY_INTEGRATION.md`](docs/api/ANDROID_RAZORPAY_INTEGRATION.md))
- Live weather and mandi price feeds
- Multi-language support
- Advanced supply-chain traceability

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run commerce:verify` | 26-point commerce RPC verification |
| `npm run ai:verify` | AI service health check |
| `npm run lint` | ESLint |
