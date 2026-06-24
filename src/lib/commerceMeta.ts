/**
 * Commerce metadata stored in products.description (JSON text).
 * Matches server _parse_product_commerce_meta / checkout_order.
 */

export interface OwnershipChainEntry {
  user_id: string;
  role: string;
  acquired_at: string;
}

export type ProductKind = 'raw_farmer' | 'trader_relist' | 'processed';

export interface ProductCommerceMeta {
  product_kind?: ProductKind;
  original_farmer_id: string;
  current_owner_id: string;
  ownership_chain: OwnershipChainEntry[];
  royalty_percent: number;
  source_order_item_id?: string;
  source_order_item_qty?: number;
  purchase_price_per_unit?: number;
  processed_product_id?: string;
  royalty_obligation_id?: string;
  source_batch_id?: string;
}

export const DEFAULT_ROYALTY_PERCENT = 12.5;

export function clampRoyaltyPercent(pct: number): number {
  return Math.min(12.5, Math.max(10, pct));
}

export function parseCommerceMeta(description?: string | null): Partial<ProductCommerceMeta> | null {
  if (!description?.trim()) return null;
  try {
    const parsed = JSON.parse(description) as Record<string, unknown>;
    const royalty = Number(parsed.royalty_percent ?? parsed.royaltyPercent ?? DEFAULT_ROYALTY_PERCENT);
    return {
      product_kind: (parsed.product_kind as ProductKind) ?? undefined,
      original_farmer_id: String(parsed.original_farmer_id ?? parsed.originalFarmerId ?? ''),
      current_owner_id: String(parsed.current_owner_id ?? parsed.currentOwnerId ?? ''),
      ownership_chain: (parsed.ownership_chain ?? parsed.ownershipChain ?? []) as OwnershipChainEntry[],
      royalty_percent: clampRoyaltyPercent(royalty),
      source_order_item_id: parsed.source_order_item_id as string | undefined,
      source_order_item_qty: parsed.source_order_item_qty as number | undefined,
      purchase_price_per_unit: parsed.purchase_price_per_unit as number | undefined,
      processed_product_id: parsed.processed_product_id as string | undefined,
      royalty_obligation_id: parsed.royalty_obligation_id as string | undefined,
      source_batch_id: parsed.source_batch_id as string | undefined,
    };
  } catch {
    return null;
  }
}

export function buildFarmerListingMeta(farmerId: string, role = 'farmer'): string {
  const meta: ProductCommerceMeta = {
    product_kind: 'raw_farmer',
    original_farmer_id: farmerId,
    current_owner_id: farmerId,
    ownership_chain: [{ user_id: farmerId, role, acquired_at: new Date().toISOString() }],
    royalty_percent: DEFAULT_ROYALTY_PERCENT,
  };
  return JSON.stringify(meta);
}

export function buildRelistMeta(
  traderId: string,
  item: {
    originalFarmerId: string | null;
    orderItemId: string;
    listQty: number;
    pricePerUnit: number;
    ownershipChain?: OwnershipChainEntry[];
  }
): string {
  const chain = [...(item.ownershipChain ?? [])];
  if (!chain.some((e) => e.user_id === traderId)) {
    chain.push({ user_id: traderId, role: 'middleman', acquired_at: new Date().toISOString() });
  }
  const meta: ProductCommerceMeta = {
    product_kind: 'trader_relist',
    original_farmer_id: item.originalFarmerId ?? traderId,
    current_owner_id: traderId,
    ownership_chain: chain,
    royalty_percent: DEFAULT_ROYALTY_PERCENT,
    source_order_item_id: item.orderItemId,
    source_order_item_qty: item.listQty,
    purchase_price_per_unit: item.pricePerUnit,
  };
  return JSON.stringify(meta);
}

export type WalletHistoryType =
  | 'deposit'
  | 'withdrawal'
  | 'purchase'
  | 'sale_income'
  | 'royalty_income'
  | 'royalty_paid'
  | 'transfer_in'
  | 'transfer_out'
  | 'refund';

export const WALLET_TYPE_LABELS: Record<WalletHistoryType, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  purchase: 'Purchase',
  sale_income: 'Sale Income',
  royalty_income: 'Royalty Income',
  royalty_paid: 'Royalty Paid',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  refund: 'Refund',
};
