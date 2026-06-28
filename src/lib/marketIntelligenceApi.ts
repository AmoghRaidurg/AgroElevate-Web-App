const AI_BASE = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000';
const MI_TIMEOUT_MS = 20_000;

export interface MarketPrice {
  crop: string;
  market_code: string;
  market_name: string;
  district: string;
  state: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrival_quantity: number;
  date: string;
  source: string;
  agroelevate_avg_price?: number;
  district_demand?: number;
  market_volatility?: number;
  weekly_trend?: number;
  monthly_trend?: number;
  latitude?: number;
  longitude?: number;
}

export interface PriceSuggestion {
  crop: string;
  mandi_modal_price: number;
  nearby_highest_price: number;
  district_average: number;
  state_average: number;
  agroelevate_average: number;
  suggested_price: number;
  price_range: { low: number; high: number };
  confidence: number;
  confidence_pct: number;
  recommendation: string;
  expected_additional_earnings_per_kg: number;
  percentage_gain_vs_mandi: number;
  demand: string;
  demand_score: number;
  supply: string;
  expected_selling_probability: number;
  reason: string;
  state?: string;
  district?: string;
  insufficient_data?: boolean;
}

export interface MarketOverview {
  best_selling_crop: string;
  highest_price_crop: string;
  highest_price: number;
  nearest_market: string;
  avg_district_price: number;
  avg_agroelevate_price: number;
  price_difference: number;
  price_difference_pct: number;
  today_demand: number;
  today_supply: number;
  regional_trend: string;
  weather_impact: string;
  state: string;
  district: string | null;
  date: string;
}

export interface NearbyMarket {
  market_code: string;
  market_name: string;
  state: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  travel_time_min: number;
  top_crop: string | null;
  top_price: number | null;
  source: string;
  last_updated: string | null;
}

export interface PriceComparison {
  crop: string;
  agroelevate_avg: number;
  mandi_price: number;
  district_avg: number;
  state_avg: number;
  national_avg: number;
  difference_pct: number;
  potential_profit_per_kg: number;
  recommendation: string;
  expected_royalty_per_kg: number;
  weekly_trend?: number;
  monthly_trend?: number;
}

export interface MarketRecommendation {
  crop: string;
  priority: string;
  title: string;
  message: string;
  suggested_price: number;
  confidence: number;
}

export interface BenchmarkData {
  benchmark: {
    holding_hectares: number;
    holding_acres: number;
    annual_production_kg: number;
    annual_income_inr: number;
    income_per_kg: number;
    disclaimer: string;
  };
  production_breakdown: Array<{ season: string; crop: string; yield_kg: number }>;
  without_agroelevate: Array<{ year: number; income: number; income_per_kg: number }>;
  with_agroelevate: Array<{ year: number; income: number; income_per_kg: number; royalty: number; adoption_pct: number }>;
  projection_label: string;
}

export interface MarketDataSourceStatus {
  data_badge?: string;
  data_updated_ago?: string | null;
  data_mode?: string;
  provider?: string;
  fallback_active?: boolean;
}

export interface FarmerMarketDashboard {
  module: string;
  model_version: string;
  user_id: string;
  location: { state: string; district: string | null; latitude?: number; longitude?: number };
  overview: MarketOverview;
  live_prices: MarketPrice[];
  nearby_markets: NearbyMarket[];
  comparisons: PriceComparison[];
  price_history: Record<string, unknown>[];
  msp: Array<Record<string, unknown>>;
  demand_heatmap: Array<{ district: string; demand_score: number; level: string }>;
  recommendations: MarketRecommendation[];
  benchmark: BenchmarkData;
  sync_status: Record<string, unknown>;
  data_source?: MarketDataSourceStatus;
  _fallback?: boolean;
}

