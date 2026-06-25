const AI_BASE = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = 15_000;

export type AiServiceStatus = 'checking' | 'online' | 'offline' | 'unknown';

export function getAiBaseUrl() {
  return AI_BASE;
}

export class AiServiceError extends Error {
  readonly offline: boolean;
  constructor(message: string, offline = false) {
    super(message);
    this.name = 'AiServiceError';
    this.offline = offline;
  }
}

export interface CropRecommendation {
  crop_name: string;
  rank: number;
  suitability_score?: number;
  profitability_score?: number;
  risk_score: number;
  confidence_score: number;
  expected_profitability: number;
  expected_yield_quintals?: number;
  expected_yield_quintals_per_acre?: number;
  expected_demand?: number;
  explanation?: string;
  state?: string;
  district?: string | null;
  region?: string;
  season?: string;
  month?: number;
}

export interface MarketPrediction {
  crop_name: string;
  demand_score: number;
  trend: 'rising' | 'stable' | 'falling';
  demand_trend?: string;
  price_trend?: string;
  price_min: number;
  price_max: number;
  demand_confidence: number;
  market_confidence?: number;
  price_confidence?: number;
  insufficient_data?: boolean;
  trader_activity_kg?: number;
  industrialist_activity_kg?: number;
}

export interface DemandIntelligence {
  crop_name: string;
  demand_score: number;
  demand_trend: string;
  price_trend: string;
  current_price: number;
  projected_price: number;
  market_confidence: number;
  trader_activity_kg: number;
  industrialist_activity_kg: number;
  marketplace_volume_kg: number;
}

export interface IncomeForecast {
  horizon_years: number;
  forecast_year: number;
  scenario?: string;
  scenario_label?: string;
  projected_revenue: number;
  projected_profit?: number;
  baseline_revenue: number;
  growth_rate: number;
  cagr?: number;
  profit_margin?: number;
  confidence_score: number;
}

export interface UserInsight {
  insight_type: string;
  title: string;
  message: string;
  priority: string;
  crop_name?: string | null;
  confidence_score?: number;
}

export interface GeoContext {
  state: string;
  district: string | null;
  region: string;
}

export interface DistrictAnalytics {
  state: string;
  district: string | null;
  region: string;
  active_listings: number;
  avg_marketplace_price: number;
  top_crops: Array<{ crop_name: string; avg_price?: number; listings?: number; available_kg?: number; demand_score?: number }>;
  data_confidence: number;
}

export interface SeasonalAnalytics {
  season: string;
  month: number;
  recommended_crops: Array<{ crop_name: string; season_fit: number }>;
  planting_window: string;
  confidence: number;
}

export interface HistoricalTrend {
  crop_name: string;
  latest_month: string;
  volume_kg: number;
  volume_change_kg: number;
  avg_price: number;
  price_change: number;
  trend: string;
  confidence: number;
}

export interface WeatherSummary {
  temperature_c: number | null;
  precipitation_mm: number;
  rain_probability_pct: number;
  farming_note: string;
  source: string;
}

export interface FarmerDashboard {
  recommendations: CropRecommendation[];
  market_predictions: MarketPrediction[];
  demand_intelligence?: DemandIntelligence[];
  income_forecasts: IncomeForecast[];
  income_scenarios?: {
    optimistic: IncomeForecast[];
    realistic: IncomeForecast[];
    conservative: IncomeForecast[];
  };
  insights: UserInsight[];
  geo?: GeoContext;
  live_data?: boolean;
  commerce_ready?: boolean;
  commerce_baseline?: number;
  location?: string;
  income_insufficient_data?: boolean;
  demand_insufficient_data?: boolean;
  marketplace_insufficient_data?: boolean;
  district_analytics?: DistrictAnalytics;
  seasonal_analytics?: SeasonalAnalytics;
  historical_trends?: HistoricalTrend[];
  weather?: WeatherSummary | null;
  model_version?: string;
  _fallback?: boolean;
}

export interface TraderDashboard extends FarmerDashboard {
  trader?: {
    high_demand_crops: Array<{ crop_name: string; demand_score: number; avg_price: number }>;
    best_buy_opportunities?: Array<{
      crop_name: string;
      buy_score: number;
      current_price: number;
      projected_price: number;
      demand_trend: string;
      reason: string;
    }>;
    profit_opportunities: Array<{
      crop_name: string;
      profit_score: number;
      estimated_margin_pct: number;
      suggested_sell_price: number;
    }>;
    inventory_health?: { score: number; label: string };
    demand_alerts?: Array<{ crop_name: string; alert_type: string; message: string; priority: string }>;
    inventory_optimization: {
      current_kg: number;
      current_value: number;
      health_score?: number;
      health_label?: string;
      recommendations: Array<{ crop_name: string; action: string; reason: string }>;
    };
    regional_sourcing: Array<{ crop_name: string; recommended_region: string; demand_score: number }>;
    price_forecasts: Array<{ crop_name: string; current_price: number; forecast_3m: number; forecast_6m: number; trend: string; confidence?: number }>;
    future_price_prediction?: Array<{ crop_name: string; current_price: number; forecast_6m: number; trend: string }>;
  };
}

