import { supabase } from './supabaseClient';

export interface ManufacturingBatch {
  id: string;
  industrialist_id: string;
  original_farmer_id: string;
  source_order_id: string | null;
  source_order_item_id: string;
  source_product_id: string | null;
  input_crop_name: string;
  input_qty: number;
  input_unit: string;
  output_qty: number | null;
  output_unit: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  royalty_percent: number;
  created_at: string;
  completed_at: string | null;
}

export interface RoyaltyObligation {
  id: string;
  obligation_type: 'immediate' | 'deferred';
  status: 'pending' | 'partially_settled' | 'settled' | 'cancelled';
  beneficiary_farmer_id: string;
  obligor_id: string;
  royalty_percent: number;
  source_order_item_id: string | null;
  manufacturing_batch_id: string | null;
  pending_amount: number;
  settled_amount: number;
  created_at: string;
  settled_at: string | null;
}

export interface ProcessedProduct {
  id: string;
  manufacturing_batch_id: string;
  royalty_obligation_id: string;
  industrialist_id: string;
  original_farmer_id: string;
  name: string;
  unit: string;
  qty_produced: number;
  qty_listed: number;
  qty_sold: number;
  royalty_percent: number;
  product_id: string | null;
  status: 'created' | 'listed' | 'depleted' | 'archived';
  created_at: string;
  listed_at: string | null;
}

export async function fetchManufacturingBatches(): Promise<ManufacturingBatch[]> {
  const { data, error } = await supabase.rpc('get_my_manufacturing_batches');
  if (error) {
    console.error('Manufacturing batches error:', error);
    return [];
  }
  return (data ?? []) as ManufacturingBatch[];
}

export async function fetchRoyaltyObligations(): Promise<RoyaltyObligation[]> {
  const { data, error } = await supabase.rpc('get_my_royalty_obligations');
  if (error) {
    console.error('Royalty obligations error:', error);
    return [];
  }
  return (data ?? []) as RoyaltyObligation[];
}

export async function fetchProcessedProducts(): Promise<ProcessedProduct[]> {
  const { data, error } = await supabase.rpc('get_my_processed_products');
  if (error) {
    console.error('Processed products error:', error);
    return [];
  }
  return (data ?? []) as ProcessedProduct[];
}

export async function completeManufacturingBatch(
  batchId: string,
  outputQty: number,
  name: string,
  unit = 'kg'
) {
  const { data, error } = await supabase.rpc('complete_manufacturing_batch', {
    p_batch_id: batchId,
    p_output_qty: outputQty,
    p_name: name,
    p_unit: unit,
  });
  if (error) throw error;
  return data as { batch_id: string; processed_product_id: string; royalty_obligation_id: string };
}

export async function listProcessedProduct(
  processedProductId: string,
  pricePerUnit: number,
  qty: number,
  cropType = 'Processed'
) {
  const { data, error } = await supabase.rpc('list_processed_product', {
    p_processed_product_id: processedProductId,
    p_price_per_unit: pricePerUnit,
    p_qty: qty,
    p_crop_type: cropType,
  });
  if (error) throw error;
  return data as { product_id: string; processed_product_id: string };
}

export function sumPendingObligations(obligations: RoyaltyObligation[], farmerId: string): number {
  return obligations
    .filter((o) => o.beneficiary_farmer_id === farmerId && o.status === 'pending')
    .reduce((s, o) => s + Number(o.pending_amount ?? 0), 0);
}

export function sumSettledObligations(obligations: RoyaltyObligation[], farmerId: string): number {
  return obligations
    .filter((o) => o.beneficiary_farmer_id === farmerId)
    .reduce((s, o) => s + Number(o.settled_amount ?? 0), 0);
}

export function countOpenBatches(batches: ManufacturingBatch[]): number {
  return batches.filter((b) => b.status === 'draft' || b.status === 'in_progress').length;
}

export function countOpenObligations(obligations: RoyaltyObligation[], obligorId: string): number {
  return obligations.filter(
    (o) => o.obligor_id === obligorId && (o.status === 'pending' || o.status === 'partially_settled')
  ).length;
}
