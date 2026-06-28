import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntelligenceShell } from '@/components/intelligence/IntelligenceShell';
import { MarketIntelligenceNav, type MarketTab } from '@/components/market-intelligence/MarketIntelligenceNav';
import { NearbyMarketsMap } from '@/components/market-intelligence/NearbyMarketsMap';
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
  type MarketPrice,
} from '@/lib/marketIntelligenceApi';
import { Globe2, Download, Info } from 'lucide-react';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function FarmerMarketIntelligence() {
  const { session } = useAuth();
  const { location, permissionDenied, setManualLocation, requestLocation } = useMarketLocation();
  const [tab, setTab] = useState<MarketTab>('overview');
  const [data, setData] = useState<FarmerMarketDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await fetchFarmerMarketDashboard(session.user.id, location ?? undefined);
      if (dash._fallback) setError('Market Intelligence service offline — showing cached reference data where available.');
      setData(dash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [session, location]);

  useEffect(() => { load(); }, [load]);

  const filteredPrices = (data?.live_prices ?? []).filter((p: MarketPrice) => {
    if (cropFilter !== 'all' && p.crop !== cropFilter) return false;
    const q = search.toLowerCase();
    return !q || p.crop.toLowerCase().includes(q) || p.market_name.toLowerCase().includes(q);
  });

  const comparisonChart = (data?.comparisons ?? []).map((c) => ({
    crop: c.crop,
    AgroElevate: c.agroelevate_avg,
    Mandi: c.mandi_price,
    District: c.district_avg,
    State: c.state_avg,
    National: c.national_avg,
  }));

  const forecastData = (data?.price_history ?? []).slice(0, 30).map((h) => ({
    date: String(h.date ?? '').slice(5),
    price: Number(h.modal_price ?? 0),
  }));

  const benchmark = data?.benchmark;

  return (
    <>
      <PageHeader
        title="Market Intelligence"
        subtitle="Live Indian agricultural market data — separate from Commerce Intelligence"
        actions={<Badge variant="outline" className="gap-1"><Globe2 className="h-3 w-3" /> Live Mandi Data</Badge>}
      />

      <LocationSelector
        location={location}
        permissionDenied={permissionDenied}
        onManualSelect={setManualLocation}
        onRetryGps={requestLocation}
      />

      <MarketIntelligenceNav active={tab} onChange={setTab} />

      <IntelligenceShell loading={loading} error={error} fallback={data?._fallback} onRetry={load}>
        {data?.overview && tab === 'overview' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[
              { label: "Today's Best Selling", value: data.overview.best_selling_crop },
              { label: 'Highest Price Crop', value: `${data.overview.highest_price_crop} (₹${data.overview.highest_price})` },
              { label: 'Nearest Market', value: data.overview.nearest_market },
              { label: 'Avg District Price', value: `₹${data.overview.avg_district_price}/kg` },
              { label: 'Avg AgroElevate Price', value: `₹${data.overview.avg_agroelevate_price}/kg` },
              { label: 'Price Difference', value: `+₹${data.overview.price_difference} (${data.overview.price_difference_pct}%)` },
              { label: "Today's Demand", value: data.overview.today_demand },
              { label: "Today's Supply", value: `${data.overview.today_supply} kg` },
              { label: 'Regional Trend', value: data.overview.regional_trend },
              { label: 'Weather Impact', value: data.overview.weather_impact },
            ].map((card) => (
              <GlassCard key={card.label} className="p-4">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-semibold mt-1">{card.value}</p>
              </GlassCard>
            ))}
          </div>
        )}

        {tab === 'live-prices' && (
          <GlassCard className="mt-6 p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search crop or market…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-muted/30" />
              <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} className="rounded-md border bg-muted/30 px-3 text-sm">
                <option value="all">All crops</option>
                {[...new Set((data?.live_prices ?? []).map((p) => p.crop))].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={() => exportToCsv(filteredPrices as unknown as Record<string, unknown>[], 'market_prices.csv')}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  {['Crop', 'Market', 'District', 'State', 'Min', 'Max', 'Modal', 'Arrival', 'Date', 'Source'].map((h) => <th key={h} className="text-left p-2">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredPrices.slice(0, 100).map((p, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="p-2">{p.crop}</td><td className="p-2">{p.market_name}</td><td className="p-2">{p.district}</td>
                      <td className="p-2">{p.state}</td><td className="p-2">₹{p.min_price}</td><td className="p-2">₹{p.max_price}</td>
                      <td className="p-2 font-medium">₹{p.modal_price}</td><td className="p-2">{p.arrival_quantity}</td>
                      <td className="p-2">{p.date}</td><td className="p-2"><Badge variant="secondary">{p.source}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {tab === 'nearby' && (
          <GlassCard className="mt-6 p-4">
            <NearbyMarketsMap markets={data?.nearby_markets ?? []} userLat={location?.latitude} userLon={location?.longitude} />
            <div className="mt-4 space-y-2">
              {(data?.nearby_markets ?? []).map((m) => (
                <div key={m.market_code} className="flex justify-between text-sm border-b border-border/30 py-2">
                  <span>{m.market_name} — {m.distance_km} km ({m.travel_time_min} min)</span>
                  <span className="text-highlight">{m.top_crop}: ₹{m.top_price}/kg</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {tab === 'comparison' && (
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
              {(data?.comparisons ?? []).map((c) => (
                <div key={c.crop} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{c.crop}</p>
                  <p>AgroElevate ₹{c.agroelevate_avg} vs Mandi ₹{c.mandi_price} — <span className="text-highlight">+{c.difference_pct}%</span></p>
                  <p className="text-muted-foreground text-xs">{c.recommendation}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {tab === 'forecast' && (
          <GlassCard className="mt-6 p-4">
            <h3 className="font-semibold mb-4">Price Trend (90 days sample)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#22c55e" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {tab === 'msp' && (
          <GlassCard className="mt-6 p-4 space-y-3">
            {(data?.msp ?? []).map((m, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-border/30 py-2 text-sm">
                <span className="font-medium">{String(m.crop)}</span>
                <span>MSP: ₹{String(m.msp_price)}</span>
                <span>Mandi: ₹{String(m.mandi_price)}</span>
                <span>AgroElevate: ₹{String(m.agroelevate_price)}</span>
                <Badge variant={Number(m.difference) >= 0 ? 'default' : 'secondary'}>Δ ₹{String(m.difference)}</Badge>
              </div>
            ))}
          </GlassCard>
        )}

        {tab === 'regional' && (
          <GlassCard className="mt-6 p-4">
            <h3 className="font-semibold mb-4">District Demand Heatmap</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(data?.demand_heatmap ?? []).map((d) => (
                <div key={d.district} className={`rounded-lg p-3 text-sm border ${
                  d.level === 'High' ? 'bg-green-500/10 border-green-500/30' : d.level === 'Medium' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <p className="font-medium">{d.district}</p>
                  <p className="text-xs text-muted-foreground">Score: {d.demand_score} — {d.level}</p>
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

        {tab === 'recommendations' && (
          <div className="mt-6 space-y-3">
            {(data?.recommendations ?? []).map((r, i) => (
              <GlassCard key={i} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={r.priority === 'high' ? 'default' : 'secondary'}>{r.priority}</Badge>
                  <span className="font-medium">{r.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.message}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </IntelligenceShell>
    </>
  );
}
