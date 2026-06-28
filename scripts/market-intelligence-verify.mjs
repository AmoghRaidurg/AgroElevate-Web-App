#!/usr/bin/env node
/** Market Intelligence API verification — all production endpoints */
const AI_URL = process.env.VITE_AI_API_URL || process.env.AI_API_URL || 'http://localhost:8000';

const ENDPOINTS = [
  ['/api/market-intelligence/health', 'Health'],
  ['/api/market-intelligence/overview?state=Maharashtra', 'Overview'],
  ['/api/market-intelligence/live-prices?state=Maharashtra&limit=5', 'Live Prices'],
  ['/api/market-intelligence/nearby-markets?latitude=19.07&longitude=72.87&limit=5', 'Nearby Markets'],
  ['/api/market-intelligence/comparison?crop=Tomato&state=Maharashtra', 'Comparison'],
  ['/api/market-intelligence/forecast?state=Maharashtra&days=30', 'Forecast'],
  ['/api/market-intelligence/msp', 'MSP'],
  ['/api/market-intelligence/recommendations?state=Maharashtra', 'Recommendations'],
  ['/api/market-intelligence/admin', 'Admin'],
  ['/api/market-intelligence/dataset', 'Dataset'],
  ['/api/market-intelligence/price-suggest?crop=Tomato&state=Maharashtra', 'Price Suggest'],
];

async function check(path, label) {
  const res = await fetch(`${AI_URL}${path}`);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const data = await res.json();
  console.log(`✓ ${label}`);
  return data;
}

async function main() {
  console.log(`Market Intelligence Verification → ${AI_URL}\n`);
  for (const [path, label] of ENDPOINTS) {
    await check(path, label);
  }
  const suggest = await check('/api/market-intelligence/price-suggest?crop=Tomato&state=Maharashtra', 'Price Suggest validation');
  if (!suggest.suggested_price) throw new Error('No suggested price');
  if (!suggest.reason) throw new Error('Missing AI explanation');
  const prices = await check('/api/market-intelligence/live-prices?state=Maharashtra&limit=5', 'Live Prices validation');
  if (!prices.count) throw new Error('No live prices returned');
  console.log('\nAll Market Intelligence API checks passed.');
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
