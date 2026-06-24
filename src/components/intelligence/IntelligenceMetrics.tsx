import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Shield, Target } from 'lucide-react';

export function TrendBadge({ trend }: { trend: string }) {
  const t = trend?.toLowerCase() ?? 'stable';
  if (t === 'rising' || t === 'up') {
    return <Badge className="bg-primary/20 text-primary border-primary/30 gap-1"><TrendingUp className="h-3 w-3" /> Rising</Badge>;
  }
  if (t === 'falling' || t === 'down') {
    return <Badge className="bg-red-500/20 text-red-400 gap-1"><TrendingDown className="h-3 w-3" /> Falling</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" /> Stable</Badge>;
}

export function ConfidenceBar({ value, label = 'Confidence' }: { value: number; label?: string }) {
  const pct = Math.round((value <= 1 ? value * 100 : value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function ScoreCard({
  title, value, subtitle, icon: Icon, variant = 'default',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: 'from-muted/30 to-transparent border-border/50',
    success: 'from-primary/10 to-transparent border-primary/30',
    warning: 'from-amber-500/10 to-transparent border-amber-500/30',
    danger: 'from-red-500/10 to-transparent border-red-500/30',
  };
  return (
    <div className={`glass-card rounded-xl p-5 bg-gradient-to-br ${colors[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className="h-8 w-8 text-primary/40" />}
      </div>
    </div>
  );
}

export function RiskIndicator({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const level = pct >= 60 ? 'High' : pct >= 35 ? 'Medium' : 'Low';
  const color = pct >= 60 ? 'text-red-400' : pct >= 35 ? 'text-amber-400' : 'text-primary';
  return (
    <div className="flex items-center gap-2 text-sm">
      <Shield className={`h-4 w-4 ${color}`} />
      <span className={color}>Risk: {level} ({pct}%)</span>
    </div>
  );
}

export function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Target className="h-3 w-3" /> {label}: {value}
    </span>
  );
}
