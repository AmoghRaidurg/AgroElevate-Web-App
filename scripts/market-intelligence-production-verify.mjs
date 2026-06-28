#!/usr/bin/env node
/**
 * Market Intelligence production verification — DB tables, endpoints, dataset, regression.
 * Usage: node scripts/market-intelligence-production-verify.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url, { debug: false });

const AI_URL = process.env.VITE_AI_API_URL || 'https://agroelevate-ai.onrender.com';
const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MI_TABLES = [
  'state_master', 'district_master', 'crop_master', 'market_master',
  'market_prices', 'market_price_history', 'msp_data', 'market_prediction',
  'weather_market', 'market_cache', 'market_sync_log',
];

const ENDPOINTS = [
  { path: '/health', label: 'Root health' },
  { path: '/api/market-intelligence/health', label: 'MI health' },
  { path: '/api/market-intelligence/overview?state=Maharashtra', label: 'Overview' },
  { path: '/api/market-intelligence/live-prices?state=Maharashtra&limit=5', label: 'Live prices' },
  { path: '/api/market-intelligence/nearby-markets?latitude=19.07&longitude=72.87&limit=5', label: 'Nearby markets' },
  { path: '/api/market-intelligence/comparison?crop=Tomato&state=Maharashtra', label: 'Comparison' },
  { path: '/api/market-intelligence/forecast?state=Maharashtra&days=30', label: 'Forecast' },
  { path: '/api/market-intelligence/msp', label: 'MSP' },
  { path: '/api/market-intelligence/recommendations?state=Maharashtra', label: 'Recommendations' },
  { path: '/api/market-intelligence/admin', label: 'Admin' },
  { path: '/api/market-intelligence/dataset', label: 'Dataset' },
  { path: '/api/market-intelligence/price-suggest?crop=Tomato&state=Maharashtra', label: 'Price suggest' },
  { path: '/api/market-intelligence/farmer/dashboard?user_id=verify&state=Maharashtra', label: 'Farmer dashboard' },
  { path: '/api/market-intelligence/trader/dashboard?user_id=verify', label: 'Trader dashboard' },
  { path: '/api/market-intelligence/industrialist/dashboard?user_id=verify', label: 'Industrialist dashboard' },
];

const report = {
  timestamp: new Date().toISOString(),
  database: {},
  endpoints: [],
  dataset: {},
  performance: {},
  data_source: null,
  passed: 0,
  failed: 0,
};

function pass(label, detail = '') {
  report.passed++;
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  report.failed++;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function verifyDatabase() {
  console.log('\n=== STEP 1: Database Verification ===\n');
  if (!url || !serviceKey) {
    fail('Database', 'Missing Supabase credentials');
    return;
  }
  const admin = createClient(url, serviceKey);
  for (const table of MI_TABLES) {
    try {
      const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        report.database[table] = { exists: false, error: error.message };
        fail(`Table ${table}`, error.message);
      } else {
        report.database[table] = { exists: true, row_count: count ?? 0 };
        pass(`Table ${table}`, `${count ?? 0} rows`);
      }
    } catch (e) {
      report.database[table] = { exists: false, error: e.message };
      fail(`Table ${table}`, e.message);
    }
  }
}

async function verifyEndpoints() {
  console.log('\n=== STEP 2: Render Endpoint Verification ===\n');
  console.log(`AI URL: ${AI_URL}\n`);
  for (const { path, label } of ENDPOINTS) {
    const t0 = performance.now();
    try {
      const res = await fetch(`${AI_URL}${path}`, { headers: { Accept: 'application/json' } });
      const ms = Math.round(performance.now() - t0);
      report.performance[path] = ms;
      if (res.status === 200) {
        const data = await res.json();
        report.endpoints.push({ path, label, status: 200, ms, ok: true });
        pass(`${label} (${path})`, `${ms}ms`);
        if (path.includes('/health') || path.includes('/dataset')) {
          report.data_source = data.data_source || data.data_mode || data;
        }
      } else {
        report.endpoints.push({ path, label, status: res.status, ms, ok: false });
        fail(`${label} (${path})`, `HTTP ${res.status}`);
      }
    } catch (e) {
      report.endpoints.push({ path, label, error: e.message, ok: false });
      fail(`${label} (${path})`, e.message);
    }
  }
}

function verifyLocalDataset() {
  console.log('\n=== STEP 10: Dataset Verification ===\n');
  const statsPath = resolve(dirname(fileURLToPath(import.meta.url)), '../ai-service/data/market/dataset_stats.json');
  try {
    const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
    report.dataset = stats;
    const expected = { states: 36, districts: 792, markets: 504, crops: 120, history_records: 104755, current_prices: 7560 };
    for (const [k, v] of Object.entries(expected)) {
      const actual = stats[k];
      if (actual >= v * 0.95) pass(`Dataset ${k}`, `${actual} (expected ~${v})`);
      else fail(`Dataset ${k}`, `${actual} < ${v}`);
    }
  } catch (e) {
    fail('Dataset stats file', e.message);
  }
}

async function main() {
  await verifyDatabase();
  await verifyEndpoints();
  verifyLocalDataset();

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${report.passed}  Failed: ${report.failed}`);
  if (report.data_source) {
    console.log('\nData source status:', JSON.stringify(report.data_source, null, 2));
  }

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '.market-intelligence-production.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);

  if (report.failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
