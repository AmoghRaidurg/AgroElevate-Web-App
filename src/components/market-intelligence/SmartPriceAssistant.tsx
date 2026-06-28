import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/design/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { fetchPriceSuggestion, type PriceSuggestion } from '@/lib/marketIntelligenceApi';
import type { MarketLocation } from '@/lib/marketIntelligenceApi';

interface Props {
  cropName: string;
  location?: Partial<MarketLocation>;
  onSuggestedPrice?: (price: number) => void;
  onSuggestionChange?: (suggestion: PriceSuggestion | null) => void;
}

export function SmartPriceAssistant({ cropName, location, onSuggestedPrice, onSuggestionChange }: Props) {
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cropName || cropName.length < 2) {
      setSuggestion(null);
      onSuggestionChange?.(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await fetchPriceSuggestion(cropName, location);
      setSuggestion(result);
      onSuggestionChange?.(result);
      if (result.suggested_price && onSuggestedPrice) {
        onSuggestedPrice(result.suggested_price);
      }
      setLoading(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [cropName, location, onSuggestedPrice, onSuggestionChange]);

  if (!cropName || cropName.length < 2) return null;

  return (
    <GlassCard variant="intelligence" className="mt-3 border-highlight/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-highlight" />
        <h4 className="font-semibold text-sm">Smart Price Assistant</h4>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {suggestion?.insufficient_data ? (
        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
      ) : suggestion ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-background/40 p-2">
              <p className="text-muted-foreground">Today&apos;s Mandi</p>
              <p className="font-bold text-base">₹{suggestion.mandi_modal_price}/kg</p>
            </div>
            <div className="rounded-lg bg-background/40 p-2">
              <p className="text-muted-foreground">Nearby Highest</p>
              <p className="font-bold text-base">₹{suggestion.nearby_highest_price}/kg</p>
            </div>
            <div className="rounded-lg bg-background/40 p-2">
              <p className="text-muted-foreground">AgroElevate Avg</p>
              <p className="font-bold text-base">₹{suggestion.agroelevate_average}/kg</p>
            </div>
            <div className="rounded-lg bg-highlight/10 p-2 border border-highlight/30">
              <p className="text-muted-foreground">Suggested Price</p>
              <p className="font-bold text-base text-highlight">₹{suggestion.suggested_price}/kg</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Confidence {suggestion.confidence_pct}%</Badge>
            <Badge variant="outline">Demand: {suggestion.demand}</Badge>
            <Badge variant="outline">+₹{suggestion.expected_additional_earnings_per_kg}/kg vs mandi</Badge>
          </div>
          <p className="text-xs font-medium text-highlight">{suggestion.recommendation}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.reason}</p>
          {location?.district && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {location.district}, {location.state}
            </p>
          )}
        </div>
      ) : null}
    </GlassCard>
  );
}
