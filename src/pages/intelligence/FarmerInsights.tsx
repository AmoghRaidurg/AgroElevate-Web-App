import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { fetchFarmerDashboard, type FarmerDashboard } from '@/lib/aiApi';
import { useIntelligenceRealtime } from '@/hooks/useIntelligenceRealtime';
import { IntelligenceShell, InsightFeed } from '@/components/intelligence/IntelligenceShell';
import { IntelligenceHero } from '@/components/intelligence/IntelligenceHero';
import { IntelligencePanel } from '@/components/intelligence/IntelligencePanel';
import { CopilotPanel } from '@/components/intelligence/CopilotPanel';
import { TrendBadge, ConfidenceBar, RiskIndicator, MetricPill } from '@/components/intelligence/IntelligenceMetrics';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS, chartTooltipStyle } from '@/components/design/ThemedChart';
import { FarmerIncomeProjectionChart } from '@/components/charts/FarmerIncomeProjectionChart';
import { AiStatusBanner } from '@/components/intelligence/AiStatusBanner';
import { InsufficientDataPanel } from '@/components/intelligence/InsufficientDataPanel';
import { MapPin, Sprout, Cloud } from 'lucide-react';

export default function FarmerInsights() {
  const { session, profile } = useAuth();
  const [data, setData] = useState<FarmerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchFarmerDashboard(session.user.id, profile?.address));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [session, profile?.address]);

  useEffect(() => { load(); }, [load]);
  useIntelligenceRealtime(session?.user.id, load);

  const realistic = data?.income_scenarios?.realistic ?? data?.income_forecasts?.filter((f) => f.scenario === 'realistic' || !f.scenario) ?? [];
  const incomeChart = useMemo(() => {
    const scenarios = ['optimistic', 'realistic', 'conservative'] as const;
    const horizons = [1, 3, 5, 10];
    return horizons.map((h) => {
      const row: Record<string, string | number> = { horizon: `${h}y` };
      for (const sc of scenarios) {
        const f = data?.income_scenarios?.[sc]?.find((x) => x.horizon_years === h)
          ?? data?.income_forecasts?.find((x) => x.horizon_years === h && x.scenario === sc);
        if (f) row[sc] = f.projected_revenue;
      }
      return row;
    });
  }, [data]);

  const demandData = data?.demand_intelligence ?? data?.market_predictions ?? [];
  const topRec = data?.recommendations?.[0];

  return (
    <>
      <SEO title="Farmer Intelligence | AgroElevate" />
      <IntelligenceHero
        title="Farmer Intelligence"
        subtitle="India-focused crop advisory · district & season aware"
        loading={loading}
        useSynthetic={data?.use_synthetic}
        modelVersion={data?.model_version ?? 'v2'}
        onRefresh={load}
        metrics={data ? [
          { label: 'Top Crop', value: topRec?.crop_name ?? '—' },
          { label: 'Expected Profit', value: topRec ? `₹${topRec.expected_profitability.toLocaleString()}` : '—' },
          { label: 'Demand Score', value: topRec?.expected_demand?.toFixed(0) ?? '—' },
          { label: 'Confidence', value: topRec ? `${Math.round((topRec.confidence_score ?? 0.5) * 100)}%` : '—' },
        ] : []}
      >
        {data?.geo && (
          <div className="flex flex-wrap gap-2 items-center mt-4">
            <MapPin className="h-4 w-4 text-accent" />
            <Badge className="bg-primary/20 text-primary border-primary/30">{data.geo.state}</Badge>
            {data.geo.district && <Badge variant="outline">{data.geo.district}</Badge>}
            <Badge variant="secondary">{data.geo.region}</Badge>
            {topRec?.season && <MetricPill label="Season" value={topRec.season.toUpperCase()} />}
          </div>
        )}
      </IntelligenceHero>

      <IntelligenceShell loading={loading} error={error} onRetry={load} fallback={data?._fallback}>
        {data && session && (
          <div className="space-y-8">
            <AiStatusBanner />
            {data.weather && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-border/50 bg-muted/20 px-4 py-2">
                <Cloud className="h-4 w-4 text-accent" />
                {data.weather.temperature_c}°C · rain {data.weather.rain_probability_pct}% — {data.weather.farming_note}
              </div>
            )}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <IntelligencePanel title="Top 5 Crop Recommendations" icon={Sprout}>
                  <div className="space-y-4">
                    {data.recommendations?.map((r) => (
                      <div key={r.rank} className="p-4 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-lg font-bold">#{r.rank} {r.crop_name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Yield ~{r.expected_yield_quintals_per_acre ?? '—'} qtl/acre · Demand {r.expected_demand?.toFixed(0) ?? '—'}/100
                            </p>
                          </div>
                          <Badge className="bg-primary/90">₹{r.expected_profitability.toLocaleString()}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <ConfidenceBar value={r.suitability_score ?? r.confidence_score} label="Suitability" />
                          <ConfidenceBar value={r.profitability_score ?? 0.5} label="Profitability" />
                          <RiskIndicator score={r.risk_score} />
                        </div>
                        {r.explanation && (
                          <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border/30 pt-2">{r.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title="Demand Prediction" description="Market demand scores with confidence indicators">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {demandData.map((m) => (
                      <div key={m.crop_name} className="p-3 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-semibold">{m.crop_name}</p>
                          <TrendBadge trend={'demand_trend' in m ? m.demand_trend : m.trend} />
                        </div>
                        <p className="text-sm">Demand: {m.demand_score.toFixed(0)}/100</p>
                        <ConfidenceBar value={'market_confidence' in m ? m.market_confidence : m.demand_confidence} label="Confidence" />
                      </div>
                    ))}
                  </div>
                </IntelligencePanel>
              </div>
              <CopilotPanel userId={session.user.id} role="farmer" location={profile?.address} />
            </div>

            <FarmerIncomeProjectionChart />

            <ChartCard title="Income Forecast — 3 Scenarios" description="Optimistic, realistic & conservative projections" variant="intelligence">
              {data.income_insufficient_data ? (
                <InsufficientDataPanel />
              ) : (
              <>
              <Tabs defaultValue="chart">
                <TabsList className="mb-4">
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                  <TabsTrigger value="table">Details</TabsTrigger>
                </TabsList>
                <TabsContent value="chart">
                  <ThemedChart height={300}>
                    <LineChart data={incomeChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                      <XAxis dataKey="horizon" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="optimistic" stroke={CHART_COLORS.primary} strokeWidth={2} name="Optimistic" />
                      <Line type="monotone" dataKey="realistic" stroke={CHART_COLORS.accent} strokeWidth={3} name="Realistic" />
                      <Line type="monotone" dataKey="conservative" stroke={CHART_COLORS.warning} strokeWidth={2} name="Conservative" />
                    </LineChart>
                  </ThemedChart>
                </TabsContent>
                <TabsContent value="table" className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-left text-muted-foreground">
                        <th className="py-2">Horizon</th><th>Scenario</th><th>Revenue</th><th>Profit</th><th>CAGR</th><th>Conf.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.income_forecasts?.map((f, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-2">{f.horizon_years}yr</td>
                          <td><Badge variant="outline">{f.scenario_label ?? f.scenario ?? 'realistic'}</Badge></td>
                          <td className="tabular-nums">₹{f.projected_revenue.toLocaleString()}</td>
                          <td className="tabular-nums">₹{(f.projected_profit ?? 0).toLocaleString()}</td>
                          <td>{((f.cagr ?? 0) * 100).toFixed(1)}%</td>
                          <td>{(f.confidence_score * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
              </Tabs>
              {realistic[0] && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Baseline ₹{realistic[0].baseline_revenue.toLocaleString()}
                </p>
              )}
              </>
              )}
            </ChartCard>

            <ChartCard title="Demand Score Overview" variant="intelligence">
              {data.demand_insufficient_data ? (
                <InsufficientDataPanel compact title="Limited marketplace activity" description="Demand scores improve as more trades occur on the platform." />
              ) : (
              <ThemedChart height={260}>
                <BarChart data={demandData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis dataKey="crop_name" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(215 15% 58%)', fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="demand_score" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ThemedChart>
              )}
            </ChartCard>

            <InsightFeed insights={data.insights ?? []} />
          </div>
        )}
      </IntelligenceShell>
    </>
  );
}
