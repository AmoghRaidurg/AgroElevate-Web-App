import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiService } from '@/hooks/useAiService';

export function AiStatusBanner() {
  const { status, baseUrl, recheck } = useAiService();

  if (status === 'checking' || status === 'online' || status === 'unknown') return null;

  return (
    <div
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
      role="alert"
    >
      <div className="flex items-start gap-3 flex-1">
        <WifiOff className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">Intelligence service offline</p>
          <p className="text-xs text-muted-foreground mt-1">
            Showing cached or limited data. Expected endpoint: <span className="font-mono">{baseUrl}</span>
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => recheck()}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}
