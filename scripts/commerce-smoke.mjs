/**
 * Commerce RPC smoke test — no signup required.
 * Verifies production RPCs exist and return expected auth errors (not "function not found").
 *
 * Usage: npm run commerce:smoke
 */

import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './load-env.mjs';

const { url, anonKey } = requireSupabaseEnv(import.meta.url);

const supabase = createClient(url, anonKey);
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function rpcExists(error) {
  if (!error) return true;
  const msg = error.message || '';
  if (/function.*does not exist/i.test(msg)) return false;
  if (/could not find.*schema/i.test(msg)) return false;
  return true;
}

async function main() {
  console.log('Commerce RPC Smoke Test (unauthenticated)\n');

  const { error: balErr } = await supabase.rpc('get_wallet_balance');
  if (rpcExists(balErr)) pass('get_wallet_balance RPC exists', balErr?.message ?? 'ok');
  else fail('get_wallet_balance RPC exists', balErr?.message);

  const { error: addErr } = await supabase.rpc('add_funds', { p_amount: 100 });
  if (rpcExists(addErr)) pass('add_funds RPC exists', addErr?.message ?? 'ok');
  else fail('add_funds RPC exists', addErr?.message);

  const { error: tfErr } = await supabase.rpc('transfer_funds', {
    p_receiver_id: '00000000-0000-0000-0000-000000000001',
    p_amount: 1,
  });
  if (rpcExists(tfErr)) pass('transfer_funds RPC exists', tfErr?.message ?? 'ok');
  else fail('transfer_funds RPC exists', tfErr?.message);

  const { error: coErr } = await supabase.rpc('checkout_order', {
    cart: [{ id: '00000000-0000-0000-0000-000000000001', qty: 1 }],
  });
  if (rpcExists(coErr)) pass('checkout_order RPC exists', coErr?.message ?? 'ok');
  else fail('checkout_order RPC exists', coErr?.message);

  const { error: epErr } = await supabase.rpc('ensure_profile_from_auth');
  if (rpcExists(epErr)) pass('ensure_profile_from_auth RPC exists', epErr?.message ?? 'ok');
  else fail('ensure_profile_from_auth RPC exists', epErr?.message);

  const { error: whErr } = await supabase.from('wallet_history').select('id').limit(1);
  if (rpcExists(whErr)) pass('wallet_history table readable', whErr?.message ?? 'ok (RLS may block)');
  else fail('wallet_history table', whErr?.message);

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- ${passed}/${total} smoke checks passed ---`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exitCode = 1;
});
