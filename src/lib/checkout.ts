import { supabase } from './supabaseClient';

export interface CartItem {
  id: string;
  qty: number;
}

export interface CheckoutResult {
  order_id: string;
  total_amount: number;
  item_count: number;
}

/**
 * Atomic marketplace checkout via server-side RPC.
 */
export async function checkoutOrder(cart: CartItem[]): Promise<CheckoutResult> {
  const { data, error } = await supabase.rpc('checkout_order', { cart });

  if (error) throw error;
  return data as CheckoutResult;
}
