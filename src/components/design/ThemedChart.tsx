import { cn } from '@/lib/utils';
import { ResponsiveContainer } from 'recharts';
import type { CSSProperties, ReactNode } from 'react';

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
        '[&_.recharts-bar-rectangle]:transition-opacity [&_.recharts-bar-rectangle]:duration-200',
        '[&_.recharts-active-dot]:drop-shadow-[0_0_6px_hsl(160_84%_45%_/_0.6)]',
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

export const CHART_ANIMATION = { isAnimationActive: true, animationDuration: 800, animationEasing: 'ease-out' as const };

export const CHART_COLORS = {
  primary: 'hsl(160 84% 45%)',
  accent: 'hsl(187 85% 48%)',
  forest: 'hsl(158 64% 35%)',
  warning: 'hsl(38 92% 50%)',
  danger: 'hsl(0 72% 51%)',
  muted: 'hsl(215 15% 58%)',
};

/** Shared Recharts tooltip styling for premium analytics surfaces */
export const chartTooltipStyle: CSSProperties = {
  background: 'hsl(226 28% 11% / 0.95)',
  border: '1px solid hsl(225 20% 28% / 0.8)',
  borderRadius: 10,
  boxShadow: '0 8px 32px hsl(0 0% 0% / 0.35)',
  backdropFilter: 'blur(12px)',
  padding: '10px 14px',
  fontSize: 12,
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: 'hsl(210 25% 96%)',
  fontWeight: 600,
  marginBottom: 4,
};
