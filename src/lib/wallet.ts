import { supabase } from './supabaseClient';

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'transfer_in' | 'transfer_out';
  related_user?: string;
  created_at: string;
}

/**
 * Get the current wallet balance and transaction history for a user.
 */
export async function getWalletInfo(userId: string) {
  // We fetch all wallet_tx where the user is either the buyer (deposit or transfer_out)
  // or they are the receiver of a transfer.
  // Since we use the orders table, a transfer creates TWO rows (one negative, one positive).
  // Wait, in my previous test, I said we could do 1 row or 2 rows. 
  // Let's stick to the 1 row per ledger entry (double-entry simulation):
  // For deposit: buyer_id = user, total_amount = positive, items = [{type: 'deposit'}]
  // For transfer OUT: buyer_id = sender, total_amount = negative, items = [{type: 'transfer', receiver_id: receiver}]
  // For transfer IN: buyer_id = receiver, total_amount = positive, items = [{type: 'transfer', sender_id: sender}]

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'wallet_tx')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching wallet info:', error);
    return { balance: 0, transactions: [] };
  }

  let balance = 0;
  const transactions: WalletTransaction[] = [];

  for (const order of (orders || [])) {
    balance += order.total_amount;

    const item = order.items && order.items[0];
    let type: WalletTransaction['type'] = 'deposit';
    let related_user: string | undefined;

    if (item?.type === 'transfer') {
      if (order.total_amount < 0) {
        type = 'transfer_out';
        related_user = item.receiver_id;
      } else {
        type = 'transfer_in';
        related_user = item.sender_id;
      }
    }

    transactions.push({
      id: order.id,
      amount: order.total_amount,
      type,
      related_user,
      created_at: order.created_at,
    });
  }

  return { balance, transactions };
}

/**
 * Add funds to a user's wallet (Mock Payment).
 */
export async function addFunds(userId: string, amount: number) {
  const { error } = await supabase.from('orders').insert({
    buyer_id: userId,
    total_amount: amount,
    status: 'wallet_tx',
    items: [{ type: 'deposit' }]
  });

  if (error) throw error;
}

/**
 * Transfer funds between users.
 * Creates two ledger entries: one deducting from sender, one adding to receiver.
 */
export async function transferFunds(senderId: string, receiverId: string, amount: number) {
  if (amount <= 0) return;

  const { error } = await supabase.from('orders').insert([
    {
      buyer_id: senderId,
      total_amount: -amount,
      status: 'wallet_tx',
      items: [{ type: 'transfer', receiver_id: receiverId }]
    },
    {
      buyer_id: receiverId,
      total_amount: amount,
      status: 'wallet_tx',
      items: [{ type: 'transfer', sender_id: senderId }]
    }
  ]);

  if (error) throw error;
}
