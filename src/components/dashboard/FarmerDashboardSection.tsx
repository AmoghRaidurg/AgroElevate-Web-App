import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { MetricCard } from '@/components/design/MetricCard';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS, CHART_ANIMATION, chartTooltipStyle } from '@/components/design/ThemedChart';
import { EmptyState } from '@/components/design/skeletons';
import type { FarmerSalesStats } from '@/lib/marketplaceData';
import type { RoyaltyObligation } from '@/lib/manufacturingData';
import { sumPendingObligations, sumSettledObligations } from '@/lib/manufacturingData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { IndianRupee, Sprout, Package, Brain, TrendingUp } from 'lucide-react';

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.forest, CHART_COLORS.warning, CHART_COLORS.muted];

interface Props {
  stats: FarmerSalesStats;
  obligations?: RoyaltyObligation[];
  userId?: string;
  userName?: string;
}

export function FarmerDashboardSection({ stats, obligations = [], userId = '', userName }: Props) {
  const pendingDownstream = sumPendingObligations(obligations, userId);
  const settledDownstream = sumSettledObligations(obligations, userId);
  const cropData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of stats.recentSales) {
      map.set(sale.cropName, (map.get(sale.cropName) ?? 0) + sale.totalPrice);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [stats.recentSales]);

  const revenueTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const sale of stats.recentSales) {
      const d = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—';
      byDate.set(d, (byDate.get(d) ?? 0) + sale.totalPrice);
    }
    return Array.from(byDate.entries()).map(([date, revenue]) => ({ date, revenue }));
  }, [stats.recentSales]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${userName ? `, ${userName}` : ''}`}
        subtitle="Farmer command center — revenue, crops & AI insights"
        actions={
          <>
            <Link to="/marketplace"><Button variant="outline">List Produce</Button></Link>
            <Link to="/intelligence"><Button variant="hero" className="gap-2"><Brain className="h-4 w-4" /> Intelligence</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroMetric label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={<IndianRupee className="h-5 w-5" />} variant="primary" subtitle="Direct + royalty" />
        <MetricCard title="Direct Sales" value={`₹${stats.directSalesRevenue.toLocaleString()}`} icon={TrendingUp} variant="success" />
        <MetricCard title="Royalty Income" value={`₹${stats.royaltyRevenue.toLocaleString()}`} icon={Sprout} variant="highlight" />
        <MetricCard title="Pending Downstream" value={`₹${pendingDownstream.toLocaleString()}`} icon={TrendingUp} variant="accent" />
      </div>

      {(settledDownstream > 0 || pendingDownstream > 0) && (
        <p className="text-sm text-muted-foreground">
          Downstream manufacturing royalties: ₹{settledDownstream.toLocaleString()} settled
          {pendingDownstream > 0 ? ` · ₹${pendingDownstream.toLocaleString()} pending` : ''}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        <MetricCard title="Active Listings" value={stats.activeListings} icon={Package} variant="accent" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue by Crop" description="Distribution across your recent sales">
          <ThemedChart height={280}>
            {cropData.length > 0 ? (
              <PieChart>
                <Pie data={cropData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {cropData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={chartTooltipStyle} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No sales data yet</div>
            )}
          </ThemedChart>
        </ChartCard>

        <ChartCard title="Revenue Trend" description="Recent sales over time">
          <ThemedChart height={280}>
            {revenueTrend.length > 0 ? (
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 4 }} {...CHART_ANIMATION} />
              </LineChart>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No trend data yet</div>
            )}
          </ThemedChart>
        </ChartCard>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Sales</h3>
          <Link to="/orders" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {stats.recentSales.length === 0 ? (
          <EmptyState title="No sales yet" description="List produce on the Marketplace to start selling." action={<Link to="/marketplace"><Button variant="hero">Go to Marketplace</Button></Link>} />
        ) : (
          <div className="space-y-3">
            {stats.recentSales.map((sale) => (
              <div key={sale.orderItemId} className="flex justify-between items-center border-b border-border/50 pb-3 last:border-0 text-sm">
                <div>
                  <p className="font-medium">{sale.cropName} — {sale.quantity} kg</p>
                  <p className="text-muted-foreground text-xs">Buyer: {sale.buyerName} ({sale.buyerRole})</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary tabular-nums">₹{sale.totalPrice.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-elevated rounded-2xl p-6 border-highlight/25 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-highlight/15 blur-[60px] rounded-full pointer-events-none" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="p-3 rounded-xl bg-highlight/15 border border-highlight/25">
            <Brain className="h-8 w-8 text-highlight" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-display font-bold text-lg">AI Crop Recommendations</h3>
            <p className="text-sm text-muted-foreground mt-0.5">District-aware advisory, demand forecasts & income scenarios.</p>
          </div>
          <Link to="/intelligence"><Button variant="highlight" className="gap-2"><Brain className="h-4 w-4" /> Open Intelligence</Button></Link>
        </div>
      </div>
    </div>
  );
}
