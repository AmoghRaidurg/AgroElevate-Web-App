import { supabase } from './supabaseClient';
import type { WalletHistoryType } from './commerceMeta';
import { WALLET_TYPE_LABELS } from './commerceMeta';

export interface WalletTransaction {
  id: string;
  amount: number;
  type: WalletHistoryType;
  description?: string;
  created_at: string;
  order_id?: string;
}

export interface WalletInfo {
  balance: number;
  transactions: WalletTransaction[];
  error?: string;
}

const KNOWN_TYPES = new Set<string>(Object.keys(WALLET_TYPE_LABELS));

function mapHistoryType(rowType: string, amount: number): WalletHistoryType {
  if (KNOWN_TYPES.has(rowType)) return rowType as WalletHistoryType;
  if (amount < 0) return 'purchase';
  return 'transfer_in';
}

export async function getWalletInfo(userId: string): Promise<WalletInfo> {
  const { data: balanceData, error: balanceError } = await supabase.rpc('get_wallet_balance');

  if (balanceError) {
    console.error('Error fetching wallet balance:', balanceError);
    return { balance: 0, transactions: [], error: balanceError.message };
  }

  const { data: history, error: txError } = await supabase
    .from('wallet_history')
    .select('id, type, amount, description, createdAt, orderId')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });

  if (txError) {
    console.error('Error fetching wallet transactions:', txError);
    return {
      balance: Number(balanceData ?? 0),
      transactions: [],
      error: txError.message,
    };
  }

  const transactions: WalletTransaction[] = (history || []).map((row) => {
    const amount = Number(row.amount ?? 0);
    return {
      id: row.id,
      amount,
      type: mapHistoryType(row.type ?? '', amount),
      description: row.description ?? undefined,
      created_at: row.createdAt,
      order_id: row.orderId ?? undefined,
    };
  });

  return { balance: Number(balanceData ?? 0), transactions };
}

export async function addFunds(_userId: string, amount: number) {
  const { error } = await supabase.rpc('add_funds', { p_amount: amount });
  if (error) throw error;
}

export async function transferFunds(receiverId: string, amount: number) {
  const { error } = await supabase.rpc('transfer_funds', {
    p_receiver_id: receiverId.trim(),
    p_amount: amount,
  });
  if (error) throw error;
}

export async function fetchWalletSumByTypes(
  userId: string,
  types: WalletHistoryType[]
): Promise<number> {
  const { data, error } = await supabase
    .from('wallet_history')
    .select('amount')
    .eq('userId', userId)
    .in('type', types);

  if (error) {
    console.error('Wallet sum error:', error);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function fetchFarmerRoyaltyIncome(farmerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('wallet_history')
    .select('amount')
    .eq('userId', farmerId)
    .eq('type', 'royalty_income');

  if (error) {
    console.error('Farmer royalty fetch error:', error);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function fetchFarmerDirectSalesIncome(farmerId: string): Promise<number> {
  return fetchWalletSumByTypes(farmerId, ['sale_income']);
}

export { WALLET_TYPE_LABELS };
