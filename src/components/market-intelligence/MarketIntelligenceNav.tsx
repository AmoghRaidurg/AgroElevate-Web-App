import { BarChart3, Globe2, LineChart, MapPin, Scale, Sprout, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'live-prices', label: 'Live Prices', icon: TrendingUp },
  { id: 'nearby', label: 'Nearby Markets', icon: MapPin },
  { id: 'comparison', label: 'Comparison', icon: Scale },
  { id: 'forecast', label: 'Forecast', icon: LineChart },
  { id: 'msp', label: 'MSP', icon: Sprout },
  { id: 'regional', label: 'Regional', icon: Globe2 },
  { id: 'benchmark', label: 'Benchmark', icon: BarChart3 },
  { id: 'recommendations', label: 'Recommendations', icon: TrendingUp },
] as const;

export type MarketTab = (typeof tabs)[number]['id'];

interface Props {
  active: MarketTab;
  onChange: (tab: MarketTab) => void;
}

export function MarketIntelligenceNav({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all border',
            active === id
              ? 'bg-highlight/15 text-foreground border-highlight/40 shadow-sm'
              : 'text-muted-foreground border-transparent hover:border-border hover:bg-secondary/60',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
