import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/design/GlassCard';
import { MapPin, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { NearbyMarket } from '@/lib/marketIntelligenceApi';
import { displayText, formatInrPerKg, trendForMarket } from '@/lib/marketIntelligenceDisplay';
import type { MarketPrice } from '@/lib/marketIntelligenceApi';

interface Props {
  markets: NearbyMarket[];
  livePrices: MarketPrice[];
}

function TrendBadge({ trend }: { trend: 'Up' | 'Down' | 'Stable' }) {
  if (trend === 'Up') {
    return (
      <Badge variant="default" className="gap-1 bg-green-600/90">
        <TrendingUp className="h-3 w-3" /> Up
      </Badge>
    );
  }
  if (trend === 'Down') {
    return (
      <Badge variant="secondary" className="gap-1 text-red-600">
        <TrendingDown className="h-3 w-3" /> Down
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="h-3 w-3" /> Stable
    </Badge>
  );
}

export function NearbyMarketsList({ markets, livePrices }: Props) {
  if (!markets.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">
        No nearby markets found. Enable location or select your state to see mandis near you.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {markets.map((m) => {
        const trend = trendForMarket(m, livePrices);
        return (
          <GlassCard key={m.market_code} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-highlight shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{displayText(m.market_name)}</p>
                  <p className="text-xs text-muted-foreground">{displayText(m.state)}</p>
                </div>
              </div>
              <TrendBadge trend={trend} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Distance</p>
                <p className="font-medium">{displayText(m.distance_km, '0')} km</p>
              </div>
              <div>
                <p className="text-muted-foreground">Travel time</p>
                <p className="font-medium">~{displayText(m.travel_time_min, '15')} min</p>
              </div>
              <div>
                <p className="text-muted-foreground">Top crop</p>
                <p className="font-medium">{displayText(m.top_crop, 'Mixed')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Modal price</p>
                <p className="font-medium text-highlight">{formatInrPerKg(m.top_price)}</p>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