export interface IndustrialistDashboard extends FarmerDashboard {
  industrialist?: {
    procurement_forecast: Array<{
      crop_name: string;
      forecast_monthly_kg: number;
      expected_unit_cost: number;
      total_cost_estimate: number;
      demand_trend?: string;
      priority?: string;
    }>;
    procurement_planning?: Array<{
      crop_name: string;
      forecast_monthly_kg: number;
      expected_unit_cost: number;
      total_cost_estimate: number;
      priority?: string;
    }>;
    supplier_ranking: Array<{
      farmer_id: string;
      reliability_score: number;
      total_volume_kg: number;
      total_value: number;
      on_time_score?: number;
    }>;
    supply_risks: Array<{ crop_name: string; risk_level: string; risk_score: number; reason: string }>;
    supply_risk_alerts?: Array<{ crop_name: string; risk_level: string; risk_score: number; reason: string }>;
    cost_forecasting: {
      current_annual_spend: number;
      forecast_1y: number;
      forecast_3y: number;
      forecast_5y?: number;
      scenarios?: { optimistic: number; realistic: number; conservative: number };
      confidence: number;
    };
    future_cost_forecasting?: {
      current_annual_spend: number;
      forecast_1y: number;
      forecast_3y: number;
      confidence: number;
    };
    demand_planning: Array<{ crop_name: string; demand_score: number; avg_price: number }>;
    procurement_order_count?: number;
    procurement_item_count?: number;
    total_procurement_spend?: number;
  };
}

export interface CopilotResponse {
  reply: string;
  intent: string;
  context?: Record<string, unknown>;
  location?: GeoContext;
  season?: string;
  recommendations?: CropRecommendation[];
  suggestions?: string[];
}

async function aiFetch<T>(path: string, params: Record<string, string>, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${AI_BASE}${path}?${qs}`, {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AiServiceError(text || `AI API error ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AiServiceError('AI service request timed out', true);
    }
    throw new AiServiceError('AI service unavailable. Check VITE_AI_API_URL or start ai-service locally.', true);
  } finally {
    window.clearTimeout(timeout);
  }
}

function emptyDashboard(): FarmerDashboard {
  return {
    recommendations: [],
    market_predictions: [],
    demand_intelligence: [],
    income_forecasts: [],
    income_scenarios: { optimistic: [], realistic: [], conservative: [] },
    insights: [],
    income_insufficient_data: true,
    demand_insufficient_data: true,
    marketplace_insufficient_data: true,
    model_version: 'offline',
    _fallback: true,
  };
}

async function withFallback<T extends FarmerDashboard>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiServiceError && e.offline) {
      return emptyDashboard() as T;
    }
    throw e;
  }
}

export async function refreshIntelligence(userId: string, role: string, location?: string) {
  const params: Record<string, string> = { user_id: userId, role };
  if (location) params.location = location;
  return aiFetch<FarmerDashboard | TraderDashboard | IndustrialistDashboard>(
    '/api/intelligence/refresh', params, 'POST'
  );
}

export async function fetchFarmerDashboard(userId: string, location?: string) {
  const params: Record<string, string> = { user_id: userId };
  if (location) params.location = location;
  return withFallback(() => aiFetch<FarmerDashboard>('/api/intelligence/farmer/dashboard', params));
}

export async function fetchTraderDashboard(userId: string) {
  return withFallback(() => aiFetch<TraderDashboard>('/api/intelligence/trader/dashboard', { user_id: userId }));
}

export async function fetchIndustrialistDashboard(userId: string) {
  return withFallback(() => aiFetch<IndustrialistDashboard>('/api/intelligence/industrialist/dashboard', { user_id: userId }));
}

export async function sendCopilotMessage(
  userId: string,
  message: string,
  role: string,
  location?: string,
  context?: Record<string, unknown>
) {
  const params: Record<string, string> = { user_id: userId, role };
  if (location) params.location = location;
  try {
    return await aiFetch<CopilotResponse>('/api/intelligence/copilot', params, 'POST', { message, context });
  } catch (e) {
    if (e instanceof AiServiceError && e.offline) {
      return {
        reply: 'Intelligence service is temporarily unavailable. Marketplace and wallet features remain fully operational.',
        intent: 'offline',
        suggestions: ['Retry in a moment', 'Browse marketplace', 'Check wallet balance'],
      } satisfies CopilotResponse;
    }
    throw e;
  }
}

export async function checkAiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${AI_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
