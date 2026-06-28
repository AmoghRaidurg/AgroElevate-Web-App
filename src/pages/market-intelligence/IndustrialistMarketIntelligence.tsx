import { useCallback, useEffect, useState } from 'react';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntelligenceShell } from '@/components/intelligence/IntelligenceShell';
import { useAuth } from '@/hooks/useAuth';
import { fetchIndustrialistMarketDashboard, type IndustrialistMarketDashboard } from '@/lib/marketIntelligenceApi';
import { DataSourceBadge } from '@/components/market-intelligence/DataSourceBadge';
import { Badge } from '@/components/ui/badge';
import { Factory } from 'lucide-react';

export default function IndustrialistMarketIntelligence() {
  const { session } = useAuth();
  const [data, setData] = useState<IndustrialistMarketDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      setData(await fetchIndustrialistMarketDashboard(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Industrial Procurement Intelligence"
        subtitle="Raw material availability & cost forecasting"
        actions={<DataSourceBadge dataSource={data?.data_source} />}
      />
      <IntelligenceShell loading={loading} error={error} onRetry={load}>
        {data && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Supplier Density', value: data.supplier_density },
                { label: 'Avg Procurement Cost', value: `₹${data.avg_procurement_cost}/kg` },
                { label: 'Cost Trend', value: data.manufacturing_cost_trend },
                { label: 'Recommended Region', value: data.recommended_procurement_region },
              ].map((c) => (
                <GlassCard key={c.label} className="p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold mt-1">{c.value}</p>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="mt-6 p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Factory className="h-4 w-4" /> Raw Material Availability</h3>
              <div className="space-y-2">
                {data.raw_material_availability.map((r) => (
                  <div key={r.crop} className="flex flex-wrap justify-between text-sm border-b border-border/30 py-2">
                    <span className="font-medium">{r.crop}</span>
                    <span>₹{r.avg_price}/kg</span>
                    <span>{r.supply_kg.toLocaleString()} kg supply</span>
                    <Badge variant="secondary">{r.markets_count} markets</Badge>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="mt-6 p-4">
              <h3 className="font-semibold mb-3">Regional Availability Heatmap</h3>
              <div className="grid sm:grid-cols-3 gap-2">
                {data.regional_availability.map((d) => (
                  <div key={d.district} className={`rounded-lg p-2 text-xs border ${
                    d.level === 'High' ? 'bg-green-500/10' : d.level === 'Medium' ? 'bg-amber-500/10' : 'bg-red-500/10'
                  }`}>
                    {d.district}: {d.demand_score} ({d.level})
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </IntelligenceShell>
    </>
  );
}
