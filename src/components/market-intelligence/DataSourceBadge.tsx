import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Database, Globe2 } from 'lucide-react';

export interface MarketDataSourceStatus {
  data_badge?: string;
  data_updated_ago?: string | null;
  data_mode?: string;
  provider?: string;
  fallback_active?: boolean;
}

function badgeIcon(label: string) {
  if (label.includes('Official Government')) return Globe2;
  if (label.includes('Cached Government')) return CheckCircle2;
  return Database;
}

/** Transparent data-source badge for Market Intelligence dashboards. */
export function DataSourceBadge({ dataSource }: { dataSource?: MarketDataSourceStatus | null }) {
  const label = dataSource?.data_badge ?? 'Validated Demonstration Dataset';
  const ago = dataSource?.data_updated_ago;
  const Icon = badgeIcon(label);

  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}</span>
      {ago ? <span className="text-muted-foreground">· Updated {ago}</span> : null}
    </Badge>
  );
}
