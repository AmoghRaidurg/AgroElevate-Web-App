import { cn } from '@/lib/utils';
import { ResponsiveContainer } from 'recharts';
import type { ReactNode } from 'react';

interface ThemedChartProps {
  children: ReactNode;
  height?: number | string;
  className?: string;
}

/** Dark-themed chart wrapper — preserves Recharts children unchanged. */
export function ThemedChart({ children, height = '100%', className }: ThemedChartProps) {
  return (
    <div
      className={cn(
        'w-full [&_.recharts-cartesian-grid_line]:stroke-border/40',
        '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
        '[&_.recharts-legend-item-text]:!text-muted-foreground',
        '[&_.recharts-tooltip-wrapper]:outline-none',
        className,
      )}
      style={{ height: typeof height === 'number' ? height : undefined }}
    >
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const CHART_COLORS = {
  primary: 'hsl(160 84% 45%)',
  accent: 'hsl(187 85% 48%)',
  forest: 'hsl(158 64% 35%)',
  warning: 'hsl(38 92% 50%)',
  danger: 'hsl(0 72% 51%)',
  muted: 'hsl(215 15% 58%)',
};