export interface TraderMarketDashboard {
  module: string;
  role: string;
  user_id: string;
  best_procurement_district: string;
  cheapest_market: MarketPrice | null;
  supply_density: number;
  demand_density: number;
  avg_procurement_cost: number;
  transport_cost_estimate_per_kg: number;
  potential_profit_margin_pct: number;
  market_volatility: number;
  district_comparison: Array<{ district: string; avg_price: number }>;
  arbitrage_opportunities: Array<Record<string, unknown>>;
  nearby_markets: NearbyMarket[];
  sync_status: Record<string, unknown>;
  data_source?: MarketDataSourceStatus;
  _fallback?: boolean;
}

export interface IndustrialistMarketDashboard {
  module: string;
  role: string;
  user_id: string;
  raw_material_availability: Array<{ crop: string; avg_price: number; supply_kg: number; markets_count: number }>;
  supplier_density: number;
  avg_procurement_cost: number;
  procurement_forecast: Record<string, unknown>[];
  regional_availability: Array<{ district: string; demand_score: number; level: string }>;
  manufacturing_cost_trend: string;
  future_price_prediction: Record<string, unknown>[];
  recommended_procurement_region: string;
  nearby_markets: NearbyMarket[];
  sync_status: Record<string, unknown>;
  data_source?: MarketDataSourceStatus;
  _fallback?: boolean;
}

export interface MarketLocation {
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  source: 'gps' | 'manual';
}

async function miFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE}${path}?${qs}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Market Intelligence API error ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function locParams(loc?: Partial<MarketLocation>) {
  const p: Record<string, string> = {};
  if (loc?.state) p.state = loc.state;
  if (loc?.district) p.district = loc.district;
  if (loc?.latitude != null) p.latitude = String(loc.latitude);
  if (loc?.longitude != null) p.longitude = String(loc.longitude);
  return p;
}

export async function fetchFarmerMarketDashboard(userId: string, loc?: Partial<MarketLocation>, location?: string) {
  const params: Record<string, string> = { user_id: userId, ...locParams(loc) };
  if (location) params.location = location;
  try {
    return await miFetch<FarmerMarketDashboard>('/api/market-intelligence/farmer/dashboard', params);
  } catch {
    return { _fallback: true, module: 'market_intelligence' } as FarmerMarketDashboard;
  }
}

export async function fetchTraderMarketDashboard(userId: string, loc?: Partial<MarketLocation>) {
  try {
    return await miFetch<TraderMarketDashboard>('/api/market-intelligence/trader/dashboard', { user_id: userId, ...locParams(loc) });
  } catch {
    return { _fallback: true } as TraderMarketDashboard;
  }
}

export async function fetchIndustrialistMarketDashboard(userId: string, state?: string) {
  const params: Record<string, string> = { user_id: userId };
  if (state) params.state = state;
  try {
    return await miFetch<IndustrialistMarketDashboard>('/api/market-intelligence/industrialist/dashboard', params);
  } catch {
    return { _fallback: true } as IndustrialistMarketDashboard;
  }
}

export async function fetchPriceSuggestion(crop: string, loc?: Partial<MarketLocation>, location?: string) {
  const params: Record<string, string> = { crop, ...locParams(loc) };
  if (location) params.location = location;
  try {
    return await miFetch<PriceSuggestion>('/api/market-intelligence/price-suggest', params);
  } catch {
    return { crop, insufficient_data: true, reason: 'Market Intelligence service unavailable', suggested_price: 0, confidence: 0 } as PriceSuggestion;
  }
}

export async function fetchMarketAdminMonitor() {
  return miFetch<Record<string, unknown>>('/api/market-intelligence/admin/monitor');
}

export async function refreshMarketData() {
  const res = await fetch(`${AI_BASE}/api/market-intelligence/refresh`, { method: 'POST' });
  return res.json();
}

export async function fetchMarketStates() {
  return miFetch<{ states: string[] }>('/api/market-intelligence/states');
}

export async function fetchMarketDistricts(state: string) {
  return miFetch<{ districts: string[] }>('/api/market-intelligence/districts', { state });
}

export async function fetchMarketCrops() {
  return miFetch<{ crops: string[] }>('/api/market-intelligence/crops');
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
