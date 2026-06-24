/**
 * Commerce end-to-end verification script (Phase F0).
 *
 * Usage:
 *   npm run commerce:verify
 *
 * Environment (.env):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (required)
 *   COMMERCE_TEST_PASSWORD (default: CommerceTest!123)
 *
 * Optional — reuse existing test accounts (recommended when signup is rate-limited):
 *   COMMERCE_FARMER_EMAIL, COMMERCE_TRADER_EMAIL, COMMERCE_IND_EMAIL
 *
 * Strategy: sign-in first → sign-up only if account missing (not on rate limit).
 */

import { createClient } from '@supabase/supabase-js';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url, { debug: true });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const password = process.env.COMMERCE_TEST_PASSWORD || 'CommerceTest!123';

const FIXED_PREFIX = 'commerce.verify';
const farmerEmail = process.env.COMMERCE_FARMER_EMAIL || `${FIXED_PREFIX}.farmer@example.com`;
const traderEmail = process.env.COMMERCE_TRADER_EMAIL || `${FIXED_PREFIX}.trader@example.com`;
const industrialistEmail = process.env.COMMERCE_IND_EMAIL || `${FIXED_PREFIX}.ind@example.com`;

if (!url || !anonKey) {
  console.error('\nMissing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  console.error('Ensure agro-fair-chain/.env exists and run npm scripts from agro-fair-chain/.');
  process.exit(1);
}

const ts = Date.now();
const results = [];
let rateLimited = false;

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function isRateLimit(msg) {
  return /rate limit/i.test(msg || '');
}

async function acquireRole(email, role, name) {
  const client = createClient(url, anonKey);

  const { data: signIn, error: siErr } = await client.auth.signInWithPassword({ email, password });
  if (!siErr && signIn.session) {
    return { client, userId: signIn.user.id, session: signIn.session, method: 'sign-in' };
  }

  if (siErr && !/invalid login credentials/i.test(siErr.message)) {
    if (isRateLimit(siErr.message)) rateLimited = true;
    throw new Error(`signIn ${role}: ${siErr.message}`);
  }

  // Admin provision when service role available (avoids signup rate limits)
  if (serviceRoleKey) {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, address: 'Test', phone: '9999999999', bank_account: 'TEST001' },
    });
    if (createErr && !/already been registered/i.test(createErr.message)) {
      throw new Error(`admin createUser ${role}: ${createErr.message}`);
    }
    const { data: signIn2, error: siErr2 } = await client.auth.signInWithPassword({ email, password });
    if (siErr2) throw new Error(`signIn after admin create ${role}: ${siErr2.message}`);
    const authedClient = createClient(url, anonKey);
    await authedClient.auth.setSession({
      access_token: signIn2.session.access_token,
      refresh_token: signIn2.session.refresh_token,
    });
    return { client: authedClient, userId: signIn2.user.id, session: signIn2.session, method: 'admin-provision' };
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { name, role, address: 'Test', phone: '9999999999', bank_account: 'TEST001' },
    },
  });

  if (error) {
    if (isRateLimit(error.message)) rateLimited = true;
    throw new Error(`signUp ${role}: ${error.message}`);
  }

  if (data.session) {
    return { client, userId: data.user.id, session: data.session, method: 'sign-up' };
  }

  const { data: signIn2, error: siErr2 } = await client.auth.signInWithPassword({ email, password });
  if (siErr2) throw new Error(`signIn after signUp ${role}: ${siErr2.message}`);
  return { client, userId: signIn2.user.id, session: signIn2.session, method: 'sign-up+sign-in' };
}

async function ensureRecords(client, userId) {
  await client.rpc('ensure_profile_from_auth');
  const { data } = await client.from('users').select('uid').eq('uid', userId).maybeSingle();
  return !!data;
}

async function checkWalletHistory(client, userId, label) {
  const { data: history, error } = await client
    .from('wallet_history')
    .select('id, type, amount, description, createdAt')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(5);

  if (error) fail(`${label} wallet_history read`, error.message);
  else pass(`${label} wallet_history read`, `${history?.length ?? 0} recent row(s)`);
  return history ?? [];
}

