export type MinimumPriceSource = 'MSP' | 'Mandi';

export type PriceGuidanceBadge =
  | 'excellent'
  | 'high'
  | 'very_high'
  | 'competitive'
  | 'invalid';

export interface ListingPriceBounds {
  mspPrice: number | null;
  mandiPrice: number;
  suggestedPrice: number;
  minimumPrice: number;
  minimumSource: MinimumPriceSource;
}

export interface ListingPriceValidation {
  valid: boolean;
  message: string | null;
  guidanceBadge: PriceGuidanceBadge | null;
  bounds: ListingPriceBounds;
  expectedProfitPerKg: number | null;
}

export function computeListingPriceBounds(
  mspPrice: number | null | undefined,
  mandiPrice: number,
  suggestedPrice: number,
): ListingPriceBounds {
  const msp = typeof mspPrice === 'number' && mspPrice > 0 ? mspPrice : null;
  const mandi = Number.isFinite(mandiPrice) && mandiPrice > 0 ? mandiPrice : 0;
  const suggested = Number.isFinite(suggestedPrice) && suggestedPrice > 0 ? suggestedPrice : 0;

  if (msp != null) {
    return {
      mspPrice: msp,
      mandiPrice: mandi,
      suggestedPrice: suggested,
      minimumPrice: msp,
      minimumSource: 'MSP',
    };
  }

  return {
    mspPrice: null,
    mandiPrice: mandi,
    suggestedPrice: suggested,
    minimumPrice: mandi > 0 ? mandi : 0.01,
    minimumSource: 'Mandi',
  };
}

export function getPriceGuidanceBadge(
  farmerPrice: number,
  suggestedPrice: number,
  minimumPrice: number,
): PriceGuidanceBadge | null {
  if (!Number.isFinite(farmerPrice) || farmerPrice <= 0) return null;
  if (farmerPrice < minimumPrice) return 'invalid';

  if (suggestedPrice <= 0) return null;

  const ratio = farmerPrice / suggestedPrice;
  if (ratio >= 0.95 && ratio <= 1.05) return 'excellent';
  if (ratio > 1.05 && ratio <= 1.2) return 'high';
  if (ratio > 1.2) return 'very_high';
  if (farmerPrice < suggestedPrice && farmerPrice >= minimumPrice) return 'competitive';
  return 'excellent';
}

export function buildMinimumPriceMessage(bounds: ListingPriceBounds): string {
  const label = bounds.minimumSource === 'MSP' ? 'MSP' : 'Current Mandi';
  return `Minimum selling price is ₹${bounds.minimumPrice.toFixed(2)}/kg (${label}). Please increase your selling price.`;
}

export function validateListingPriceInput(
  priceRaw: string,
  bounds: ListingPriceBounds,
): ListingPriceValidation {
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      valid: false,
      message: 'Enter a valid selling price greater than zero.',
      guidanceBadge: null,
      bounds,
      expectedProfitPerKg: null,
    };
  }

  if (price < bounds.minimumPrice) {
    return {
      valid: false,
      message: buildMinimumPriceMessage(bounds),
      guidanceBadge: 'invalid',
      bounds,
      expectedProfitPerKg: null,
    };
  }

  const guidanceBadge = getPriceGuidanceBadge(price, bounds.suggestedPrice, bounds.minimumPrice);
  return {
    valid: true,
    message: null,
    guidanceBadge: guidanceBadge === 'invalid' ? null : guidanceBadge,
    bounds,
    expectedProfitPerKg: Math.round((price - bounds.minimumPrice) * 100) / 100,
  };
}

export function validateListingQuantityInput(qtyRaw: string): {
  valid: boolean;
  value: number | null;
  message: string | null;
} {
  const trimmed = qtyRaw.trim();
  if (!trimmed) {
    return { valid: false, value: null, message: 'Quantity is required.' };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, value: null, message: 'Enter a valid quantity in kg (numbers only).' };
  }
  const qty = Number(trimmed);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { valid: false, value: null, message: 'Quantity must be greater than zero.' };
  }
  return { valid: true, value: qty, message: null };
}

export const GUIDANCE_BADGE_COPY: Record<
  Exclude<PriceGuidanceBadge, 'invalid'>,
  { label: string; detail: string; className: string }
> = {
  excellent: {
    label: 'Excellent Price',
    detail: 'Likely to sell quickly.',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  high: {
    label: 'High Price',
    detail: 'May take longer to find buyers.',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30',
  },
  very_high: {
    label: 'Very High Price',
    detail: 'Demand may reduce at this price.',
    className: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
  competitive: {
    label: 'Competitive Price',
    detail: 'High chance of quick sale.',
    className: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30',
  },
};
