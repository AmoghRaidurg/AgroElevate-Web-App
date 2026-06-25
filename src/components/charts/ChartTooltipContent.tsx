import type { TooltipProps } from 'recharts';
import { chartTooltipLabelStyle, chartTooltipStyle } from '@/components/design/ThemedChart';

type ValueType = number | string;
type NameType = number | string;

interface ChartTooltipContentProps extends TooltipProps<ValueType, NameType> {
  valueFormatter?: (value: number) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter = (v) => `₹${Number(v).toLocaleString('en-IN')}`,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div style={chartTooltipStyle}>
      {label != null && <p style={chartTooltipLabelStyle}>{String(label)}</p>}
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={String(entry.name)} style={{ color: entry.color, margin: 0, fontSize: 12 }}>
            <span style={{ color: 'hsl(215 15% 70%)' }}>{entry.name}: </span>
            <strong>{valueFormatter(Number(entry.value))}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}
