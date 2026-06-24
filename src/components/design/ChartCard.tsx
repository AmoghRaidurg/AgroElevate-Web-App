import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  height?: string;
  action?: ReactNode;
  variant?: 'default' | 'intelligence' | 'elevated';
}

const variantClass = {
  default: 'glass-card border-border/60',
  intelligence: 'glass-intelligence',
  elevated: 'glass-elevated border-border/60',
};

export function ChartCard({
  title,
  description,
  children,
  className,
  height = 'h-80',
  action,
  variant = 'default',
}: ChartCardProps) {
  return (
    <div className={cn('rounded-2xl overflow-hidden', variantClass[variant], className)}>
      <div className="px-6 pt-5 pb-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn('px-2 pb-4', height)}>{children}</div>
    </div>
  );
}
