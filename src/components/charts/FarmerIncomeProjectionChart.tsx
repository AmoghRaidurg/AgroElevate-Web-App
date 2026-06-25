import { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea } from 'recharts';
import { ChartCard } from '@/components/design/ChartCard';
import { ThemedChart, CHART_COLORS, CHART_ANIMATION } from '@/components/design/ThemedChart';
import { ChartTooltipContent } from '@/components/charts/ChartTooltipContent';
import { FARMER_INCOME_PROJECTION, FARMER_PROJECTION_CAPTION } from '@/lib/chartData';
import { Badge } from '@/components/ui/badge';

const data = FARMER_INCOME_PROJECTION.map((row) => ({
  year: row.year,
  'Traditional Supply Chain': row.traditional,
  'With AgroElevate': row.agroElevate,
  confidence: row.confidence,
}));

const latestConfidence = FARMER_INCOME_PROJECTION[FARMER_INCOME_PROJECTION.length - 1]?.confidence ?? 0.8;

function FarmerIncomeProjectionChartInner() {
  return (
    <ChartCard
      title="Farmer Income Projection (2025–2028)"
      description="Cumulative income trajectory — traditional vs AgroElevate-enabled ecosystem"
      height="min-h-[360px]"
      action={
        <Badge variant="outline" className="text-xs tabular-nums">
          Confidence {Math.round(latestConfidence * 100)}%
        </Badge>
      }
    >
      <ThemedChart height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`}
            label={{ value: 'Projected income (₹)', angle: -90, position: 'insideLeft', fill: 'hsl(215 15% 58%)', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          <ReferenceArea
            x1="2027"
            x2="2028"
            fill={CHART_COLORS.primary}
            fillOpacity={0.06}
            strokeOpacity={0}
          />
          <Line
            type="monotone"
            dataKey="Traditional Supply Chain"
            stroke={CHART_COLORS.muted}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 4, fill: CHART_COLORS.muted }}
            {...CHART_ANIMATION}
          />
          <Line
            type="monotone"
            dataKey="With AgroElevate"
            stroke={CHART_COLORS.primary}
            strokeWidth={3}
            dot={{ r: 5, fill: CHART_COLORS.primary }}
            activeDot={{ r: 7 }}
            {...CHART_ANIMATION}
          />
        </LineChart>
      </ThemedChart>
      <p className="text-sm text-muted-foreground px-6 pb-5 leading-relaxed">{FARMER_PROJECTION_CAPTION}</p>
    </ChartCard>
  );
}

export const FarmerIncomeProjectionChart = memo(FarmerIncomeProjectionChartInner);
