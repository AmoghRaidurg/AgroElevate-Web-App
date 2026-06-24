import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'accent' | 'highlight';
  className?: string;
  children?: ReactNode;
}

const metricVariants = {
  default: 'border-border/60',
  success: 'border-primary/35 bg-primary/5',
  warning: 'border-amber-500/35 bg-amber-500/5',
  accent: 'border-accent/35 bg-accent/5',
  highlight: 'border-highlight/35 bg-highlight/5',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  className,
  children,
}: MetricCardProps) {
  return (
    <div className={cn('glass-card rounded-2xl p-5', metricVariants[variant], className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{title}</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className="h-6 w-6 text-muted-foreground/60 shrink-0" />}
      </div>
      {children}
    </div>
  );
}
