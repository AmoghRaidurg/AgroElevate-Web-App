# Market Intelligence Implementation Guide

## Quick Start

### 1. Generate Dataset
```bash
cd ai-service && python scripts/generate_market_dataset.py
```

### 2. Start AI Service
```bash
cd ai-service && uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend
```bash
npm run dev
```

### 4. Apply Database Migration (Production)
```bash
npm run commerce:apply-migration supabase/migrations/production/20250628100021_market_intelligence_schema.sql
```

## Frontend Routes

| Route | Role | Page |
|-------|------|------|
| `/market-intelligence` | farmer/trader/industrialist | Role dashboard |
| `/admin/market-intelligence` | admin | Monitor |

## Smart Price Assistant

Integrated in `Marketplace.tsx` → List Produce form.
- Triggers on crop name input (debounced 400ms)
- Shows mandi price, AgroElevate average, suggested price
- Pre-fills price input with AI suggestion

## Testing

```bash
# Python unit tests
python ai-service/scripts/test_market_intelligence.py

# API integration
npm run market:verify

# Commerce regression (unchanged)
npm run commerce:verify

# AI health (commerce, unchanged)
npm run ai:verify

# Build
npm run build
```

## Deployment

### Vercel (Frontend)
No new env vars required. Uses existing `VITE_AI_API_URL`.

### Render (AI Service)
Dataset CSVs included in Docker image via `COPY data ./data`.
Redeploy triggers automatic rebuild with market data.

## Regression Safety

Market Intelligence is fully isolated:
- No changes to `intelligence_service.py` commerce logic
- No changes to wallet, royalty, manufacturing, orders
- New router mounted additively in `main.py`
