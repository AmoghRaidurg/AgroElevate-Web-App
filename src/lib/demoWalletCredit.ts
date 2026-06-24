import { supabase } from './supabaseClient';

export const DEMO_CREDIT_PRESETS = [1000, 5000, 10000] as const;
export type DemoCreditPreset = (typeof DEMO_CREDIT_PRESETS)[number];

export const DEMO_CREDIT_MIN = 1;
export const DEMO_CREDIT_MAX = 100_000;

export interface DemoCreditResult {
  demo_credit_id: string;
  wallet_history_id: string;
  target_user_id: string;
  amount_inr: number;
  balance: number;
}

export interface DemoCreditAuditRow {
  id: string;
  target_user_id: string;
  admin_user_id: string;
  amount_inr: number;
  wallet_history_id: string;
  note: string | null;
  created_at: string;
}

export function isValidDemoCreditAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= DEMO_CREDIT_MIN && amount <= DEMO_CREDIT_MAX;
}

export async function applyDemoWalletCredit(
  targetUserId: string,
  amountInr: number,
): Promise<DemoCreditResult> {
  if (!isValidDemoCreditAmount(amountInr)) {
    throw new Error(`Amount must be between ₹${DEMO_CREDIT_MIN} and ₹${DEMO_CREDIT_MAX.toLocaleString('en-IN')}`);
  }

  const { data, error } = await supabase.rpc('admin_demo_wallet_credit', {
    p_target_user_id: targetUserId.trim(),
    p_amount_inr: amountInr,
  });
  if (error) throw error;
  return data as DemoCreditResult;
}

export async function fetchDemoCreditAudit(): Promise<DemoCreditAuditRow[]> {
  const { data, error } = await supabase
    .from('demo_wallet_credits')
    .select('id, target_user_id, admin_user_id, amount_inr, wallet_history_id, note, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as DemoCreditAuditRow[];
}

/** Probe whether migration 017+ objects exist (admin session required for full access). */
export async function probeDemoCreditBackend(): Promise<{
  rpcAvailable: boolean;
  auditTableAvailable: boolean;
  detail?: string;
}> {
  const { error: rpcErr } = await supabase.rpc('admin_demo_wallet_credit', {
    p_target_user_id: '',
    p_amount_inr: 0,
  });
  const rpcAvailable = !!rpcErr && !/Could not find the function/i.test(rpcErr.message);

  const { error: tblErr } = await supabase.from('demo_wallet_credits').select('id').limit(1);
  const auditTableAvailable = !tblErr || !/does not exist|schema cache/i.test(tblErr.message);

  return {
    rpcAvailable,
    auditTableAvailable,
    detail: rpcErr?.message ?? tblErr?.message,
  };
}
