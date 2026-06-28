import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntelligenceShell } from '@/components/intelligence/IntelligenceShell';
import { useAuth } from '@/hooks/useAuth';
import { fetchTraderMarketDashboard, type TraderMarketDashboard } from '@/lib/marketIntelligenceApi';
import { DataSourceBadge } from '@/components/market-intelligence/DataSourceBadge';
import { TraderMarketErrorBoundary } from '@/components/market-intelligence/TraderMarketErrorBoundary';
import { MetricSkeleton } from '@/components/design/skeletons';
import { Badge } from '@/components/ui/badge';
import { displayText, formatInrPerKg, isValidPrice } from '@/lib/marketIntelligenceDisplay';
import { cn } from '@/lib/utils';
import { MapPin, TrendingUp, BarChart3, Lightbulb, Scale } from 'lucide-react';

type TraderTab = 'dashboard' | 'opportunities' | 'arbitrage' | 'districts' | 'recommendations';

const TRADER_TABS: { id: TraderTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Procurement Dashboard', icon: BarChart3 },
  { id: 'opportunities', label: 'Procurement Opportunities', icon: Lightbulb },
  { id: 'arbitrage', label: 'Price Arbitrage', icon: Scale },
  { id: 'districts', label: 'District Comparison', icon: TrendingUp },
  { id: 'recommendations', label: 'Recommendations', icon: MapPin },
];

interface SafeArbitrage {
  crop: string;
  buy_market: string;
  buy_price: number;
  sell_market: string;
  sell_price: number;
  spread_per_kg: number;
  margin_pct: number;
}

interface SafeTraderView {
  hasInsights: boolean;
  best_procurement_district: string;
  cheapest_market_name: string;
  supply_density: number;
  demand_density: number;
  avg_procurement_cost: number;
  transport_cost_estimate_per_kg: number;
  potential_profit_margin_pct: number;
  market_volatility: number;
  district_comparison: Array<{ district: string; avg_price: number }>;
  arbitrage_opportunities: SafeArbitrage[];
  nearby_markets: Array<{
    market_name: string;
    distance_km: number;
    top_crop: string;
    top_price: number;
  }>;
  recommendations: Array<{ title: string; message: string; priority: string }>;
  data_source?: TraderMarketDashboard['data_source'];
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTraderData(raw: TraderMarketDashboard | null): SafeTraderView {
  const district_comparison = (raw?.district_comparison ?? [])
    .map((d) => ({
      district: displayText(d.district, 'Unknown'),
      avg_price: num(d.avg_price),
    }))
    .filter((d) => d.avg_price > 0);

  const arbitrage_opportunities: SafeArbitrage[] = (raw?.arbitrage_opportunities ?? []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      crop: displayText(o.crop, 'Crop'),
      buy_market: displayText(o.buy_market, 'Unknown market'),
      buy_price: num(o.buy_price),
      sell_market: displayText(o.sell_market, 'Unknown market'),
      sell_price: num(o.sell_price),
      spread_per_kg: num(o.spread_per_kg),
      margin_pct: num(o.margin_pct),
    };
  });

  const nearby_markets = (raw?.nearby_markets ?? []).map((m) => ({
    market_name: displayText(m.market_name, 'Unknown market'),
    distance_km: num(m.distance_km),
    top_crop: displayText(m.top_crop, 'Mixed'),
    top_price: num(m.top_price),
  }));

  const recommendations: SafeTraderView['recommendations'] = arbitrage_opportunities.slice(0, 5).map((o) => ({
    title: `Arbitrage: ${o.crop}`,
    message: `Buy at ${o.buy_market} (${formatInrPerKg(o.buy_price)}) and sell at ${o.sell_market} (${formatInrPerKg(o.sell_price)}) for ~${o.margin_pct.toFixed(1)}% margin.`,
    priority: o.margin_pct >= 15 ? 'high' : 'medium',
  }));

  if (!recommendations.length && district_comparison.length) {
    const cheapest = [...district_comparison].sort((a, b) => a.avg_price - b.avg_price)[0];
    recommendations.push({
      title: 'Best procurement district',
      message: `Focus sourcing in ${cheapest.district} where average modal price is ${formatInrPerKg(cheapest.avg_price)}.`,
      priority: 'medium',
    });
  }

  const hasInsights = Boolean(
    district_comparison.length
    || arbitrage_opportunities.length
    || nearby_markets.length
    || isValidPrice(raw?.avg_procurement_cost),
  );

  return {
    hasInsights,
    best_procurement_district: displayText(raw?.best_procurement_district, '—'),
    cheapest_market_name: displayText(raw?.cheapest_market?.market_name, 'Unknown'),
    supply_density: num(raw?.supply_density),
    demand_density: num(raw?.demand_density, 50),
    avg_procurement_cost: num(raw?.avg_procurement_cost),
    transport_cost_estimate_per_kg: num(raw?.transport_cost_estimate_per_kg, 2.5),
    potential_profit_margin_pct: num(raw?.potential_profit_margin_pct, 12.5),
    market_volatility: num(raw?.market_volatility, 0.15),
    district_comparison,
    arbitrage_opportunities,
    nearby_markets,
    recommendations,
    data_source: raw?.data_source,
  };
}

