import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { onIntelligenceDirty } from '@/lib/intelligenceEvents';

/**
 * Subscribes to Supabase realtime commerce events and triggers intelligence refresh.
 * Covers buyer, seller, farmer, royalty, and wallet ledger paths.
 */
export function useIntelligenceRealtime(userId: string | undefined, onRefresh: () => void) {
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onIntelligenceDirty(onRefresh);

    const channel = supabase
      .channel(`intel-refresh-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_history', filter: `userId=eq.${userId}` },
        onRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `buyerId=eq.${userId}` },
        onRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items', filter: `farmerId=eq.${userId}` },
        onRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items', filter: `sellerId=eq.${userId}` },
        onRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items', filter: `originalFarmerId=eq.${userId}` },
        onRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${userId}` },
        onRefresh,
      )
      .subscribe();

    return () => {
      unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [userId, onRefresh]);
}
