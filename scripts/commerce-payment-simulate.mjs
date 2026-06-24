/**
 * Simulated Razorpay wallet deposit for CI (service role + confirm_wallet_deposit).
 */
import { createClient } from '@supabase/supabase-js';

export async function simulateWalletDeposit(admin, userId, amountInr) {
  const { data: prep, error: prepErr } = await admin.rpc('prepare_test_payment_intent', {
    p_user_id: userId,
    p_amount_inr: amountInr,
  });
  if (prepErr) throw new Error(`prepare_test_payment_intent: ${prepErr.message}`);

  const paymentId = `pay_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { data: settled, error: settleErr } = await admin.rpc('confirm_wallet_deposit', {
    p_razorpay_order_id: prep.razorpay_order_id,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: prep.amount_paise,
    p_payment_method: 'card',
    p_paid_at_epoch: Math.floor(Date.now() / 1000),
  });
  if (settleErr) throw new Error(`confirm_wallet_deposit: ${settleErr.message}`);
  return settled;
}

export function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
