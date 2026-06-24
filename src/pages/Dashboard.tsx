import { useEffect, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchFarmerSalesStats,
  loadTraderInventory,
  type FarmerSalesStats,
  type TraderInventoryStats,
} from '@/lib/marketplaceData';
import { DashboardSkeleton } from '@/components/design/skeletons';
import { FarmerDashboardSection } from '@/components/dashboard/FarmerDashboardSection';
import { TraderDashboardSection } from '@/components/dashboard/TraderDashboardSection';
import { IndustrialistDashboardSection } from '@/components/dashboard/IndustrialistDashboardSection';
import { CustomerDashboardSection } from '@/components/dashboard/CustomerDashboardSection';
import {
  fetchManufacturingBatches,
  fetchProcessedProducts,
  fetchRoyaltyObligations,
  type ManufacturingBatch,
  type ProcessedProduct,
  type RoyaltyObligation,
} from '@/lib/manufacturingData';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/design/MetricCard';

export default function Dashboard() {
  const { session, profile, loading } = useAuth();
  const [farmerStats, setFarmerStats] = useState<FarmerSalesStats | null>(null);
  const [traderStats, setTraderStats] = useState<TraderInventoryStats | null>(null);
  const [orders, setOrders] = useState<Array<{ id: string; totalAmount: number; createdAt?: string }>>([]);
  const [batches, setBatches] = useState<ManufacturingBatch[]>([]);
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([]);
  const [obligations, setObligations] = useState<RoyaltyObligation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const role = profile?.role;
  const isFarmer = role === 'farmer';
  const isTrader = role === 'middleman';
  const isIndustrialist = role === 'industrialist';
  const isCustomer = role === 'customer';

  const refreshIndustrialData = async () => {
    const [b, p, o] = await Promise.all([
      fetchManufacturingBatches(),
      fetchProcessedProducts(),
      fetchRoyaltyObligations(),
    ]);
    setBatches(b);
    setProcessedProducts(p);
    setObligations(o);
  };

  useEffect(() => {
    if (!session?.user.id) return;

    const load = async () => {
      setDataLoading(true);
      const userId = session.user.id;
      if (isFarmer) {
        const [stats, obligs] = await Promise.all([
          fetchFarmerSalesStats(userId),
          fetchRoyaltyObligations(),
        ]);
        setFarmerStats(stats);
        setObligations(obligs);
      } else if (isTrader) {
        const [buyerOrders, inventory] = await Promise.all([
          supabase.from('orders').select('id, totalAmount, createdAt').eq('buyerId', userId),
          loadTraderInventory(userId),
        ]);
        if (!buyerOrders.error) setOrders(buyerOrders.data ?? []);
        setTraderStats(inventory);
      } else if (isIndustrialist) {
        const { data } = await supabase
          .from('orders')
          .select('id, totalAmount, createdAt')
          .eq('buyerId', userId)
          .order('createdAt', { ascending: false });
        setOrders(data ?? []);
        await refreshIndustrialData();
      } else {
        const { data } = await supabase
          .from('orders')
          .select('id, totalAmount, createdAt')
          .eq('buyerId', userId)
          .order('createdAt', { ascending: false });
        setOrders(data ?? []);
      }
      setDataLoading(false);
    };

    load();
  }, [session, isFarmer, isTrader, isIndustrialist]);

  if (loading || dataLoading) {
    return (
      <>
        <SEO title="Dashboard | AgroElevate" description="Your AgroElevate command center." />
        <DashboardSkeleton />
      </>
    );
  }

  const totalSpent = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);

  return (
    <>
      <SEO title="Dashboard | AgroElevate" description="Your AgroElevate command center." />
      {isFarmer && farmerStats && (
        <FarmerDashboardSection
          stats={farmerStats}
          obligations={obligations}
          userId={session?.user.id ?? ''}
          userName={profile?.name}
        />
      )}
      {isTrader && traderStats && (
        <TraderDashboardSection
          traderStats={traderStats}
          purchaseCount={orders.length}
          totalSpent={totalSpent}
          userName={profile?.name}
        />
      )}
      {isIndustrialist && (
        <IndustrialistDashboardSection
          orders={orders}
          batches={batches}
          processedProducts={processedProducts}
          obligations={obligations}
          userId={session?.user.id ?? ''}
          userName={profile?.name}
          onRefresh={refreshIndustrialData}
        />
      )}
      {isCustomer && (
        <CustomerDashboardSection orders={orders} userName={profile?.name} />
      )}
      {!isFarmer && !isTrader && !isIndustrialist && !isCustomer && (
        <div className="space-y-8">
          <PageHeader title={`Welcome${profile?.name ? `, ${profile.name}` : ''}`} subtitle={`Role: ${role ?? 'user'}`} />
          <div className="grid md:grid-cols-3 gap-4">
            <MetricCard title="Total Orders" value={orders.length} />
            <MetricCard title="Total Spend" value={`₹${totalSpent.toLocaleString()}`} />
            <MetricCard title="Status" value="Active" variant="success" />
          </div>
        </div>
      )}
    </>
  );
}
