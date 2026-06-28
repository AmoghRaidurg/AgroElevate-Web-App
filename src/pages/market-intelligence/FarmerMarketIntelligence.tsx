import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Label } from 'recharts';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntelligenceShell } from '@/components/intelligence/IntelligenceShell';
import { MarketIntelligenceNav, type MarketTab } from '@/components/market-intelligence/MarketIntelligenceNav';
import { NearbyMarketsMap } from '@/components/market-intelligence/NearbyMarketsMap';
import { NearbyMarketsList } from '@/components/market-intelligence/NearbyMarketsList';
import { LocationSelector } from '@/components/market-intelligence/LocationSelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMarketLocation } from '@/hooks/useMarketLocation';
import {
  exportToCsv,
  fetchFarmerMarketDashboard,
  type FarmerMarketDashboard,
} from '@/lib/marketIntelligenceApi';
import { DataSourceBadge } from '@/components/market-intelligence/DataSourceBadge';
import {
  buildCropForecast,
  displayText,
  filterLivePrices,
  formatInrPerKg,
  formatInrQuintal,
  resolveOverview,
  topCropPrices,
  uniqueCrops,
} from '@/lib/marketIntelligenceDisplay';
import { MetricSkeleton, TableSkeleton, ChartSkeleton } from '@/components/design/skeletons';
import { Download, Info, ChevronDown } from 'lucide-react';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

function OverviewSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {Array.from({ length: 9 }).map((_, i) => (
        <MetricSkeleton key={i} />
      ))}
    </div>
  );
}