async function main() {
  console.log('Commerce E2E Verification');
  console.log(`Farmer: ${farmerEmail}`);
  console.log(`Trader: ${traderEmail}`);
  console.log(`Industrialist: ${industrialistEmail}\n`);

  let farmer, trader, industrialist;

  for (const [label, email, role, name, ref] of [
    ['Farmer', farmerEmail, 'farmer', 'Verify Farmer', (v) => { farmer = v; }],
    ['Trader', traderEmail, 'middleman', 'Verify Trader', (v) => { trader = v; }],
    ['Industrialist', industrialistEmail, 'industrialist', 'Verify Industrialist', (v) => { industrialist = v; }],
  ]) {
    try {
      const u = await acquireRole(email, role, name);
      ref(u);
      pass(`${label} account ready (${u.method})`, u.userId);
    } catch (e) {
      fail(`${label} account ready`, e.message);
  if (rateLimited) {
    console.error('\n⚠ Supabase signup rate limit.');
    console.error('  → Add SUPABASE_SERVICE_ROLE_KEY to .env and rerun, or');
    console.error('  → Create test accounts manually (see MANUAL_COMMERCE_TEST.md)');
  }
      return printSummary();
    }
  }

  for (const [label, u] of [['Farmer', farmer], ['Trader', trader], ['Industrialist', industrialist]]) {
    try {
      const ok = await ensureRecords(u.client, u.userId);
      ok ? pass(`${label} users row exists`) : fail(`${label} users row exists`, 'missing after ensure');
    } catch (e) {
      fail(`${label} users row exists`, e.message);
    }
  }

  const { data: product, error: productErr } = await farmer.client.from('products').insert({
    name: `Verify Wheat ${ts}`,
    crop_type: 'Grain',
    price_per_unit: 50,
    quantity: 100,
    unit: 'kg',
    seller_id: farmer.userId,
  }).select('id').single();

  if (productErr) fail('Farmer lists product', productErr.message);
  else pass('Farmer lists product', product.id);

  const { error: addErr } = await trader.client.rpc('add_funds', { p_amount: 10000 });
  if (addErr) fail('add_funds', addErr.message);
  else pass('add_funds', '₹10000 deposited');

  const { data: traderBalAfterDeposit, error: balErr } = await trader.client.rpc('get_wallet_balance');
  if (balErr) fail('get_wallet_balance after deposit', balErr.message);
  else if (Number(traderBalAfterDeposit) < 5000) fail('wallet balance sync after deposit', `balance=${traderBalAfterDeposit}`);
  else pass('wallet balance sync after deposit', `₹${traderBalAfterDeposit}`);

  await checkWalletHistory(trader.client, trader.userId, 'Trader');

  if (product?.id) {
    const { data: checkout, error: coErr } = await trader.client.rpc('checkout_order', {
      cart: [{ id: product.id, qty: 10 }],
    });
    if (coErr) fail('checkout_order (farmer→trader)', coErr.message);
    else pass('checkout_order (farmer→trader)', `order=${checkout?.order_id} total=${checkout?.total_amount}`);

    const { data: balAfterCheckout } = await trader.client.rpc('get_wallet_balance');
    if (Number(balAfterCheckout) >= Number(traderBalAfterDeposit)) {
      fail('wallet balance after checkout', `expected decrease, balance=${balAfterCheckout}`);
    } else {
      pass('wallet balance after checkout', `₹${balAfterCheckout}`);
    }
  }

  const { data: farmerSales, error: fsErr } = await farmer.client
    .from('order_items')
    .select('id, totalPrice, orders!inner(buyerName, status)')
    .eq('farmerId', farmer.userId);

  if (fsErr) fail('farmer sales dashboard (order_items RLS)', fsErr.message);
  else if (!farmerSales?.length) fail('farmer sales dashboard (order_items RLS)', '0 rows');
  else pass('farmer sales dashboard (order_items RLS)', `${farmerSales.length} sale(s)`);

  const { data: farmerBal, error: fBalErr } = await farmer.client.rpc('get_wallet_balance');
  if (fBalErr) fail('farmer get_wallet_balance after sale', fBalErr.message);
  else pass('farmer wallet balance after direct sale', `₹${farmerBal}`);

  await checkWalletHistory(farmer.client, farmer.userId, 'Farmer');

  const purchase = farmerSales?.[0];
  if (purchase) {
    const relistDesc = JSON.stringify({
      original_farmer_id: farmer.userId,
      source_order_item_id: purchase.id,
      source_order_item_qty: 5,
      purchase_price_per_unit: 50,
    });
    const { data: relist, error: relistErr } = await trader.client.from('products').insert({
      name: `Verify Relist ${ts}`,
      crop_type: 'Grain',
      price_per_unit: 70,
      quantity: 5,
      unit: 'kg',
      seller_id: trader.userId,
      description: relistDesc,
    }).select('id').single();

    if (relistErr) fail('Trader relists product', relistErr.message);
    else pass('Trader relists product', relist.id);

    const { error: indAddErr } = await industrialist.client.rpc('add_funds', { p_amount: 5000 });
    if (indAddErr) fail('Industrialist add_funds', indAddErr.message);
    else pass('Industrialist add_funds', '₹5000');

    if (relist?.id) {
      const { data: co2, error: co2Err } = await industrialist.client.rpc('checkout_order', {
        cart: [{ id: relist.id, qty: 5 }],
      });
      if (co2Err) fail('checkout_order with royalty', co2Err.message);
      else pass('checkout_order with royalty', `order=${co2?.order_id}`);
    }

    const { data: royalty, error: royErr } = await farmer.client
      .from('wallet_history')
      .select('amount, description, type')
      .eq('userId', farmer.userId)
      .eq('type', 'royalty_income');

    if (royErr) fail('royalty transfer wallet_history', royErr.message);
    else if (!royalty?.length) fail('royalty transfer wallet_history', 'no royalty entries');
    else {
      const total = royalty.reduce((s, r) => s + Number(r.amount), 0);
      const expected = 5 * 70 * 0.125;
      if (Math.abs(total - expected) > 0.02) {
        fail('royalty amount', `got ₹${total}, expected ~₹${expected}`);
      } else {
        pass('royalty transfer wallet_history', `₹${total} (12.5%)`);
      }
    }
  }

  const { error: tfErr } = await trader.client.rpc('transfer_funds', {
    p_receiver_id: farmer.userId,
    p_amount: 100,
  });
  if (tfErr) fail('transfer_funds', tfErr.message);
  else pass('transfer_funds', '₹100 trader→farmer');

  const { data: farmerBalAfterTransfer } = await farmer.client.rpc('get_wallet_balance');
  pass('farmer balance after transfer_funds', `₹${farmerBalAfterTransfer}`);

  printSummary();
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${passed}/${total} checks passed ---`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
  }
  if (rateLimited) {
    console.log('\nRATE_LIMITED=1');
  }
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exitCode = 1;
});
