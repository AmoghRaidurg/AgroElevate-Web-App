import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, XCircle, Package } from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; className?: string }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock, className: 'border-amber-500/40 text-amber-400' },
  confirmed: { label: 'Confirmed', variant: 'outline', icon: CheckCircle, className: 'border-primary/40 text-primary' },
  completed: { label: 'Completed', variant: 'outline', icon: CheckCircle, className: 'border-primary/40 text-emerald-400' },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
  processing: { label: 'Processing', variant: 'secondary', icon: Package, className: 'border-accent/40 text-accent' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const key = (status ?? 'pending').toLowerCase();
  const config = statusConfig[key] ?? { label: status, variant: 'outline' as const, icon: Package };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn('gap-1 capitalize', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
