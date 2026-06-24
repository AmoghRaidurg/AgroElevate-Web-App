import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function InsufficientDataPanel({
  title = 'Insufficient data for reliable forecasts',
  description = 'Complete marketplace transactions or wait for more regional activity. Projections are hidden to avoid misleading estimates.',
  className,
  compact,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border/60 bg-muted/10 text-center',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className,
      )}
      role="status"
    >
      <Database className={cn('mx-auto text-muted-foreground/70', compact ? 'h-8 w-8 mb-2' : 'h-10 w-10 mb-3')} />
      <p className={cn('font-medium', compact && 'text-sm')}>{title}</p>
      <p className={cn('text-muted-foreground mt-2 max-w-md mx-auto', compact ? 'text-xs' : 'text-sm')}>
        {description}
      </p>
    </div>
  );
}
