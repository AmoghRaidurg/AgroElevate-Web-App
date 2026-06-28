import type { FarmerMarketDashboard, MarketOverview, MarketPrice, NearbyMarket } from '@/lib/marketIntelligenceApi';

const FALLBACK = '—';
const AI_PREMIUM = 1.12;

/** Safe display — never renders undefined, NaN, or empty string as visible text. */
export function displayText(value: unknown, fallback = FALLBACK): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && Number.isNaN(value)) return fallback;
  const s = String(value).trim();
  if (!s || s === 'undefined' || s === 'NaN') return fallback;
  return s;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Treat zero and negative as missing for price display. */
export function isValidPrice(value: unknown): boolean {
  const n = toNumber(value);
  return n !== null && n > 0;
}

export function displayNumber(value: unknown, decimals = 2, fallback = FALLBACK): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toFixed(decimals);
}

export function formatInrPerKg(value: unknown, fallback = FALLBACK): string {
  if (!isValidPrice(value)) return fallback;
  return `₹${toNumber(value)!.toFixed(2)}/kg`;
}

export function formatInrQuintal(value: unknown, fallback = FALLBACK): string {
  if (!isValidPrice(value)) return fallback;
  return `₹${(toNumber(value)! * 100).toFixed(0)}/quintal`;
}

export function demandLevel(score: unknown): string {
  const n = toNumber(score);
  if (n === null) return 'Moderate';
  if (n >= 70) return 'High';
  if (n >= 45) return 'Moderate';
  return 'Low';
}

export function supplyLevel(kg: unknown): string {
  const n = toNumber(kg);
  if (n === null) return 'Moderate';
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

/** Normalize API row — handles string numbers and alternate field names. */
export function normalizeMarketPrice(raw: Record<string, unknown>): MarketPrice | null {
  const crop = String(raw.crop ?? raw.commodity ?? '').trim();
  const modal = toNumber(raw.modal_price);
  if (!crop || !isValidPrice(modal)) return null;

  return {
    crop,
    market_code: String(raw.market_code ?? raw.marketCode ?? ''),
    market_name: String(raw.market_name ?? raw.market ?? 'APMC Market'),
    district: String(raw.district ?? ''),
    state: String(raw.state ?? ''),
    min_price: toNumber(raw.min_price) ?? modal!,
    max_price: toNumber(raw.max_price) ?? modal!,
    modal_price: modal!,
    arrival_quantity: toNumber(raw.arrival_quantity ?? raw.arrivals) ?? 0,
    date: String(raw.date ?? raw.arrival_date ?? raw.price_date ?? new Date().toISOString().slice(0, 10)),
    source: String(raw.source ?? 'dataset'),
    agroelevate_avg_price: toNumber(raw.agroelevate_avg_price) ?? undefined,
    district_demand: toNumber(raw.district_demand) ?? undefined,
    market_volatility: toNumber(raw.market_volatility) ?? undefined,
    weekly_trend: toNumber(raw.weekly_trend) ?? undefined,
    monthly_trend: toNumber(raw.monthly_trend) ?? undefined,
    latitude: toNumber(raw.latitude) ?? undefined,
    longitude: toNumber(raw.longitude) ?? undefined,
  };
}

export function normalizeMarketPrices(rows: unknown): MarketPrice[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => normalizeMarketPrice(r as Record<string, unknown>))
    .filter((p): p is MarketPrice => p !== null);
}

function normKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/** District → state → national fallback for price rows. */
export function selectPricesGeographic(
  prices: MarketPrice[],
  district?: string | null,
  state?: string | null,
): MarketPrice[] {
  const valid = prices.filter((p) => isValidPrice(p.modal_price));
  if (!valid.length) return [];

  const dKey = normKey(district);
  const sKey = normKey(state);

  if (dKey) {
    const districtRows = valid.filter((p) => normKey(p.district).includes(dKey) || dKey.includes(normKey(p.district)));
    if (districtRows.length) return districtRows;
  }

  if (sKey) {
    const stateRows = valid.filter((p) => normKey(p.state) === sKey || normKey(p.state).includes(sKey));
    if (stateRows.length) return stateRows;
  }

  return valid;
}

