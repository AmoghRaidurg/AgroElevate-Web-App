import type { FarmerMarketDashboard, MarketOverview, MarketPrice, NearbyMarket } from '@/lib/marketIntelligenceApi';

const FALLBACK = '—';

/** Safe display — never renders undefined, NaN, or empty string as visible text. */
export function displayText(value: unknown, fallback = FALLBACK): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && Number.isNaN(value)) return fallback;
  const s = String(value).trim();
  if (!s || s === 'undefined' || s === 'NaN') return fallback;
  return s;
}

export function displayNumber(value: unknown, decimals = 2, fallback = FALLBACK): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toFixed(decimals);
}

export function formatInrPerKg(value: unknown, fallback = FALLBACK): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `₹${n.toFixed(2)}/kg`;
}

export function formatInrQuintal(value: unknown, fallback = FALLBACK): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `₹${(n * 100).toFixed(0)}/quintal`;
}

export function demandLevel(score: unknown): string {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 'Moderate';
  if (n >= 70) return 'High';
  if (n >= 45) return 'Moderate';
  return 'Low';
}

export function supplyLevel(kg: unknown): string {
  const n = typeof kg === 'number' ? kg : Number(kg);
  if (!Number.isFinite(n)) return 'Moderate';
  if (n >= 1500) return 'High';
  if (n >= 800) return 'Moderate';
  return 'Low';
}

export function trendLabel(weeklyTrend?: number | null): 'Up' | 'Down' | 'Stable' {
  if (weeklyTrend == null || !Number.isFinite(weeklyTrend)) return 'Stable';
  if (weeklyTrend > 0.02) return 'Up';
  if (weeklyTrend < -0.02) return 'Down';
  return 'Stable';
}

export interface ResolvedOverview {
  bestSellingCrop: string;
  highestPriceCrop: string;
  highestPrice: string;
  nearestMarket: string;
  avgDistrictPrice: string;
  agroelevateSuggestedPrice: string;
  expectedAdditionalIncome: string;
  demandLevel: string;
  supplyLevel: string;
  weatherImpact: string;
  regionalTrend: string;
}

/** Merge API overview with live_prices / nearby fallbacks — never undefined. */
export function resolveOverview(data: FarmerMarketDashboard | null): ResolvedOverview {
  const prices = data?.live_prices ?? [];
  const nearby = data?.nearby_markets ?? [];
  const o: Partial<MarketOverview> = data?.overview ?? {};

  const byArrival = prices.length
    ? [...prices].sort((a, b) => (b.arrival_quantity ?? 0) - (a.arrival_quantity ?? 0))[0]
    : null;
  const byPrice = prices.length
    ? [...prices].sort((a, b) => b.modal_price - a.modal_price)[0]
    : null;
  const nearest = nearby[0];

  const avgDistrict = Number(o.avg_district_price);
  const avgAgro = Number(o.avg_agroelevate_price);
  const priceDiff = Number(o.price_difference);
  const priceDiffPct = Number(o.price_difference_pct);

  const computedDiff = Number.isFinite(avgAgro) && Number.isFinite(avgDistrict)
    ? avgAgro - avgDistrict
    : null;

  return {
    bestSellingCrop: displayText(o.best_selling_crop ?? byArrival?.crop, 'Tomato'),
    highestPriceCrop: displayText(o.highest_price_crop ?? byPrice?.crop, 'Onion'),
    highestPrice: formatInrPerKg(o.highest_price ?? byPrice?.modal_price, '₹0.00/kg'),
    nearestMarket: displayText(o.nearest_market ?? nearest?.market_name ?? byPrice?.market_name, 'Nearest APMC'),
    avgDistrictPrice: formatInrPerKg(
      Number.isFinite(avgDistrict) ? avgDistrict : prices.length
        ? prices.reduce((s, p) => s + p.modal_price, 0) / prices.length
        : null,
    ),
    agroelevateSuggestedPrice: formatInrPerKg(
      Number.isFinite(avgAgro) ? avgAgro : byPrice?.agroelevate_avg_price ?? (byPrice ? byPrice.modal_price * 1.1 : null),
    ),
    expectedAdditionalIncome: Number.isFinite(priceDiff)
      ? `+₹${priceDiff.toFixed(2)}/kg (${Number.isFinite(priceDiffPct) ? priceDiffPct : 0}%)`
      : computedDiff != null
        ? `+₹${computedDiff.toFixed(2)}/kg`
        : '+₹5.00/kg (demo)',
    demandLevel: demandLevel(o.today_demand),
    supplyLevel: supplyLevel(o.today_supply),
    weatherImpact: displayText(o.weather_impact, 'Moderate — monitor rainfall for perishables'),
    regionalTrend: displayText(o.regional_trend, 'Stable'),
  };
}

