import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/design/GlassCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  computeListingPriceBounds,
  GUIDANCE_BADGE_COPY,
  validateListingPriceInput,
  validateListingQuantityInput,
  type ListingPriceBounds,
} from '@/lib/listingPriceValidation';
import { fetchMspForCrop, type MarketLocation, type PriceSuggestion } from '@/lib/marketIntelligenceApi';
import { formatInrPerKg } from '@/lib/marketIntelligenceDisplay';

interface Props {
  cropName: string;
  location?: Partial<MarketLocation>;
  suggestion: PriceSuggestion | null;
  price: string;
  onPriceChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  onSubmitReadyChange: (ready: boolean) => void;
}

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors" aria-label={`About ${label}`}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ReferenceRow({
  label,
  value,
  tip,
  highlight,
}: {
  label: string;
  value: string;
  tip?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 text-sm py-1.5', highlight && 'font-medium text-highlight')}>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {label}
        {tip ? <InfoTip label={label} text={tip} /> : null}
      </span>
      <span className={cn('tabular-nums transition-all duration-200', highlight && 'text-highlight')}>{value}</span>
    </div>
  );
}

export function FarmerListingPriceField({
  cropName,
  location,
  suggestion,
  price,
  onPriceChange,
  quantity,
  onQuantityChange,
  onSubmitReadyChange,
}: Props) {
  const [mspPrice, setMspPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!cropName || cropName.length < 2) {
      setMspPrice(null);
      return;
    }
    let active = true;
    fetchMspForCrop(cropName).then((msp) => {
      if (active) setMspPrice(msp);
    });
    return () => { active = false; };
  }, [cropName]);

  const bounds: ListingPriceBounds = useMemo(
    () => computeListingPriceBounds(
      mspPrice,
      suggestion?.mandi_modal_price ?? 0,
      suggestion?.suggested_price ?? 0,
    ),
    [mspPrice, suggestion],
  );

  const priceValidation = useMemo(() => validateListingPriceInput(price, bounds), [price, bounds]);
  const quantityValidation = useMemo(() => validateListingQuantityInput(quantity), [quantity]);
  const farmerPriceNum = Number(price);
  const showGuidance = priceValidation.valid && priceValidation.guidanceBadge && priceValidation.guidanceBadge !== 'invalid';
  const guidance = showGuidance && priceValidation.guidanceBadge
    ? GUIDANCE_BADGE_COPY[priceValidation.guidanceBadge]
    : null;

  useEffect(() => {
    onSubmitReadyChange(
      Boolean(cropName.trim())
      && priceValidation.valid
      && quantityValidation.valid,
    );
  }, [cropName, priceValidation.valid, quantityValidation.valid, onSubmitReadyChange]);

  const applyPrice = (next: number) => onPriceChange(Math.max(0, next).toFixed(2));

  const quickButtons = [
    {
      label: 'Use Suggested',
      disabled: bounds.suggestedPrice <= 0,
      onClick: () => applyPrice(bounds.suggestedPrice),
    },
    {
      label: '+₹1',
      disabled: !Number.isFinite(farmerPriceNum) || farmerPriceNum <= 0,
      onClick: () => applyPrice(farmerPriceNum + 1),
    },
    {
      label: '+₹2',
      disabled: !Number.isFinite(farmerPriceNum) || farmerPriceNum <= 0,
      onClick: () => applyPrice(farmerPriceNum + 2),
    },
    {
      label: '+₹5',
      disabled: !Number.isFinite(farmerPriceNum) || farmerPriceNum <= 0,
      onClick: () => applyPrice(farmerPriceNum + 5),
    },
    {
      label: 'Reset',
      disabled: bounds.suggestedPrice <= 0,
      onClick: () => applyPrice(bounds.suggestedPrice),
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3 animate-in fade-in-0 duration-300">
        {suggestion && !suggestion.insufficient_data && bounds.suggestedPrice > 0 && (
          <div className="rounded-xl border border-highlight/25 bg-highlight/5 p-3 transition-all duration-200">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Sparkles className="h-3.5 w-3.5 text-highlight" />
              AI Suggested Price
            </div>
            <p className="text-lg font-bold text-highlight tabular-nums">{formatInrPerKg(bounds.suggestedPrice)}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">✓ Recommended by AgroElevate AI</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="farmer-listing-price">Your Price/kg (₹)</Label>
              {guidance && (
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-all duration-200',
                    guidance.className,
                  )}
                >
                  {guidance.label}
                </span>
              )}
            </div>
            <Input
              id="farmer-listing-price"
              name="price"
              type="number"
              required
              min="0.01"
              step="0.01"
              className={cn(
                'bg-muted/30 transition-colors',
                !priceValidation.valid && price ? 'border-red-500 focus-visible:ring-red-500/30' : '',
              )}
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
            />
            {guidance && (
              <p className={cn('text-[11px] transition-opacity duration-200', guidance.className.split(' ')[1])}>
                {guidance.detail}
              </p>
            )}
            {!priceValidation.valid && price ? (
              <p className="text-xs text-red-500 animate-in fade-in-0 duration-200">{priceValidation.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="farmer-listing-qty">Qty (kg)</Label>
            <Input
              id="farmer-listing-qty"
              name="quantity"
              type="text"
              inputMode="decimal"
              required
              className={cn(
                'bg-muted/30',
                !quantityValidation.valid && quantity ? 'border-red-500 focus-visible:ring-red-500/30' : '',
              )}
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
            />
            {!quantityValidation.valid && quantity ? (
              <p className="text-xs text-red-500 animate-in fade-in-0 duration-200">{quantityValidation.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickButtons.map((btn) => (
            <Button
              key={btn.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              disabled={btn.disabled}
              onClick={btn.onClick}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        <GlassCard className="p-3 border border-border/40 transition-all duration-200">
          <p className="text-xs font-semibold mb-2">Market Reference</p>
          <ReferenceRow
            label="MSP"
            value={bounds.mspPrice ? formatInrPerKg(bounds.mspPrice) : 'Not available'}
            tip="Government Minimum Support Price when declared for this crop."
          />
          <ReferenceRow
            label="Current Mandi"
            value={bounds.mandiPrice > 0 ? formatInrPerKg(bounds.mandiPrice) : '—'}
            tip="Today's modal mandi price in your region."
          />
          <ReferenceRow
            label="AI Suggested"
            value={bounds.suggestedPrice > 0 ? formatInrPerKg(bounds.suggestedPrice) : '—'}
            tip="AgroElevate AI recommended selling price based on mandi, demand, and marketplace trends."
            highlight
          />
          <ReferenceRow
            label="Minimum Allowed"
            value={formatInrPerKg(bounds.minimumPrice)}
            tip={bounds.minimumSource === 'MSP'
              ? 'Legal floor price is MSP when available.'
              : 'When MSP is unavailable, the current mandi modal price is the minimum allowed price.'}
          />
          <ReferenceRow
            label="Farmer Price"
            value={price && Number.isFinite(farmerPriceNum) && farmerPriceNum > 0 ? formatInrPerKg(farmerPriceNum) : '—'}
          />
          <ReferenceRow
            label="Expected Profit"
            value={
              priceValidation.expectedProfitPerKg != null
                ? `+₹${priceValidation.expectedProfitPerKg.toFixed(2)}/kg`
                : '—'
            }
            tip="Estimated gain per kg above the minimum allowed price (MSP or mandi)."
          />
        </GlassCard>
      </div>
    </TooltipProvider>
  );
}
