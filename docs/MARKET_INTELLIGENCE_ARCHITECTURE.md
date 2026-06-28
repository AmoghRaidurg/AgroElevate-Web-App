# Market Intelligence Architecture

## Overview

Market Intelligence is an **independent microservice module** within AgroElevate, completely separate from Commerce Intelligence.

| Module | Data Source | Purpose |
|--------|-------------|---------|
| Commerce Intelligence | AgroElevate transactions | My sales, wallet, orders, marketplace analytics |
| Market Intelligence | Indian government mandi data | Live prices, MSP, forecasts, regional comparison |

## Architecture Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React SPA  │────▶│  FastAPI AI Svc  │────▶│  Market Data Store  │
│  (Vercel)   │     │  /api/market-*   │     │  CSV + 6hr Cache      │
└─────────────┘     └──────────────────┘     └─────────────────────┘
       │                     │                         │
       │                     ▼                         ▼
       │            ┌──────────────────┐     ┌─────────────────────┐
       └───────────▶│  Supabase (MI)   │     │  Provider Layer     │
                    │  market_* tables │     │  AGMARKNET/eNAM/Gov  │
                    └──────────────────┘     └─────────────────────┘
```

## Components

### Backend (`ai-service/app/market_intelligence/`)
- `data_store.py` — Singleton store with 6-hour TTL cache
- `providers/base.py` — `MarketDataProvider` abstraction
- `models/price_engine.py` — Pricing algorithm, benchmark, recommendations
- `service.py` — Role dashboards (farmer/trader/industrialist/admin)
- `routers/market_intelligence.py` — REST API

### Frontend (`src/pages/market-intelligence/`)
- `MarketIntelligenceHub.tsx` — Role router
- `FarmerMarketIntelligence.tsx` — 9-tab farmer dashboard
- `TraderMarketIntelligence.tsx` — Procurement analytics
- `IndustrialistMarketIntelligence.tsx` — Raw material intelligence
- `AdminMarketMonitor.tsx` — Sync monitor

### Extension (Phase 2.1)
- `SmartPriceAssistant.tsx` — Marketplace listing price guidance
- `LocationSelector.tsx` — GPS + manual state/district
- Benchmark comparison model

## Data Flow

1. User opens Market Intelligence → browser requests GPS
2. Reverse geocode → state + district
3. Frontend calls `/api/market-intelligence/farmer/dashboard`
4. Backend loads cached dataset, applies location filters
5. AI engine computes suggestions from live mandi + AgroElevate averages
6. Response rendered in tabbed dashboard

## Caching

```
Government Dataset → Normalize → Validate → Store Cache (6hr) → Frontend
```

Manual refresh: `POST /api/market-intelligence/refresh`

## Safety

- Zero modifications to commerce tables, wallet RPCs, royalty logic
- Separate API prefix `/api/market-intelligence`
- Separate sidebar navigation item
- Commerce Intelligence routes unchanged
