/** Educational chart data — illustrative supply-chain economics (not live API data). */

export const SUPPLY_CHAIN_CROPS = ['Wheat', 'Rice', 'Onion', 'Potato', 'Tomato', 'Maize'] as const;

/** Indexed value (₹ per quintal equivalent) at each supply-chain stage — retail is highest. */
export const SUPPLY_CHAIN_VALUE_DATA = [
  { crop: 'Wheat', Farmer: 2200, Trader: 3100, Industrialist: 3900, Retail: 4800 },
  { crop: 'Rice', Farmer: 2400, Trader: 3300, Industrialist: 4100, Retail: 5200 },
  { crop: 'Onion', Farmer: 1800, Trader: 2800, Industrialist: 3600, Retail: 4500 },
  { crop: 'Potato', Farmer: 1600, Trader: 2400, Industrialist: 3200, Retail: 4000 },
  { crop: 'Tomato', Farmer: 2000, Trader: 3000, Industrialist: 3800, Retail: 4700 },
  { crop: 'Maize', Farmer: 1900, Trader: 2700, Industrialist: 3500, Retail: 4300 },
] as const;

export const SUPPLY_CHAIN_STAGES = [
  { key: 'Farmer', label: 'Farmer', color: 'hsl(158 64% 35%)' },
  { key: 'Trader', label: 'Trader', color: 'hsl(160 84% 45%)' },
  { key: 'Industrialist', label: 'Industrialist', color: 'hsl(187 85% 48%)' },
  { key: 'Retail', label: 'Retail', color: 'hsl(38 92% 50%)' },
] as const;

/** Farmer income projection — illustrative comparison (2025–2028). */
export const FARMER_INCOME_PROJECTION = [
  { year: '2025', traditional: 100000, agroElevate: 100000, confidence: 0.92 },
  { year: '2026', traditional: 108000, agroElevate: 128000, confidence: 0.88 },
  { year: '2027', traditional: 116000, agroElevate: 158000, confidence: 0.84 },
  { year: '2028', traditional: 125000, agroElevate: 192000, confidence: 0.8 },
] as const;

export const SUPPLY_CHAIN_CAPTION =
  'Current agricultural supply chains disproportionately reward downstream participants. AgroElevate aims to improve farmer profitability through transparent commerce and automated royalty distribution.';

export const FARMER_PROJECTION_CAPTION =
  'Projected cumulative farmer income under traditional multi-hop supply chains versus AgroElevate-enabled direct commerce and automated royalty remittance. Values are illustrative models for academic demonstration.';
