# AgroElevate AI Audit Report

**Date:** 2026-06-24  
**Scope:** `ai-service/` FastAPI, intelligence dashboards, copilot, predictions

---

## Architecture

| Component | Technology | Status |
|-----------|------------|--------|
| AI API | FastAPI (`ai-service/`) | ✅ Operational locally |
| Web client | `src/lib/aiApi.ts` → `VITE_AI_API_URL` | ✅ |
| Models | Rule-based (no external LLM) | ✅ Deterministic |
| Persistence | Supabase tables via `persistence.py` | ✅ |

---

## Issue: Misleading Income Predictions

### Before

- `build_user_revenue_baseline` defaulted to **₹120,000** when no history
- Income forecaster showed optimistic/realistic/conservative scenarios for new users
- Charts displayed fabricated growth curves

### After

| Layer | Fix |
|-------|-----|
| `feature_engineering.py` | Baseline = 0 when no transactions |
| `income_forecaster.py` | Single row with `insufficient_data: true`, confidence 0.15 |
| `intelligence_service.py` | `income_insufficient_data` boolean in payload |
| `FarmerInsights.tsx` | Dashed empty state; charts hidden |

**Assessment:** Farmer predictions are now grounded. Trader/Industrialist dashboards should receive the same UI treatment (backend already returns flag).

---

## Confidence Levels

| Signal | Implementation |
|--------|----------------|
| Horizon decay | `CONFIDENCE_BY_HORIZON`: 1yr=0.88 → 10yr=0.50 |
| Scenario adjustment | Realistic highest; optimistic/conservative ×0.85 |
| History boost | Up to +0.12 from baseline volume |
| Insufficient data | Fixed at 0.15 confidence |
| Crop recommendations | `confidence_score`, `risk_score`, `suitability_score` bars |

---

## Copilot Audit

### Role-Aware Behavior

| Role | Context Used |
|------|--------------|
| **Farmer** | Location parsing, season, crop recommendations, acres, profit/risk intents |
| **Trader** | Procurement volume from order_items; royalty/margin guidance |
| **Industrialist** | Manufacturing batch guidance; deferred royalty explanation |
| **Customer** | Marketplace + wallet tips; no royalty obligations |

### Dynamic Inputs

| Input | Status |
|-------|--------|
| User role | ✅ |
| Location (address / message) | ✅ India geo parser |
| Marketplace data | ✅ Via `load_marketplace_data()` |
| User activity (orders) | ✅ Trader procurement volume |
| Product availability | ✅ Demand intelligence snapshot |
| Transaction history | ✅ Income baseline |
| Weather | ❌ Not integrated |

### Sample Intents (Farmer)

- `grow_recommendation` — top 3 crops for season/region
- `highest_profit` / `lowest_risk` — ranked recommendations
- `location` — district/state parsing
- `acres` — yield estimates
- `season_info` — kharif/rabi/zaid crops

---

## Demand & Market Intelligence

- `generate_demand_intelligence` — crop demand scores, trends, trader/industrialist activity kg
- `predict_markets` — region-aware price bands
- `trader_intelligence` / `industrialist_intelligence` — role-specific dashboards

Uses synthetic marketplace data flag (`use_synthetic`) with reduced growth multiplier.

---

## Insight Generator

- Generates prioritized insights from recommendations, market predictions, income
- Persisted to Supabase for audit trail

---

## API Endpoints (Key)

| Endpoint | Purpose |
|----------|---------|
| `GET /intelligence/farmer/{user_id}` | Farmer dashboard |
| `GET /intelligence/trader/{user_id}` | Trader dashboard |
| `GET /intelligence/industrialist/{user_id}` | Industrialist dashboard |
| `POST /copilot` | Chat assistant |

---

## Gaps & Risks

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| No weather API | Low | Integrate OpenWeather or IMD proxy |
| Trader/ind insufficient-data UI | Medium | Mirror FarmerInsights pattern |
| AI service not co-deployed with web | Medium | Set `VITE_AI_API_URL` in production |
| No LLM for free-form Q&A | Low | By design; rule-based is predictable |
| Copilot customer early-return skips farmer logic | Low | Intentional |

---

## AI Credibility Score

| Metric | Before | After |
|--------|--------|-------|
| Income prediction honesty | 3/10 | **9/10** |
| Role context | 5/10 | **8/10** |
| Confidence transparency | 6/10 | **8/10** |
| **Overall AI trust** | **5/10** | **8/10** |

---

## Deployment Checklist

- [ ] Deploy `ai-service` to production host
- [ ] Set `VITE_AI_API_URL` in web `.env`
- [ ] Verify CORS allows web origin
- [ ] Confirm Supabase service credentials for data loader
