# AgroElevate AI Audit Report

**Audit date:** 2025-06-24  
**Scope:** Phase B implementation (pre–Phase C baseline) and Phase C upgrade delta  
**Model version:** v1 → **v2**

---

## 1. Executive Summary

The original Phase B AI stack delivered a working intelligence overlay using **Scikit-Learn**, **synthetic agricultural baselines**, and **minimal marketplace signal**. It was suitable for proof-of-concept but **not demo-grade** for a final-year project claiming India-focused agricultural intelligence.

Phase C addresses the largest gaps: **geo-awareness**, **multi-scenario forecasting**, **transaction-weighted demand**, and a **rule-based copilot** — still without paid APIs or LLMs.

| Area | Phase B (v1) | Phase C (v2) |
|------|--------------|--------------|
| Geo intelligence | Generic "India" string | State + district parsing, suitability matrices |
| Crop scores | Single profitability + risk | Suitability, profitability, risk, yield, demand |
| Income forecast | Single growth curve | Optimistic / realistic / conservative + CAGR + profit |
| Demand | Synthetic-heavy demand score | Trader + industrialist activity weighting |
| Copilot | None | Rule-based conversational advisor |
| Trader / Industrialist | Basic rankings | Buy opportunities, health score, risk alerts |

---

## 2. Existing Models (Phase B v1)

| Model | File | Algorithm | Output |
|-------|------|-----------|--------|
| Crop recommender | `crop_recommender.py` | RandomForestRegressor (50 trees) + weighted scoring | Top 5 crops |
| Market predictor | `market_predictor.py` | LinearRegression on synthetic demand proxy | Demand score, price range |
| Income forecaster | `income_forecaster.py` | Compound growth by role | 4 horizons, single scenario |
| Insight generator | `insight_generator.py` | Rule templates | Up to 8 insights |
| Trader intel | `trader_intel.py` | Heuristic margin ranking | Profit + inventory hints |
| Industrialist intel | `industrialist_intel.py` | Aggregation heuristics | Procurement + suppliers |

---

## 3. Features Used (v1)

| Feature | Source | Usage |
|---------|--------|-------|
| `demand_index` | Synthetic CSV | Base demand per crop |
| `avg_price`, `volatility` | Synthetic CSV | Price & risk |
| `season_fit` | Synthetic CSV | Seasonal suitability |
| `marketplace_qty`, `marketplace_orders` | `order_items` | Demand boost (if ≥8 rows) |
| `listing_qty`, `supply_pressure` | `products` | Oversupply signal |
| `profiles.address` | Supabase | Location string (unparsed) |

**Not used in v1:** `buyer_role`, district, state, trader vs industrialist volume split, temporal order trends.

---

## 4. Training Data

| Dataset | Rows | Role |
|---------|------|------|
| `synthetic_ag_market.csv` | 2,160 | Primary when marketplace sparse |
| `order_items` + `orders` | Production (variable) | Boost only if ≥8 line items |
| `products` | Production | Listing quantity & price |

**Training approach:** On-demand fit per `/refresh` request (not batch offline training). RandomForest and LinearRegression train on engineered features at request time — acceptable for demo scale, not production ML ops.

---

## 5. Synthetic Assumptions

| Assumption | Impact |
|------------|--------|
| Marketplace &lt; 8 rows → full synthetic blend | Most student/demo DBs show synthetic badge |
| 12-crop catalog fixed | Missing regional specialty crops |
| National yield averages in synthetic generator | Not district-calibrated in v1 |
| Growth rates hardcoded by role (12% farmer, 18% trader) | Income forecast not evidence-based |
| LinearRegression trained on 4 synthetic history points | Demand projection not statistically robust |
| Location = raw address string | No Pune vs Punjab differentiation in v1 |

---

## 6. Weaknesses (v1)

| # | Weakness | Severity |
|---|----------|----------|
| 1 | Heavy synthetic dependence | High |
| 2 | No state/district crop suitability | High |
| 3 | Single-scenario income forecast | Medium |
| 4 | No conversational interface | Medium |
| 5 | Trader/industrialist activity ignored in demand | Medium |
| 6 | No CAGR / profit separation | Medium |
| 7 | Copilot absent — poor demo narrative | High |
| 8 | JWT not validated on AI API | Medium (security) |
| 9 | DB schema lacks suitability/yield columns | Low (API-only fields OK) |
| 10 | No external government price data | Expected (budget constraint) |

---

## 7. Improvement Opportunities → Phase C Status

| Opportunity | Phase C implementation |
|-------------|------------------------|
| India geo layer | ✅ `india_geo.py` — 14 states, 70+ districts, crop-state suitability |
| Kharif/Rabi/Zaid boosts | ✅ `SEASON_CROP_BOOST` + season-aware scoring |
| Multi-scenario income | ✅ Optimistic / realistic / conservative × 4 horizons |
| Demand from transactions | ✅ `demand_intelligence.py` — buyer_role weighted |
| AI Copilot | ✅ `copilot.py` — rule-based, no OpenAI |
| Trader buy opportunities | ✅ `best_buy_opportunities`, `demand_alerts` |
| Industrialist supply risk | ✅ `supply_risk_alerts`, reliability sub-scores |
| UI polish (intelligence only) | ✅ Cards, trends, confidence bars, tabs |
| External data (AGMARKNET, IMD) | 📋 Documented in `INDIA_DATA_INTEGRATION_PLAN.md` |

---

## 8. Phase C Model Inventory (v2)

| Component | File | Enhancement |
|-----------|------|-------------|
| Geo parser | `india_geo.py` | District/state/region resolution |
| Demand intelligence | `demand_intelligence.py` | Per-crop demand + price trends + role activity |
| Crop recommender | `crop_recommender.py` | 7 features incl. state/district fit, yield quintals |
| Income forecaster | `income_forecaster.py` | 12 rows (3 scenarios × 4 horizons), CAGR, profit |
| Copilot | `copilot.py` | Intent detection + engine integration |
| Trader intel | `trader_intel.py` | Buy score, inventory health, alerts |
| Industrialist intel | `industrialist_intel.py` | Planning, reliability, cost scenarios |

---

## 9. Residual Risks (post–Phase C)

1. Still blends synthetic data when marketplace is sparse  
2. Government mandi prices not yet integrated  
3. Weather (IMD) not integrated  
4. Copilot is rule-based — limited natural language flexibility  
5. Service role key required for Supabase persistence  

---

*Audit complete — Phase C upgrades implemented in model version v2.*
