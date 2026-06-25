import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_ANIMATION } from '@/components/design/ThemedChart';
import { ChartTooltipContent } from '@/components/charts/ChartTooltipContent';
import { SUPPLY_CHAIN_CAPTION, SUPPLY_CHAIN_STAGES, SUPPLY_CHAIN_VALUE_DATA } from '@/lib/chartData';

function SupplyChainValueChartInner() {
  return (
    <ChartCard
      title="Value Distribution Across Agricultural Supply Chain"
      description="Illustrative value captured at each stage (₹ per quintal equivalent)"
      height="min-h-[360px]"
    >
      <ThemedChart height={320}>
        <BarChart data={[...SUPPLY_CHAIN_VALUE_DATA]} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="crop" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`}
            label={{ value: 'Value (₹)', angle: -90, position: 'insideLeft', fill: 'hsl(215 15% 58%)', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: 12 }} />
          {SUPPLY_CHAIN_STAGES.map((stage) => (
            <Bar
              key={stage.key}
              dataKey={stage.key}
              name={stage.label}
              fill={stage.color}
              radius={[4, 4, 0, 0]}
              {...CHART_ANIMATION}
            />
          ))}
        </BarChart>
      </ThemedChart>
      <p className="text-sm text-muted-foreground px-6 pb-5 leading-relaxed">{SUPPLY_CHAIN_CAPTION}</p>
    </ChartCard>
  );
}

export const SupplyChainValueChart = memo(SupplyChainValueChartInner);
