#!/usr/bin/env node
/** Market Intelligence API verification */
const AI_URL = process.env.VITE_AI_API_URL || process.env.AI_API_URL || 'http://localhost:8000';

async function check(path, label) {
  const res = await fetch(`${AI_URL}${path}`);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const data = await res.json();
  console.log(`✓ ${label}`);
  return data;
}

async function main() {
  console.log('Market Intelligence Verification\n');
  await check('/api/market-intelligence/health', 'Health');
  const prices = await check('/api/market-intelligence/live-prices?state=Maharashtra&limit=5', 'Live Prices');
  if (!prices.count) throw new Error('No live prices returned');
  const suggest = await check('/api/market-intelligence/price-suggest?crop=Tomato&state=Maharashtra', 'Price Suggest');
  if (!suggest.suggested_price) throw new Error('No suggested price');
  if (!suggest.reason) throw new Error('Missing AI explanation');
  await check('/api/market-intelligence/benchmark', 'Benchmark');
  await check('/api/market-intelligence/comparison?crop=Wheat&state=Punjab', 'Comparison');
  const dash = await check('/api/market-intelligence/farmer/dashboard?user_id=test-user&state=Maharashtra', 'Farmer Dashboard');
  if (dash.module !== 'market_intelligence') throw new Error('Wrong module');
  console.log('\nAll Market Intelligence API checks passed.');
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
