import { AlertCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReactNode } from 'react';
import { DashboardSkeleton } from '@/components/design/skeletons';
import { GlassCard } from '@/components/design/GlassCard';

interface Props {
  loading: boolean;
  error: string | null;
  children: ReactNode;
}

export function IntelligenceShell({ loading, error, children }: Props) {
  return (
    <div className="space-y-6">
      {error && (
        <GlassCard variant="elevated" className="border-destructive/40">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">AI service unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Start: cd ai-service && uvicorn app.main:app --reload --port 8000
              </p>
            </div>
          </div>
        </GlassCard>
      )}
      {loading && !error ? <DashboardSkeleton /> : children}
    </div>
  );
}

export function InsightFeed({ insights }: { insights: Array<{ title: string; message: string; priority: string; crop_name?: string | null }> }) {
  if (!insights?.length) return null;
  const accent = (p: string) =>
    p === 'high' ? 'border-l-red-500' : p === 'medium' ? 'border-l-amber-500' : 'border-l-highlight';

  return (
    <GlassCard variant="intelligence">
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none rounded-2xl" />
      <div className="relative">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-highlight" />
          AI Insights Feed
        </h3>
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={i} className={`p-4 rounded-xl border border-white/10 border-l-4 ${accent(ins.priority)} bg-background/30 backdrop-blur-sm`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={ins.priority === 'high' ? 'destructive' : 'secondary'}>{ins.priority}</Badge>
                {ins.crop_name && <span className="text-xs text-muted-foreground">{ins.crop_name}</span>}
              </div>
              <p className="font-medium">{ins.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{ins.message}</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
