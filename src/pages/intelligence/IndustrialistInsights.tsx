import { useCallback, useEffect, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { fetchIndustrialistDashboard, type IndustrialistDashboard } from '@/lib/aiApi';
import { IntelligenceShell, InsightFeed } from '@/components/intelligence/IntelligenceShell';
import { IntelligenceHero } from '@/components/intelligence/IntelligenceHero';
import { IntelligencePanel } from '@/components/intelligence/IntelligencePanel';
import { TrendBadge, ConfidenceBar } from '@/components/intelligence/IntelligenceMetrics';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS } from '@/components/design/ThemedChart';
import { Factory, ShieldAlert, Users } from 'lucide-react';

export default function IndustrialistInsights() {
  const { session } = useAuth();
  const [data, setData] = useState<IndustrialistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIndustrialistDashboard(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const ind = data?.industrialist;
  const planning = ind?.procurement_planning ?? ind?.procurement_forecast ?? [];
  const risks = ind?.supply_risk_alerts ?? ind?.supply_risks ?? [];
  const costs = ind?.future_cost_forecasting ?? ind?.cost_forecasting;

  const costChart = costs ? [
    { label: 'Current', optimistic: costs.scenarios?.optimistic ?? costs.current_annual_spend, realistic: costs.current_annual_spend, conservative: costs.current_annual_spend },
    { label: '1 Year', optimistic: costs.scenarios?.optimistic ?? costs.forecast_1y, realistic: costs.forecast_1y, conservative: (costs.forecast_1y ?? 0) * 1.05 },
    { label: '3 Years', optimistic: (costs.forecast_3y ?? 0) * 0.95, realistic: costs.forecast_3y, conservative: (costs.forecast_3y ?? 0) * 1.1 },
  ] : [];

  return (
    <>
      <SEO title="Industrialist Intelligence | AgroElevate" />
      <IntelligenceHero
        title="Industrialist Intelligence"
        subtitle="Procurement planning, supplier reliability & cost forecasting"
        loading={loading}
        useSynthetic={data?.use_synthetic}
        onRefresh={load}
        metrics={costs && ind ? [
          { label: 'Procurement Items', value: planning.length },
          { label: 'Suppliers', value: ind.supplier_ranking.length },
          { label: 'Supply Risks', value: risks.length },
          { label: 'Annual Spend', value: `₹${(costs.current_annual_spend / 100000).toFixed(1)}L` },
        ] : []}
      />
      <IntelligenceShell loading={loading} error={error}>
        {data && ind && costs && (
          <div className="space-y-8">
            <IntelligencePanel title="Procurement Planning" icon={Factory} description="Monthly volume & cost estimates">
              {planning.map((p) => (
                <div key={p.crop_name} className="flex justify-between items-center border-b border-white/10 pb-2 mb-2 text-sm last:border-0">
                  <div>
                    <p className="font-semibold">{p.crop_name}</p>
                    <p className="text-xs text-muted-foreground">{p.forecast_monthly_kg?.toLocaleString()} kg/month</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">₹{p.total_cost_estimate?.toLocaleString()}</p>
                    {p.priority && <Badge variant="outline" className="mt-1">{p.priority}</Badge>}
                    {p.demand_trend && <TrendBadge trend={p.demand_trend} />}
                  </div>
                </div>
              ))}
            </IntelligencePanel>

            <div className="grid lg:grid-cols-2 gap-6">
              <IntelligencePanel title="Supplier Reliability" icon={Users}>
                {ind.supplier_ranking.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Using marketplace-wide supplier aggregates.</p>
                ) : (
                  ind.supplier_ranking.map((s, i) => (
                    <div key={s.farmer_id} className="p-3 border border-white/10 rounded-xl mb-2 bg-background/20">
                      <div className="flex justify-between text-sm">
                        <span>#{i + 1} Supplier {s.farmer_id.slice(0, 8)}…</span>
                        <span className="font-medium">{(s.reliability_score * 100).toFixed(0)}%</span>
                      </div>
                      <ConfidenceBar value={s.reliability_score} label="Reliability" />
                    </div>
                  ))
                )}
              </IntelligencePanel>
              <IntelligencePanel title="Supply Risk Alerts" icon={ShieldAlert}>
                {risks.map((r) => (
                  <div key={r.crop_name} className="p-3 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm mb-2">
                    <Badge variant={r.risk_level === 'high' ? 'destructive' : 'secondary'}>{r.risk_level}</Badge>
                    <p className="font-medium mt-1">{r.crop_name}</p>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                ))}
              </IntelligencePanel>
            </div>

            <ChartCard title="Future Cost Forecasting" variant="intelligence">
              <ThemedChart height={260}>
                <LineChart data={costChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="optimistic" stroke={CHART_COLORS.primary} name="Optimistic" />
                  <Line type="monotone" dataKey="realistic" stroke={CHART_COLORS.accent} strokeWidth={2} name="Realistic" />
                  <Line type="monotone" dataKey="conservative" stroke={CHART_COLORS.danger} name="Conservative" />
                </LineChart>
              </ThemedChart>
              <div className="px-4 pb-4"><ConfidenceBar value={costs.confidence} label="Forecast confidence" /></div>
            </ChartCard>

            <InsightFeed insights={data.insights ?? []} />
          </div>
        )}
      </IntelligenceShell>
    </>
  );
}