function avgModal(prices: MarketPrice[]): number | null {
  const vals = prices.map((p) => p.modal_price).filter(isValidPrice);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function pickPositiveApiPrice(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (isValidPrice(c)) return toNumber(c);
  }
  return null;
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

/** Merge API overview with geographically scoped live_prices — never ₹0.00. */
export function resolveOverview(
  data: FarmerMarketDashboard | null,
  prices: MarketPrice[],
  district?: string | null,
  state?: string | null,
): ResolvedOverview {
  const scoped = selectPricesGeographic(prices, district ?? data?.location?.district, state ?? data?.location?.state);
  const pool = scoped.length ? scoped : prices.filter((p) => isValidPrice(p.modal_price));
  const nearby = data?.nearby_markets ?? [];
  const o: Partial<MarketOverview> = data?.overview ?? {};

  const byArrival = pool.length
    ? [...pool].sort((a, b) => (b.arrival_quantity ?? 0) - (a.arrival_quantity ?? 0))[0]
    : null;
  const byPrice = pool.length
    ? [...pool].sort((a, b) => b.modal_price - a.modal_price)[0]
    : null;

  const nearestFromMarkets = nearby.find((m) => isValidPrice(m.top_price)) ?? nearby[0];
  const nearestFromPrices = byPrice;

  const districtAvg = pickPositiveApiPrice(o.avg_district_price) ?? avgModal(pool);
  const agroFromApi = pickPositiveApiPrice(o.avg_agroelevate_price);
  const agroFromRow = byPrice?.agroelevate_avg_price;
  const suggested = agroFromApi
    ?? (isValidPrice(agroFromRow) ? agroFromRow : null)
    ?? (districtAvg !== null ? districtAvg * AI_PREMIUM : null)
    ?? (byPrice ? byPrice.modal_price * AI_PREMIUM : null);

  const priceDiff = pickPositiveApiPrice(o.price_difference)
    ?? (suggested !== null && districtAvg !== null ? suggested - districtAvg : null);
  const priceDiffPct = pickPositiveApiPrice(o.price_difference_pct)
    ?? (priceDiff !== null && districtAvg ? (priceDiff / districtAvg) * 100 : null);

  const highestModal = pickPositiveApiPrice(o.highest_price) ?? byPrice?.modal_price ?? null;

  return {
    bestSellingCrop: displayText(o.best_selling_crop ?? byArrival?.crop, 'Tomato'),
    highestPriceCrop: displayText(o.highest_price_crop ?? byPrice?.crop, 'Onion'),
    highestPrice: formatInrPerKg(highestModal),
    nearestMarket: displayText(
      o.nearest_market ?? nearestFromMarkets?.market_name ?? nearestFromPrices?.market_name,
      'Nearest APMC',
    ),
    avgDistrictPrice: formatInrPerKg(districtAvg),
    agroelevateSuggestedPrice: formatInrPerKg(suggested),
    expectedAdditionalIncome: priceDiff !== null
      ? `+₹${priceDiff.toFixed(2)}/kg${priceDiffPct !== null ? ` (${priceDiffPct.toFixed(1)}%)` : ''}`
      : districtAvg !== null && suggested !== null
        ? `+₹${(suggested - districtAvg).toFixed(2)}/kg`
        : '+₹5.00/kg (estimated)',
    demandLevel: demandLevel(o.today_demand ?? byPrice?.district_demand),
    supplyLevel: supplyLevel(o.today_supply ?? byArrival?.arrival_quantity),
    weatherImpact: displayText(o.weather_impact, 'Moderate — monitor rainfall for perishables'),
    regionalTrend: displayText(
      o.regional_trend,
      byPrice?.monthly_trend != null
        ? (byPrice.monthly_trend > 0.02 ? 'Rising' : byPrice.monthly_trend < -0.02 ? 'Falling' : 'Stable')
        : 'Stable',
    ),
  };
}

/** First N records from pool (default view). */
export function firstPriceRecords(prices: MarketPrice[], limit = 20): MarketPrice[] {
  return prices.filter((p) => isValidPrice(p.modal_price)).slice(0, limit);
}

export function filterLivePrices(prices: MarketPrice[], search: string, cropFilter: string): MarketPrice[] {
  const q = search.trim().toLowerCase();
  const cropKey = cropFilter === 'all' ? '' : cropFilter.toLowerCase();

  return prices.filter((p) => {
    if (!isValidPrice(p.modal_price)) return false;
    if (cropKey && p.crop.toLowerCase() !== cropKey) return false;
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
      price: toNumber(h.modal_price) ?? 0,
    }))
    .filter((h) => h.date && isValidPrice(h.price))
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayPrice = (isValidPrice(live?.modal_price) ? live!.modal_price : null)
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
  return [...new Set(prices.map((p) => p.crop).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function mergePriceLists(...lists: MarketPrice[][]): MarketPrice[] {
  const seen = new Set<string>();
  const out: MarketPrice[] = [];
  for (const list of lists) {
    for (const p of list) {
      if (!isValidPrice(p.modal_price)) continue;
      const key = `${p.market_code}:${p.crop}:${p.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}
