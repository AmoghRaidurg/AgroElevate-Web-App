import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts';
import type { NearbyMarket } from '@/lib/marketIntelligenceApi';

interface Props {
  markets: NearbyMarket[];
  userLat?: number;
  userLon?: number;
}

export function NearbyMarketsMap({ markets, userLat, userLon }: Props) {
  const points = useMemo(() => {
    const items = markets.map((m) => ({
      name: m.market_name,
      x: m.longitude,
      y: m.latitude,
      price: m.top_price ?? 0,
      distance: m.distance_km,
      crop: m.top_crop,
    }));
    if (userLat && userLon) {
      items.unshift({ name: 'Your Location', x: userLon, y: userLat, price: 0, distance: 0, crop: null as unknown as string });
    }
    return items;
  }, [markets, userLat, userLon]);

  if (!markets.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No nearby markets found for this location.</p>;
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis type="number" dataKey="x" name="Longitude" tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name="Latitude" tick={{ fontSize: 10 }} />
          <ZAxis type="number" dataKey="price" range={[60, 400]} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border bg-card p-2 text-xs shadow-lg">
                  <p className="font-semibold">{d.name}</p>
                  {d.crop && <p>{d.crop}: ₹{d.price}/kg</p>}
                  {d.distance > 0 && <p>{d.distance} km away</p>}
                </div>
              );
            }}
          />
          <Scatter data={points}>
            {points.map((entry, i) => (
              <Cell key={i} fill={entry.name === 'Your Location' ? '#22c55e' : '#f59e0b'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground text-center mt-1">Market positions (OpenStreetMap coordinates)</p>
    </div>
  );
}
