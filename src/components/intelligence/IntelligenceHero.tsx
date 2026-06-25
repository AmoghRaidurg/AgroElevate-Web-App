import { RefreshCw, Brain, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReactNode } from 'react';

interface HeroMetricItem {
  label: string;
  value: string | number;
  subtitle?: string;
}

interface IntelligenceHeroProps {
  title: string;
  subtitle: string;
  metrics: HeroMetricItem[];
  loading?: boolean;
  liveData?: boolean;
  modelVersion?: string;
  onRefresh: () => void;
  children?: ReactNode;
}

export function IntelligenceHero({
  title,
  subtitle,
  metrics,
  loading,
  liveData,
  modelVersion,
  onRefresh,
  children,
}: IntelligenceHeroProps) {
  return (
    <div className="mb-8 -mx-2 md:-mx-4">
      <div className="glass-intelligence rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-highlight/20 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-2 rounded-full bg-highlight/20 border border-highlight/30 px-3 py-1">
                <Zap className="h-3.5 w-3.5 text-highlight" />
                <span className="text-xs font-bold uppercase tracking-widest text-highlight">AI Command Center</span>
              </div>
              {liveData && (
                <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                  <Sparkles className="h-3 w-3" /> Live commerce data
                </Badge>
              )}
              {modelVersion && (
                <Badge variant="secondary" className="text-xs">Model {modelVersion}</Badge>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <Brain className="h-9 w-9 text-highlight shrink-0" />
              {title}
            </h1>
            <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-2xl">{subtitle}</p>
          </div>
          <Button
            onClick={onRefresh}
            disabled={loading}
            variant="outline"
            className="gap-2 shrink-0 border-highlight/30 bg-highlight/5 hover:bg-highlight/10 hover:border-highlight/50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Intelligence
          </Button>
        </div>

        {metrics.length > 0 && (
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl bg-background/40 border border-white/10 dark:border-white/8 p-4 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{m.label}</p>
                <p className="font-display text-2xl md:text-3xl font-bold tabular-nums mt-1 text-foreground">{m.value}</p>
                {m.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{m.subtitle}</p>}
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
