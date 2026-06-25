import { useCallback, useEffect, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchFarmerSalesStats,
  loadTraderInventory,
  type FarmerSalesStats,
  type TraderInventoryStats,
} from '@/lib/marketplaceData';
import { MetricSkeleton, ChartSkeleton } from '@/components/design/skeletons';
import { FarmerDashboardSection } from '@/components/dashboard/FarmerDashboardSection';
import { TraderDashboardSection } from '@/components/dashboard/TraderDashboardSection';
import { IndustrialistDashboardSection } from '@/components/dashboard/IndustrialistDashboardSection';
import { CustomerDashboardSection } from '@/components/dashboard/CustomerDashboardSection';
import {
  fetchManufacturingBatches,
  syncIndustrialistProcurementBatches,
  fetchProcessedProducts,
  fetchRoyaltyObligations,
  type ManufacturingBatch,
  type ProcessedProduct,
  type RoyaltyObligation,
} from '@/lib/manufacturingData';
import { SupplyChainValueChart } from '@/components/charts/SupplyChainValueChart';
import { onCommerceDirty } from '@/lib/intelligenceEvents';

export default function Dashboard() {
  const { session, profile } = useAuth();
  const [farmerStats, setFarmerStats] = useState<FarmerSalesStats | null>(null);
  const [traderStats, setTraderStats] = useState<TraderInventoryStats | null>(null);
  const [orders, setOrders] = useState<Array<{ id: string; totalAmount: number; createdAt?: string }>>([]);
  const [batches, setBatches] = useState<ManufacturingBatch[]>([]);
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([]);
  const [obligations, setObligations] = useState<RoyaltyObligation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const role = profile?.role;
  const userId = session?.user?.id;

  const refreshDashboard = useCallback(async () => {
    if (!userId || !role) return;

    setDataLoading(true);
    try {
      if (role === 'farmer') {
        const [stats, obligs] = await Promise.all([
          fetchFarmerSalesStats(userId),
          fetchRoyaltyObligations(),
        ]);
        setFarmerStats(stats);
        setObligations(obligs);
      } else if (role === 'middleman') {
        const [buyerOrders, inventory] = await Promise.all([
          supabase.from('orders').select('id, totalAmount, createdAt').eq('buyerId', userId).order('createdAt', { ascending: false }),
          loadTraderInventory(userId),
        ]);
        if (!buyerOrders.error) setOrders(buyerOrders.data ?? []);
        setTraderStats(inventory);
      } else if (role === 'industrialist') {
        await syncIndustrialistProcurementBatches();
        const [ordersRes, b, p, o] = await Promise.all([
          supabase.from('orders').select('id, totalAmount, createdAt').eq('buyerId', userId).order('createdAt', { ascending: false }),
          fetchManufacturingBatches(),
          fetchProcessedProducts(),
          fetchRoyaltyObligations(),
        ]);
        setOrders(ordersRes.data ?? []);
        setBatches(b);
        setProcessedProducts(p);
        setObligations(o);
      } else {
        const { data } = await supabase
          .from('orders')
          .select('id, totalAmount, createdAt')
          .eq('buyerId', userId)
          .order('createdAt', { ascending: false });
        setOrders(data ?? []);
      }
    } finally {
      setDataLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    void refreshDashboard();
    return onCommerceDirty(() => {
      void refreshDashboard();
    });
  }, [refreshDashboard]);

  const totalSpent = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const roleMetricsLoading = dataLoading || !role;

  return (
    <>
      <SEO title="Dashboard | AgroElevate" description="Your AgroElevate command center." />
      <div className="space-y-8">
        <SupplyChainValueChart />

        {roleMetricsLoading ? (
          <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard metrics">
            <div className="space-y-2">
              <div className="h-8 w-64 rounded-md bg-muted/40 animate-pulse" />
              <div className="h-4 w-48 rounded-md bg-muted/30 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <MetricSkeleton key={i} />
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          <>
            {role === 'farmer' && farmerStats && (
              <FarmerDashboardSection
                stats={farmerStats}
                obligations={obligations}
                userId={userId ?? ''}
                userName={profile?.name}
              />
            )}
            {role === 'middleman' && traderStats && (
              <TraderDashboardSection
                traderStats={traderStats}
                purchaseCount={orders.length}
                totalSpent={totalSpent}
                userName={profile?.name}
              />
            )}
            {role === 'industrialist' && (
              <IndustrialistDashboardSection
                orders={orders}
                batches={batches}
                processedProducts={processedProducts}
                obligations={obligations}
                userId={userId ?? ''}
                userName={profile?.name}
                onRefresh={refreshDashboard}
              />
            )}
            {role === 'customer' && (
              <CustomerDashboardSection orders={orders} userName={profile?.name} />
            )}
            {role && role !== 'farmer' && role !== 'middleman' && role !== 'industrialist' && role !== 'customer' && (
              <CustomerDashboardSection orders={orders} userName={profile?.name} />
            )}
          </>
        )}
      </div>
    </>
  );
}
