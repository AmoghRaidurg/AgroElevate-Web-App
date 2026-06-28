import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/design/GlassCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation } from 'lucide-react';
import { fetchMarketStates, fetchMarketDistricts } from '@/lib/marketIntelligenceApi';
import type { MarketLocation } from '@/lib/marketIntelligenceApi';

interface Props {
  location: MarketLocation | null;
  permissionDenied: boolean;
  onManualSelect: (state: string, district: string) => void;
  onRetryGps: () => void;
}

export function LocationSelector({ location, permissionDenied, onManualSelect, onRetryGps }: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');

  useEffect(() => {
    fetchMarketStates().then((r) => setStates(r.states)).catch(() => setStates(['Maharashtra', 'Karnataka', 'Punjab']));
  }, []);

  useEffect(() => {
    if (!state) return;
    fetchMarketDistricts(state).then((r) => setDistricts(r.districts)).catch(() => setDistricts([]));
  }, [state]);

  return (
    <GlassCard className="p-4 mb-4 flex flex-wrap items-center gap-3">
      <MapPin className="h-4 w-4 text-highlight shrink-0" />
      {location ? (
        <span className="text-sm">
          <span className="font-medium">{location.district}, {location.state}</span>
          <span className="text-muted-foreground ml-2">({location.source === 'gps' ? 'GPS' : 'Manual'})</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Detecting location…</span>
      )}
      {permissionDenied && (
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>{states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="District" /></SelectTrigger>
            <SelectContent>{districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!state || !district} onClick={() => onManualSelect(state, district)}>
            Apply
          </Button>
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={onRetryGps} className="ml-auto">
        <Navigation className="h-3.5 w-3.5 mr-1" /> Retry GPS
      </Button>
    </GlassCard>
  );
}
