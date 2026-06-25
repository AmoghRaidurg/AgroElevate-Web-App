import { useCallback, useEffect, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { fetchTraderDashboard, type TraderDashboard } from '@/lib/aiApi';
import { IntelligenceShell, InsightFeed } from '@/components/intelligence/IntelligenceShell';
import { IntelligenceHero } from '@/components/intelligence/IntelligenceHero';
import { IntelligencePanel } from '@/components/intelligence/IntelligencePanel';
import { TrendBadge, ConfidenceBar } from '@/components/intelligence/IntelligenceMetrics';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS } from '@/components/design/ThemedChart';
import { AiStatusBanner } from '@/components/intelligence/AiStatusBanner';
import { InsufficientDataPanel } from '@/components/intelligence/InsufficientDataPanel';
import { AlertTriangle, ShoppingCart, TrendingUp, Package } from 'lucide-react';

export default function TraderInsights() {
  const { session } = useAuth();
  const [data, setData] = useState<TraderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTraderDashboard(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const t = data?.trader;
  const health = t?.inventory_health ?? { score: t?.inventory_optimization?.health_score ?? 0, label: t?.inventory_optimization?.health_label ?? '—' };

  return (
    <>
      <SEO title="Trader Intelligence | AgroElevate" />
      <IntelligenceHero
        title="Trader Intelligence"
        subtitle="Buy opportunities, price forecasts & inventory health"
        loading={loading}
        useSynthetic={data?.use_synthetic}
        onRefresh={load}
        metrics={t ? [
          { label: 'Inventory', value: `${t.inventory_optimization.current_kg.toLocaleString()} kg` },
          { label: 'Health', value: `${health.score}/100`, subtitle: health.label },
          { label: 'Demand Alerts', value: t.demand_alerts?.length ?? 0 },
          { label: 'Buy Opportunities', value: t.best_buy_opportunities?.length ?? 0 },
        ] : []}
      />
      <IntelligenceShell loading={loading} error={error} onRetry={load} fallback={data?._fallback}>
        {data && (
          <div className="space-y-8">
            <AiStatusBanner />
            {!t || data._fallback ? (
              <InsufficientDataPanel description="Trader intelligence requires AI service connectivity and marketplace activity." />
            ) : (
            <>
            <div className="grid lg:grid-cols-2 gap-6">
              <IntelligencePanel title="Best Buy Opportunities" icon={ShoppingCart} description="AI-ranked procurement windows">
                <div className="space-y-3">
                  {(t.best_buy_opportunities ?? []).map((b) => (
                    <div key={b.crop_name} className="p-3 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm">
                      <div className="flex justify-between">
                        <p className="font-semibold">{b.crop_name}</p>
                        <Badge className="bg-primary/20 text-primary border-primary/30">Score {b.buy_score}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{b.reason}</p>
                      <div className="flex gap-2 mt-2 items-center">
                        <TrendBadge trend={b.demand_trend} />
                        <span className="text-xs tabular-nums">₹{b.current_price} → ₹{b.projected_price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </IntelligencePanel>
              <IntelligencePanel title="Profit Opportunity Ranking" icon={TrendingUp}>
                {t.profit_opportunities.map((p, i) => (
                  <div key={p.crop_name} className="flex justify-between border-b border-white/10 pb-2 mb-2 text-sm last:border-0">
                    <span>#{i + 1} {p.crop_name}</span>
                    <span className="font-medium text-primary tabular-nums">{p.estimated_margin_pct}% · ₹{p.suggested_sell_price}/kg</span>
                  </div>
                ))}
              </IntelligencePanel>
            </div>

            {t.demand_alerts && t.demand_alerts.length > 0 && (
              <IntelligencePanel title="Demand Alerts" icon={AlertTriangle} description="High-priority market signals">
                <div className="grid sm:grid-cols-2 gap-2">
                  {t.demand_alerts.map((a) => (
                    <div key={a.crop_name} className="p-3 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm text-sm">
                      <Badge variant={a.priority === 'high' ? 'destructive' : 'secondary'}>{a.priority}</Badge>
                      <p className="font-medium mt-1">{a.crop_name}</p>
                      <p className="text-muted-foreground">{a.message}</p>
                    </div>
                  ))}
                </div>
              </IntelligencePanel>
            )}

            <ChartCard title="Future Price Prediction" variant="intelligence">
              <ThemedChart height={260}>
                <BarChart data={t.price_forecasts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis dataKey="crop_name" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
                  <Bar dataKey="current_price" fill={CHART_COLORS.muted} name="Now" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="forecast_6m" fill={CHART_COLORS.warning} name="6 months" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ThemedChart>
            </ChartCard>

            <IntelligencePanel title="Inventory Optimization" icon={Package}>
              <ConfidenceBar value={health.score / 100} label="Inventory Health" />
              <div className="mt-4 space-y-2">
                {t.inventory_optimization.recommendations.map((r) => (
                  <div key={r.crop_name} className="p-2 border border-white/10 rounded-lg text-sm flex justify-between bg-background/20">
                    <span className="font-medium">{r.crop_name}</span>
                    <Badge variant="outline">{r.action.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            </IntelligencePanel>

            <InsightFeed insights={data.insights ?? []} />
            </>
            )}
          </div>
        )}
      </IntelligenceShell>
    </>
  );
}