export default function FarmerMarketIntelligence() {
  const { session } = useAuth();
  const { location, permissionDenied, setManualLocation, requestLocation } = useMarketLocation();
  const [tab, setTab] = useState<MarketTab>('overview');
  const [data, setData] = useState<FarmerMarketDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [forecastCrop, setForecastCrop] = useState('Tomato');

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await fetchFarmerMarketDashboard(session.user.id, location ?? undefined);
      if (dash._fallback) setError('Market Intelligence service offline — showing cached reference data where available.');
      setData(dash);
      const crops = uniqueCrops(dash.live_prices ?? []);
      if (crops.length) {
        setForecastCrop((prev) => (crops.includes(prev) ? prev : crops[0]));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [session, location]);

  useEffect(() => { load(); }, [load]);

  const overview = useMemo(() => resolveOverview(data), [data]);
  const allPrices = data?.live_prices ?? [];
  const cropOptions = useMemo(() => uniqueCrops(allPrices), [allPrices]);

  const displayPrices = useMemo(() => {
    const hasFilter = search.trim() || cropFilter !== 'all';
    if (hasFilter) return filterLivePrices(allPrices, search, cropFilter);
    return topCropPrices(allPrices, 20);
  }, [allPrices, search, cropFilter]);

  const comparisonChart = (data?.comparisons ?? []).map((c) => ({
    crop: c.crop,
    AgroElevate: c.agroelevate_avg,
    Mandi: c.mandi_price,
    District: c.district_avg,
    State: c.state_avg,
    National: c.national_avg,
  }));

  const forecast = useMemo(
    () => buildCropForecast(forecastCrop, data?.price_history ?? [], allPrices),
    [forecastCrop, data?.price_history, allPrices],
  );

  const benchmark = data?.benchmark;

  const overviewCards = [
    { label: "Today's Best Selling Crop", value: overview.bestSellingCrop },
    { label: 'Highest Price Crop', value: `${overview.highestPriceCrop} (${overview.highestPrice})` },
    { label: 'Nearest Market', value: overview.nearestMarket },
    { label: 'Average District Price', value: overview.avgDistrictPrice },
    { label: 'AgroElevate Suggested Price', value: overview.agroelevateSuggestedPrice },
    { label: 'Expected Additional Income', value: overview.expectedAdditionalIncome },
    { label: 'Demand Level', value: overview.demandLevel },
    { label: 'Supply Level', value: overview.supplyLevel },
    { label: 'Weather Impact', value: overview.weatherImpact },
  ];

  return (
    <>
      <PageHeader
        title="Market Intelligence"
        subtitle="Live Indian agricultural market data — separate from Commerce Intelligence"
        actions={<DataSourceBadge dataSource={data?.data_source} />}
      />

      <LocationSelector
        location={location}
        permissionDenied={permissionDenied}
        onManualSelect={setManualLocation}
        onRetryGps={requestLocation}
      />

      <MarketIntelligenceNav active={tab} onChange={setTab} />

      <IntelligenceShell loading={loading && !data} error={error} fallback={data?._fallback} onRetry={load}>
        {tab === 'overview' && (
          loading && !data ? <OverviewSkeleton /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {overviewCards.map((card) => (
                <GlassCard key={card.label} className="p-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="font-semibold mt-1 text-sm sm:text-base">{card.value}</p>
                </GlassCard>
              ))}
              <GlassCard className="p-4 sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-muted-foreground">Regional Trend</p>
                <p className="font-semibold mt-1">{overview.regionalTrend}</p>
              </GlassCard>
            </div>
          )
        )}

        {tab === 'live-prices' && (
          loading && !data ? <TableSkeleton rows={8} className="mt-6" /> : (
            <GlassCard className="mt-6 p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Filter crop, market, district…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs bg-muted/30"
                />
                <select
                  value={cropFilter}
                  onChange={(e) => setCropFilter(e.target.value)}
                  className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  <option value="all">All crops</option>
                  {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!displayPrices.length}
                  onClick={() => exportToCsv(displayPrices as unknown as Record<string, unknown>[], 'market_prices.csv')}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>
                {!search.trim() && cropFilter === 'all' && (
                  <span className="text-xs text-muted-foreground">Showing top 20 crops by modal price</span>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20 text-muted-foreground">
                      {['Crop', 'Market', 'District', 'State', 'Minimum Price', 'Maximum Price', 'Modal Price', 'Arrival Quantity', 'Last Updated', 'Data Source'].map((h) => (
                        <th key={h} className="text-left p-2.5 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayPrices.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          No results found. Try a different crop or clear your filters.
                        </td>
                      </tr>
                    ) : (
                      displayPrices.map((p, i) => (
                        <tr key={`${p.market_code}-${p.crop}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="p-2.5 font-medium">{displayText(p.crop)}</td>
                          <td className="p-2.5">{displayText(p.market_name)}</td>
                          <td className="p-2.5">{displayText(p.district)}</td>
                          <td className="p-2.5">{displayText(p.state)}</td>
                          <td className="p-2.5">{formatInrPerKg(p.min_price)}</td>
                          <td className="p-2.5">{formatInrPerKg(p.max_price)}</td>
                          <td className="p-2.5 font-semibold text-highlight">{formatInrPerKg(p.modal_price)}</td>
                          <td className="p-2.5">{displayText(p.arrival_quantity, '0')} kg</td>
                          <td className="p-2.5 whitespace-nowrap">{displayText(p.date, 'Today')}</td>
                          <td className="p-2.5">
                            <Badge variant="secondary" className="font-normal">{displayText(p.source, 'Dataset')}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )
        )}

        {tab === 'nearby' && (
          loading && !data ? <TableSkeleton rows={4} className="mt-6" /> : (
            <div className="mt-6 space-y-4">
              <GlassCard className="p-4">
                <h3 className="font-semibold mb-3">Markets Near You</h3>
                <NearbyMarketsList markets={data?.nearby_markets ?? []} livePrices={allPrices} />
              </GlassCard>
              {(data?.nearby_markets?.length ?? 0) > 0 && (
                <Collapsible>
                  <GlassCard className="p-4">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
                      Map view (optional)
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <NearbyMarketsMap
                        markets={data?.nearby_markets ?? []}
                        userLat={location?.latitude}
                        userLon={location?.longitude}
                      />
                    </CollapsibleContent>
                  </GlassCard>
                </Collapsible>
              )}
            </div>
          )
        )}

        {tab === 'comparison' && data && (
          <GlassCard className="mt-6 p-4">
            <h3 className="font-semibold mb-4">AgroElevate vs Government Market</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="crop" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="AgroElevate" fill="#22c55e" />
                  <Bar dataKey="Mandi" fill="#f59e0b" />
                  <Bar dataKey="District" fill="#3b82f6" />
                  <Bar dataKey="State" fill="#8b5cf6" />
                  <Bar dataKey="National" fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {(data.comparisons ?? []).map((c) => (
                <div key={c.crop} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{displayText(c.crop)}</p>
                  <p>AgroElevate {formatInrPerKg(c.agroelevate_avg)} vs Mandi {formatInrPerKg(c.mandi_price)} — <span className="text-highlight">+{displayText(c.difference_pct, '0')}%</span></p>
                  <p className="text-muted-foreground text-xs">{displayText(c.recommendation)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {tab === 'forecast' && (
          loading && !data ? <ChartSkeleton className="mt-6" /> : (
            <GlassCard className="mt-6 p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold">Price Forecast for {forecastCrop}</h3>
                <select
                  value={forecastCrop}
                  onChange={(e) => setForecastCrop(e.target.value)}
                  className="rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  {(cropOptions.length ? cropOptions : ['Tomato', 'Onion', 'Wheat', 'Rice']).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Today's price", value: formatInrQuintal(forecast.todayPrice) },
                  { label: 'Tomorrow prediction', value: formatInrQuintal(forecast.tomorrow) },
                  { label: '3-day prediction', value: formatInrQuintal(forecast.day3) },
                  { label: '7-day prediction', value: formatInrQuintal(forecast.day7) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-border/50 p-3 bg-muted/10">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-semibold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline">Confidence: {forecast.confidencePct}%</Badge>
                <Badge variant={forecast.expectedTrend === 'Rise' ? 'default' : forecast.expectedTrend === 'Fall' ? 'secondary' : 'outline'}>
                  Expected trend: {forecast.expectedTrend}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-highlight pl-3">
                {forecast.explanation}
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.chartData} margin={{ bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}>
                      <Label value="Date" offset={-5} position="insideBottom" fontSize={11} />
                    </XAxis>
                    <YAxis tick={{ fontSize: 10 }}>
                      <Label value="Price (₹/Quintal)" angle={-90} position="insideLeft" fontSize={11} style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <Tooltip formatter={(v: number) => formatInrQuintal(v)} />
                    <Line type="monotone" dataKey="price" stroke="#22c55e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )
        )}

        {tab === 'msp' && data && (
          <GlassCard className="mt-6 p-4 space-y-3">
            {(data.msp ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">MSP data will appear when available for your region.</p>
            ) : (
              (data.msp ?? []).map((m, i) => (
                <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-border/30 py-2 text-sm">
                  <span className="font-medium">{displayText(m.crop)}</span>
                  <span>MSP: {formatInrPerKg(m.msp_price)}</span>
                  <span>Mandi: {formatInrPerKg(m.mandi_price)}</span>
                  <span>AgroElevate: {formatInrPerKg(m.agroelevate_price)}</span>
                  <Badge variant={Number(m.difference) >= 0 ? 'default' : 'secondary'}>Δ {formatInrPerKg(m.difference)}</Badge>
                </div>
              ))
            )}
          </GlassCard>
        )}

        {tab === 'regional' && data && (
          <GlassCard className="mt-6 p-4">
            <h3 className="font-semibold mb-4">District Demand Heatmap</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(data.demand_heatmap ?? []).map((d) => (
                <div key={d.district} className={`rounded-lg p-3 text-sm border ${
                  d.level === 'High' ? 'bg-green-500/10 border-green-500/30' : d.level === 'Medium' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <p className="font-medium">{displayText(d.district)}</p>
                  <p className="text-xs text-muted-foreground">Score: {displayText(d.demand_score)} — {displayText(d.level)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {tab === 'benchmark' && benchmark && (
          <div className="mt-6 space-y-4">
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-semibold">Reference Benchmark</h3>
                <UiTooltip>
                  <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">{benchmark.benchmark.disclaimer}</TooltipContent>
                </UiTooltip>
              </div>
              <p className="text-xs text-amber-500 mb-3">Not Personal Income — illustrative comparison only</p>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div><p className="text-muted-foreground">Holding</p><p className="font-bold">{benchmark.benchmark.holding_hectares} ha / {benchmark.benchmark.holding_acres} acres</p></div>
                <div><p className="text-muted-foreground">Production</p><p className="font-bold">{benchmark.benchmark.annual_production_kg} kg/yr</p></div>
                <div><p className="text-muted-foreground">Income</p><p className="font-bold">₹{benchmark.benchmark.annual_income_inr.toLocaleString('en-IN')}/yr</p></div>
              </div>
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={benchmark.production_breakdown.map((p) => ({ name: `${p.season}: ${p.crop}`, value: p.yield_kg }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {benchmark.production_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground mb-2">{benchmark.projection_label}</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={benchmark.without_agroelevate.map((w, i) => ({
                    year: `Y${w.year}`,
                    Without: w.income,
                    With: benchmark.with_agroelevate[i]?.income ?? w.income,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                    <Legend />
                    <Line type="monotone" dataKey="Without" stroke="#64748b" />
                    <Line type="monotone" dataKey="With" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        )}

        {tab === 'recommendations' && data && (
          <div className="mt-6 space-y-3">
            {(data.recommendations ?? []).length === 0 ? (
              <GlassCard className="p-6 text-center text-sm text-muted-foreground">Recommendations will appear for your selected region.</GlassCard>
            ) : (
              (data.recommendations ?? []).map((r, i) => (
                <GlassCard key={i} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={r.priority === 'high' ? 'default' : 'secondary'}>{displayText(r.priority)}</Badge>
                    <span className="font-medium">{displayText(r.title)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{displayText(r.message)}</p>
                </GlassCard>
              ))
            )}
          </div>
        )}
      </IntelligenceShell>
    </>
  );
}
