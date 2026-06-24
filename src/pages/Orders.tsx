import { useEffect, useMemo, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { OrderStatusBadge } from '@/components/design/OrderStatusBadge';
import { DashboardSkeleton, EmptyState } from '@/components/design/skeletons';
import { Search } from 'lucide-react';
import {
  fetchBuyerOrders,
  fetchFarmerSalesOrders,
  fetchTraderResales,
  fetchSupplierProfiles,
  type OrderWithItems,
  type TraderResale,
} from '@/lib/marketplaceData';

export default function Orders() {
  const { session, profile, loading } = useAuth();
  const [buyerOrders, setBuyerOrders] = useState<OrderWithItems[]>([]);
  const [farmerSales, setFarmerSales] = useState<Awaited<ReturnType<typeof fetchFarmerSalesOrders>>>([]);
  const [traderResales, setTraderResales] = useState<TraderResale[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, { name: string; email?: string }>>(new Map());
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const role = profile?.role;
  const isFarmer = role === 'farmer';
  const isTrader = role === 'middleman';
  const isIndustrialist = role === 'industrialist';

  useEffect(() => {
    if (!session?.user.id) return;
    const load = async () => {
      setPageLoading(true);
      const userId = session.user.id;
      if (isFarmer) {
        setFarmerSales(await fetchFarmerSalesOrders(userId));
      } else if (isTrader) {
        const [purchases, resales] = await Promise.all([fetchBuyerOrders(userId), fetchTraderResales(userId)]);
        setBuyerOrders(purchases);
        setTraderResales(resales);
      } else if (isIndustrialist) {
        const orders = await fetchBuyerOrders(userId);
        setBuyerOrders(orders);
        const farmerIds = orders.flatMap((o) => o.items.map((i) => i.farmerId).filter(Boolean) as string[]);
        setSupplierMap(await fetchSupplierProfiles(farmerIds));
      } else {
        setBuyerOrders(await fetchBuyerOrders(userId));
      }
      setPageLoading(false);
    };
    load();
  }, [session, isFarmer, isTrader, isIndustrialist]);

  const filteredBuyerOrders = useMemo(() => {
    return buyerOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status?.toLowerCase() !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchId = o.id.toLowerCase().includes(q);
        const matchItem = o.items.some((i) => i.cropName.toLowerCase().includes(q));
        if (!matchId && !matchItem) return false;
      }
      return true;
    });
  }, [buyerOrders, search, statusFilter]);

  const farmerRevenue = farmerSales.reduce((s, r) => s + r.totalPrice, 0);

  if (loading || pageLoading) {
    return (
      <>
        <SEO title="Orders | AgroElevate" />
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <>
      <SEO title="Orders | AgroElevate" description="View your order history" />
      <PageHeader title="Orders" subtitle={`${role ?? 'user'} · order history & tracking`} />

      {!isFarmer && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders or crops..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted/30" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-muted/30"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isFarmer && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <HeroMetric label="Sales Orders" value={farmerSales.length} />
            <HeroMetric label="Direct Sales" value={`₹${farmerSales.reduce((s, r) => s + r.totalPrice, 0).toLocaleString()}`} />
            <HeroMetric label="Quantity Sold" value={`${farmerSales.reduce((s, r) => s + r.quantity, 0).toLocaleString()} kg`} />
          </div>
          {farmerSales.length === 0 ? (
            <EmptyState title="No sales yet" description="List produce on the Marketplace to receive orders." />
          ) : (
            <div className="space-y-4">
              {farmerSales.map((sale) => (
                <div key={sale.orderItemId} className="glass-card rounded-xl p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{sale.cropName}</p>
                      <p className="text-sm text-muted-foreground">{sale.quantity} kg @ ₹{sale.pricePerUnit}/kg</p>
                      <p className="text-xs text-muted-foreground mt-2">Buyer: {sale.buyerName} ({sale.buyerRole})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary tabular-nums">₹{sale.totalPrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-l-2 border-primary/40 pl-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">Sale completed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isTrader && (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-3 gap-4">
            <HeroMetric label="Purchases" value={buyerOrders.length} />
            <HeroMetric label="Resales" value={traderResales.length} />
            <HeroMetric label="Profit Est." value={`₹${traderResales.reduce((s, r) => s + r.profitEstimate, 0).toLocaleString()}`} />
          </div>
          <OrderList orders={filteredBuyerOrders} title="Purchase History" />
          <div className="space-y-4">
            <h3 className="font-semibold">Resale History</h3>
            {traderResales.map((sale) => (
              <div key={sale.orderItemId} className="glass-card rounded-xl p-5">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{sale.cropName}</p>
                    <p className="text-sm text-muted-foreground">Sold {sale.quantity} kg @ ₹{sale.salePrice}/kg</p>
                  </div>
                  <p className={`font-bold ${sale.profitEstimate >= 0 ? 'text-primary' : 'text-red-400'}`}>₹{sale.profitEstimate.toLocaleString()} est.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isIndustrialist && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <HeroMetric label="Procurement Orders" value={buyerOrders.length} />
            <HeroMetric label="Total Spend" value={`₹${buyerOrders.reduce((s, o) => s + Number(o.totalAmount), 0).toLocaleString()}`} />
            <HeroMetric
              label="Royalty Paid"
              value={`₹${buyerOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + Number(i.royaltyAmount ?? 0), 0), 0).toLocaleString()}`}
            />
          </div>
          <OrderList orders={filteredBuyerOrders} title="Procurement History" supplierMap={supplierMap} />
        </div>
      )}

      {!isFarmer && !isTrader && !isIndustrialist && (
        <OrderList orders={filteredBuyerOrders} title="Your Orders" />
      )}
    </>
  );
}

function OrderList({
  orders,
  title,
  supplierMap,
}: {
  orders: OrderWithItems[];
  title: string;
  supplierMap?: Map<string, { name: string; email?: string }>;
}) {
  if (orders.length === 0) return <EmptyState title="No orders found" description="Try adjusting your filters or visit the Marketplace." />;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {orders.map((order) => (
        <div key={order.id} className="glass-card rounded-xl p-5">
          <div className="flex flex-wrap justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">#{order.id.slice(0, 8)}</p>
              <OrderStatusBadge status={order.status ?? 'pending'} />
            </div>
            <p className="font-bold text-primary tabular-nums">₹{Number(order.totalAmount).toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{new Date(order.createdAt).toLocaleString()}</p>
          <div className="border-l-2 border-accent/30 pl-4 space-y-2">
            {order.items.map((item) => {
              const supplier = item.farmerId && supplierMap ? supplierMap.get(item.farmerId) : undefined;
              return (
                <div key={item.id} className="flex justify-between text-sm gap-4">
                  <div className="min-w-0">
                    <span className="font-medium">{item.cropName}</span>
                    <span className="text-muted-foreground"> × {item.quantity} kg</span>
                    {supplier && <p className="text-xs text-muted-foreground">Seller: {supplier.name}</p>}
                    {Number(item.royaltyAmount) > 0 && (
                      <p className="text-xs text-highlight">Royalty: ₹{Number(item.royaltyAmount).toLocaleString()} ({item.royaltyPercent}%)</p>
                    )}
                    {item.ownershipChain && item.ownershipChain.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        Chain: {item.ownershipChain.map((c) => c.role).join(' → ')}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums shrink-0">₹{Number(item.totalPrice).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