/** Top N unique crops by modal price (one representative row per crop). */
export function topCropPrices(prices: MarketPrice[], limit = 20): MarketPrice[] {
  const byCrop = new Map<string, MarketPrice>();
  for (const p of prices) {
    const existing = byCrop.get(p.crop);
    if (!existing || p.modal_price > existing.modal_price) {
      byCrop.set(p.crop, p);
    }
  }
  return [...byCrop.values()]
    .sort((a, b) => b.modal_price - a.modal_price)
    .slice(0, limit);
}

export function filterLivePrices(prices: MarketPrice[], search: string, cropFilter: string): MarketPrice[] {
  return prices.filter((p) => {
    if (cropFilter !== 'all' && p.crop !== cropFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.crop.toLowerCase().includes(q)
      || p.market_name.toLowerCase().includes(q)
      || p.district.toLowerCase().includes(q)
      || p.state.toLowerCase().includes(q)
    );
  });
}

export function trendForMarket(market: NearbyMarket, prices: MarketPrice[]): 'Up' | 'Down' | 'Stable' {
  const match = prices.find(
    (p) => p.market_code === market.market_code || p.market_name === market.market_name,
  );
  return trendLabel(match?.weekly_trend ?? match?.monthly_trend);
}

export interface CropForecast {
  crop: string;
  todayPrice: number;
  tomorrow: number;
  day3: number;
  day7: number;
  confidencePct: number;
  expectedTrend: 'Rise' | 'Fall' | 'Stable';
  explanation: string;
  chartData: Array<{ date: string; price: number }>;
}

export function buildCropForecast(
  crop: string,
  priceHistory: Record<string, unknown>[],
  livePrices: MarketPrice[],
): CropForecast {
  const cropLower = crop.toLowerCase();
  const live = livePrices.find((p) => p.crop.toLowerCase() === cropLower);
  const history = priceHistory
    .filter((h) => String(h.crop ?? '').toLowerCase() === cropLower)
    .map((h) => ({
      date: String(h.date ?? h.arrival_date ?? ''),
      price: Number(h.modal_price ?? 0),
    }))
    .filter((h) => h.date && Number.isFinite(h.price) && h.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayPrice = live?.modal_price
    ?? history[history.length - 1]?.price
    ?? 50;

  const weeklyTrend = live?.weekly_trend ?? 0;
  const dailyRate = weeklyTrend / 7;
  const tomorrow = todayPrice * (1 + dailyRate);
  const day3 = todayPrice * (1 + dailyRate * 3);
  const day7 = todayPrice * (1 + weeklyTrend);

  const trend = trendLabel(weeklyTrend);
  const expectedTrend = trend === 'Up' ? 'Rise' : trend === 'Down' ? 'Fall' : 'Stable';

  const confidencePct = Math.min(95, Math.max(62, 72 + Math.round((history.length / 30) * 10)));

  const explanation =
    expectedTrend === 'Rise'
      ? `${crop} prices in your region are trending upward based on recent mandi arrivals and demand. Selling through AgroElevate may capture a premium over the modal rate.`
      : expectedTrend === 'Fall'
        ? `${crop} prices show softening momentum. Consider selling soon or use AgroElevate's buyer network for steadier returns.`
        : `${crop} prices are relatively stable. AgroElevate's suggested price accounts for local demand and recent buyer activity.`;

  const chartData = history.length >= 2
    ? history.slice(-30).map((h) => ({ date: h.date.slice(5), price: h.price }))
    : Array.from({ length: 14 }, (_, i) => ({
        date: `D-${13 - i}`,
        price: todayPrice * (1 + dailyRate * (i - 13)),
      }));

  return {
    crop,
    todayPrice,
    tomorrow,
    day3,
    day7,
    confidencePct,
    expectedTrend,
    explanation,
    chartData,
  };
}

export function uniqueCrops(prices: MarketPrice[]): string[] {
  return [...new Set(prices.map((p) => p.crop))].sort();
}
