import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { MetricCard } from '@/components/design/MetricCard';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS } from '@/components/design/ThemedChart';
import type { TraderInventoryStats } from '@/lib/marketplaceData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Package, ShoppingCart, Brain, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  traderStats: TraderInventoryStats;
  purchaseCount: number;
  totalSpent: number;
  userName?: string;
}

export function TraderDashboardSection({ traderStats, purchaseCount, totalSpent, userName }: Props) {
  const inventoryChart = [
    { label: 'Unlisted', kg: traderStats.totalRemainingKg },
    { label: 'Listed', kg: traderStats.totalListedKg },
  ];

  const topItems = traderStats.items.slice(0, 5).map((i) => ({
    name: i.name.length > 12 ? `${i.name.slice(0, 12)}…` : i.name,
    remaining: i.remainingQty,
    listed: i.listedQty,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${userName ? `, ${userName}` : ''}`}
        subtitle="Trader operations — inventory, demand & opportunities"
        actions={
          <>
            <Link to="/marketplace"><Button variant="outline">Marketplace</Button></Link>
            <Link to="/intelligence"><Button variant="hero" className="gap-2"><Brain className="h-4 w-4" /> Intelligence</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroMetric
          label="Inventory On Hand"
          value={`${(traderStats.totalRemainingKg + traderStats.totalListedKg).toLocaleString()} kg`}
          subtitle={`${traderStats.totalRemainingKg} unlisted · ${traderStats.totalListedKg} listed`}
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard title="Active Listings" value={traderStats.activeListingCount} icon={TrendingUp} variant="success" />
        <MetricCard title="Purchases" value={purchaseCount} icon={ShoppingCart} />
        <MetricCard title="Procurement Spend" value={`₹${totalSpent.toLocaleString()}`} variant="accent" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Inventory Breakdown" description="Listed vs unlisted stock">
          <ThemedChart height={260}>
            <BarChart data={inventoryChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
              <Bar dataKey="kg" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ThemedChart>
        </ChartCard>

        <ChartCard title="Top Inventory Items" description="Remaining vs listed by crop">
          <ThemedChart height={260}>
            {topItems.length > 0 ? (
              <BarChart data={topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis type="number" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'hsl(215 15% 58%)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="remaining" fill={CHART_COLORS.forest} name="Unlisted" stackId="a" />
                <Bar dataKey="listed" fill={CHART_COLORS.accent} name="Listed" stackId="a" />
              </BarChart>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Buy from farmers to build inventory</div>
            )}
          </ThemedChart>
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-elevated rounded-2xl p-6 border-amber-500/25">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <h3 className="font-display font-bold">Demand Analytics</h3>
              <p className="text-sm text-muted-foreground">Buy opportunities & price forecasts in Intelligence.</p>
            </div>
            <Link to="/intelligence"><Button size="sm" variant="accent">View</Button></Link>
          </div>
        </div>
        <div className="glass-elevated rounded-2xl p-6 border-primary/25">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/25">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <h3 className="font-display font-bold">Profit Opportunities</h3>
              <p className="text-sm text-muted-foreground">Ranked buy scores & resale margins in AI dashboard.</p>
            </div>
            <Link to="/intelligence"><Button size="sm" variant="highlight">Explore</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
