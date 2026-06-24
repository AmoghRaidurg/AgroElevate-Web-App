import { GlassCard } from '@/components/design/GlassCard';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface IntelligencePanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function IntelligencePanel({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerAction,
}: IntelligencePanelProps) {
  return (
    <GlassCard variant="intelligence" className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-highlight shrink-0" />}
              {title}
            </h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          {headerAction}
        </div>
        {children}
      </div>
    </GlassCard>
  );
}
