import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ThemedChart } from '@/components/design/ThemedChart';
import { ChartTooltipContent } from '@/components/charts/ChartTooltipContent';
import { SUPPLY_CHAIN_CAPTION, SUPPLY_CHAIN_STAGES, SUPPLY_CHAIN_VALUE_DATA } from '@/lib/chartData';

/** Compact, stable supply-chain chart for the marketing hero (no float animations). */
function HeroSupplyChainChartInner() {
  return (
    <div className="glass-elevated rounded-2xl border border-border/60 shadow-2xl p-4 sm:p-5 h-full min-h-[400px] flex flex-col">
      <div className="shrink-0 mb-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Supply chain insight</p>
        <h3 className="font-display font-bold text-base sm:text-lg leading-tight mt-0.5">
          Value Distribution Across Agricultural Supply Chain
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Illustrative ₹ per quintal at each stage</p>
      </div>
      <div className="flex-1 min-h-[260px]">
        <ThemedChart height={260}>
          <BarChart
            data={[...SUPPLY_CHAIN_VALUE_DATA]}
            margin={{ top: 4, right: 4, left: -8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="crop"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={36}
              tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            {SUPPLY_CHAIN_STAGES.map((stage) => (
              <Bar
                key={stage.key}
                dataKey={stage.key}
                name={stage.label}
                fill={stage.color}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ThemedChart>
      </div>
      <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-2 shrink-0">
        {SUPPLY_CHAIN_CAPTION}
      </p>
    </div>
  );
}

export const HeroSupplyChainChart = memo(HeroSupplyChainChartInner);
