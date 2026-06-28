import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntelligenceShell } from '@/components/intelligence/IntelligenceShell';
import { useAuth } from '@/hooks/useAuth';
import { fetchTraderMarketDashboard, type TraderMarketDashboard } from '@/lib/marketIntelligenceApi';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

export default function TraderMarketIntelligence() {
  const { session } = useAuth();
  const [data, setData] = useState<TraderMarketDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      setData(await fetchTraderMarketDashboard(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Trader Market Intelligence" subtitle="Procurement analytics from live mandi data" />
      <IntelligenceShell loading={loading} error={error} onRetry={load}>
        {data && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Best Procurement District', value: data.best_procurement_district },
              { label: 'Cheapest Market', value: data.cheapest_market?.market_name ?? '—' },
              { label: 'Supply Density', value: `${data.supply_density} kg` },
              { label: 'Demand Density', value: data.demand_density },
              { label: 'Avg Procurement Cost', value: `₹${data.avg_procurement_cost}/kg` },
              { label: 'Transport Estimate', value: `₹${data.transport_cost_estimate_per_kg}/kg` },
              { label: 'Profit Margin', value: `${data.potential_profit_margin_pct}%` },
              { label: 'Market Volatility', value: data.market_volatility },
            ].map((c) => (
              <GlassCard key={c.label} className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="font-semibold mt-1">{c.value}</p>
              </GlassCard>
            ))}
          </div>
        )}

        {data?.district_comparison && (
          <GlassCard className="mt-6 p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> District Comparison</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.district_comparison}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="district" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="avg_price" fill="#3b82f6" name="Avg Price ₹/kg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {data?.arbitrage_opportunities && (
          <GlassCard className="mt-6 p-4 space-y-2">
            <h3 className="font-semibold mb-3">Arbitrage Opportunities</h3>
            {data.arbitrage_opportunities.map((o, i) => (
              <div key={i} className="flex flex-wrap justify-between text-sm border-b border-border/30 py-2">
                <span>{String(o.crop)}: Buy {String(o.buy_market)} ₹{String(o.buy_price)} → Sell {String(o.sell_market)} ₹{String(o.sell_price)}</span>
                <Badge variant="outline">+{String(o.margin_pct)}%</Badge>
              </div>
            ))}
          </GlassCard>
        )}
      </IntelligenceShell>
    </>
  );
}
