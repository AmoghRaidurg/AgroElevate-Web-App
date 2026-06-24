import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type GlassVariant = 'default' | 'primary' | 'accent' | 'highlight' | 'intelligence' | 'elevated';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: GlassVariant;
  glow?: boolean;
  padding?: boolean;
}

const variantStyles: Record<GlassVariant, string> = {
  default: 'border-border/70',
  primary: 'border-primary/35 hover:border-primary/50',
  accent: 'border-accent/35 hover:border-accent/50',
  highlight: 'border-highlight/35 hover:border-highlight/50',
  intelligence: 'glass-intelligence',
  elevated: 'glass-elevated',
};

export function GlassCard({
  children,
  className,
  variant = 'default',
  glow = false,
  padding = true,
}: GlassCardProps) {
  const isSpecial = variant === 'intelligence' || variant === 'elevated';

  return (
    <div
      className={cn(
        !isSpecial && 'glass-card',
        'rounded-2xl transition-all duration-300',
        !isSpecial && variantStyles[variant],
        isSpecial && variantStyles[variant],
        glow && 'glass-card-glow',
        padding && 'p-6',
        (variant === 'intelligence' || glow) && 'relative overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}
