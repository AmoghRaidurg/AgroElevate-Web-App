import { useCallback, useEffect, useState } from 'react';
import { GlassCard } from '@/components/design/GlassCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchMarketAdminMonitor, refreshMarketData } from '@/lib/marketIntelligenceApi';
import { RefreshCw, Download, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMarketMonitor() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchMarketAdminMonitor());
    } catch {
      toast.error('Failed to load market monitor');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMarketData();
      await load();
      toast.success('Market data refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Market Intelligence Monitor"
        subtitle="API health, sync status, and dataset management"
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Manual Refresh
          </Button>
        }
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[
          { label: 'API Health', value: String(status?.api_health ?? '—'), icon: Activity },
          { label: 'Records', value: String(status?.records ?? '—') },
          { label: 'Markets', value: String(status?.markets ?? '—') },
          { label: 'States', value: String(status?.states ?? '—') },
          { label: 'Districts', value: String(status?.districts ?? '—') },
          { label: 'Last Sync', value: status?.last_sync ? new Date(String(status.last_sync)).toLocaleString() : '—' },
          { label: 'Next Sync', value: status?.next_sync ? new Date(String(status.next_sync)).toLocaleString() : '—' },
          { label: 'Dataset Version', value: String(status?.dataset_version ?? '—') },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-semibold mt-1 text-sm">{c.value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mt-6 p-4">
        <h3 className="font-semibold mb-3">Providers</h3>
        <div className="flex flex-wrap gap-2">
          {((status?.providers as Array<{ provider: string; status: string }>) ?? []).map((p) => (
            <Badge key={p.provider} variant="outline">{p.provider}: {p.status}</Badge>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-6 p-4">
        <h3 className="font-semibold mb-3">Sync Logs</h3>
        {((status?.logs as Array<{ time: string; level: string; message: string }>) ?? []).map((l, i) => (
          <p key={i} className="text-xs text-muted-foreground">{l.time} [{l.level}] {l.message}</p>
        ))}
      </GlassCard>
    </>
  );
}