function EmptyPanel({ message = 'No market insights available.' }: { message?: string }) {
  return (
    <GlassCard className="mt-6 p-8 text-center text-sm text-muted-foreground border border-dashed">
      {message}
    </GlassCard>
  );
}

function TraderMarketIntelligenceContent() {
  const { session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TraderTab>('dashboard');
  const [data, setData] = useState<TraderMarketDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dash = await fetchTraderMarketDashboard(session.user.id);
      if (dash._fallback) {
        setError('Market Intelligence service is temporarily unavailable.');
      }
      setData(dash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trader market data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => normalizeTraderData(data), [data]);
  const isLoading = authLoading || loading;

  const dashboardCards = [
    { label: 'Best Procurement District', value: view.best_procurement_district },
    { label: 'Cheapest Market', value: view.cheapest_market_name },
    { label: 'Supply Density', value: `${view.supply_density.toLocaleString('en-IN')} kg` },
    { label: 'Demand Density', value: view.demand_density.toFixed(1) },
    { label: 'Avg Procurement Cost', value: formatInrPerKg(view.avg_procurement_cost) },
    { label: 'Transport Estimate', value: formatInrPerKg(view.transport_cost_estimate_per_kg) },
    { label: 'Profit Margin', value: `${view.potential_profit_margin_pct}%` },
    { label: 'Market Volatility', value: view.market_volatility.toFixed(3) },
  ];

  return (
    <>
      <PageHeader
        title="Trader Market Intelligence"
        subtitle="Procurement analytics from live mandi data"
        actions={<DataSourceBadge dataSource={view.data_source} />}
      />

      <div className="flex flex-wrap gap-2 mb-2">
        {TRADER_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all border',
              tab === id
                ? 'bg-highlight/15 text-foreground border-highlight/40 shadow-sm'
                : 'text-muted-foreground border-transparent hover:border-border hover:bg-secondary/60',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <IntelligenceShell
        loading={isLoading && !data}
        error={error}
        fallback={data?._fallback}
        onRetry={load}
      >
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: tab === 'dashboard' ? 8 : 4 }).map((_, i) => <MetricSkeleton key={i} />)}
          </div>
        ) : null}

        {!isLoading && !view.hasInsights && !error && tab === 'dashboard' ? (
          <EmptyPanel />
        ) : null}

        {tab === 'dashboard' && !isLoading && (
          view.hasInsights ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {dashboardCards.map((c) => (
                <GlassCard key={c.label} className="p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold mt-1">{c.value}</p>
                </GlassCard>
              ))}
            </div>
          ) : null
        )}

        {tab === 'opportunities' && !isLoading && (
          view.nearby_markets.length ? (
            <GlassCard className="mt-6 p-4 space-y-3">
              <h3 className="font-semibold">Nearby Procurement Markets</h3>
              {view.nearby_markets.map((m, i) => (
                <div key={i} className="flex flex-wrap justify-between gap-2 text-sm border-b border-border/30 py-2">
                  <span className="font-medium">{m.market_name}</span>
                  <span className="text-muted-foreground">{m.distance_km} km</span>
                  <span>{m.top_crop}: {formatInrPerKg(m.top_price)}</span>
                </div>
              ))}
            </GlassCard>
          ) : <EmptyPanel message="No procurement opportunities found for your region." />
        )}

        {tab === 'arbitrage' && !isLoading && (
          view.arbitrage_opportunities.length ? (
            <GlassCard className="mt-6 p-4 space-y-2">
              <h3 className="font-semibold mb-3">Price Arbitrage Opportunities</h3>
              {view.arbitrage_opportunities.map((o, i) => (
                <div key={i} className="flex flex-wrap justify-between gap-2 text-sm border-b border-border/30 py-2">
                  <span>
                    {o.crop}: Buy {o.buy_market} {formatInrPerKg(o.buy_price)} → Sell {o.sell_market} {formatInrPerKg(o.sell_price)}
                  </span>
                  <Badge variant="outline">+{o.margin_pct.toFixed(1)}%</Badge>
                </div>
              ))}
            </GlassCard>
          ) : <EmptyPanel message="No arbitrage opportunities detected right now." />
        )}

        {tab === 'districts' && !isLoading && (
          view.district_comparison.length ? (
            <GlassCard className="mt-6 p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> District Comparison
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={view.district_comparison}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="district" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatInrPerKg(v)} />
                    <Bar dataKey="avg_price" fill="#3b82f6" name="Avg Price" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          ) : <EmptyPanel message="No district comparison data available." />
        )}

        {tab === 'recommendations' && !isLoading && (
          view.recommendations.length ? (
            <div className="mt-6 space-y-3">
              {view.recommendations.map((r, i) => (
                <GlassCard key={i} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={r.priority === 'high' ? 'default' : 'secondary'}>{r.priority}</Badge>
                    <span className="font-medium">{r.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.message}</p>
                </GlassCard>
              ))}
            </div>
          ) : <EmptyPanel message="No market insights available." />
        )}
      </IntelligenceShell>
    </>
  );
}

export default function TraderMarketIntelligence() {
  return (
    <TraderMarketErrorBoundary>
      <TraderMarketIntelligenceContent />
    </TraderMarketErrorBoundary>
  );
}
