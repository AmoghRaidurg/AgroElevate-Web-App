import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface HeroMetricProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'accent' | 'highlight';
}

const variantBorder = {
  default: 'border-border/60',
  primary: 'border-primary/30',
  accent: 'border-accent/30',
  highlight: 'border-highlight/30',
};

export function HeroMetric({
  label,
  value,
  subtitle,
  icon,
  className,
  variant = 'default',
}: HeroMetricProps) {
  return (
    <div className={cn('glass-elevated rounded-2xl p-5', variantBorder[variant], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
          <p className="font-display text-3xl md:text-4xl font-extrabold tabular-nums mt-1 tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
        {icon && (
          <div className="shrink-0 p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/20">{icon}</div>
        )}
      </div>
    </div>
  );
}
