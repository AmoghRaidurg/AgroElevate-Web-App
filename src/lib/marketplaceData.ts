import { supabase } from './supabaseClient';
import { fetchFarmerRoyaltyIncome } from '@/lib/wallet';
import { parseCommerceMeta, buildRelistMeta, type OwnershipChainEntry } from '@/lib/commerceMeta';

export interface ProductRow {
  id: string;
  name: string;
  crop_type: string;
  price_per_unit: number;
  unit: string;
  quantity: number;
  seller_id: string;
  description?: string | null;
}

export interface RelistMetadata {
  original_farmer_id?: string | null;
  source_order_item_id?: string;
  source_order_item_qty?: number;
  purchase_price_per_unit?: number;
}

export interface FarmerSale {
  orderItemId: string;
  orderId: string;
  cropName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  buyerName: string;
  buyerRole: string;
  createdAt: string;
}

export interface FarmerSalesStats {
  totalSales: number;
  totalRevenue: number;
  directSalesRevenue: number;
  royaltyRevenue: number;
  activeListings: number;
  soldQuantity: number;
  recentSales: FarmerSale[];
  activeProducts: ProductRow[];
}

export interface TraderInventoryItem {
  orderItemId: string;
  orderId: string;
  name: string;
  crop_type: string;
  purchasedQty: number;
  remainingQty: number;
  listedQty: number;
  soldFromListingsQty: number;
  pricePerUnit: number;
  originalFarmerId: string | null;
}

export interface TraderInventoryStats {
  items: TraderInventoryItem[];
  totalRemainingKg: number;
  totalListedKg: number;
  totalPurchasedKg: number;
  activeListingCount: number;
}

export interface OrderLineItem {
  id: string;
  orderId: string;
  cropId: string;
  cropName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  farmerId: string | null;
  sellerId: string | null;
  originalFarmerId: string | null;
  royaltyAmount: number;
  royaltyPercent: number;
  ownershipChain: OwnershipChainEntry[] | null;
}

export interface OrderHeader {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerRole: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface OrderWithItems extends OrderHeader {
  items: OrderLineItem[];
}

export interface TraderResale {
  orderItemId: string;
  orderId: string;
  cropName: string;
  quantity: number;
  salePrice: number;
  totalPrice: number;
  purchasePricePerUnit: number;
  profitEstimate: number;
  buyerName: string;
  createdAt: string;
}

export function parseRelistMetadata(description?: string | null): RelistMetadata | null {
  const meta = parseCommerceMeta(description);
  if (!meta) return null;
  if (meta.source_order_item_id && meta.source_order_item_qty != null) {
    return {
      original_farmer_id: meta.original_farmer_id,
      source_order_item_id: meta.source_order_item_id,
      source_order_item_qty: meta.source_order_item_qty,
      purchase_price_per_unit: meta.purchase_price_per_unit,
    };
  }
  return meta.original_farmer_id ? { original_farmer_id: meta.original_farmer_id } : null;
}

function mapFarmerSale(row: {
  id: string;
  orderId: string;
  cropName: string | null;
  quantity: number | null;
  pricePerUnit: number | null;
  totalPrice: number | null;
  orders: { buyerName: string; buyerRole: string; createdAt: string } | null;
}): FarmerSale {
  return {
    orderItemId: row.id,
    orderId: row.orderId,
    cropName: row.cropName ?? 'Unknown',
    quantity: Number(row.quantity ?? 0),
    pricePerUnit: Number(row.pricePerUnit ?? 0),
    totalPrice: Number(row.totalPrice ?? 0),
    buyerName: row.orders?.buyerName ?? 'Unknown',
    buyerRole: row.orders?.buyerRole ?? '—',
    createdAt: row.orders?.createdAt ?? '',
  };
}

export async function fetchFarmerSalesStats(farmerId: string): Promise<FarmerSalesStats> {
  const [salesResult, productsResult, royaltyIncome] = await Promise.all([
    supabase
      .from('order_items')
      .select(`
        id, orderId, cropName, quantity, pricePerUnit, totalPrice,
        orders!inner ( buyerName, buyerRole, status, createdAt )
      `)
      .eq('farmerId', farmerId)
      .eq('orders.status', 'completed'),
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', farmerId)
      .gt('quantity', 0),
    fetchFarmerRoyaltyIncome(farmerId),
  ]);

  if (salesResult.error) console.error('Farmer sales error:', salesResult.error);
  if (productsResult.error) console.error('Farmer products error:', productsResult.error);

  const recentSales = (salesResult.data ?? [])
    .map((row) => mapFarmerSale(row as Parameters<typeof mapFarmerSale>[0]))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const activeProducts = (productsResult.data ?? []) as ProductRow[];

  const directSalesRevenue = recentSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const royaltyRevenue = royaltyIncome;
  const totalRevenue = directSalesRevenue + royaltyRevenue;
  const soldQuantity = recentSales.reduce((sum, s) => sum + s.quantity, 0);

  return {
    totalSales: recentSales.length,
    totalRevenue,
    directSalesRevenue,
    royaltyRevenue,
    activeListings: activeProducts.length,
    soldQuantity,
    recentSales: recentSales.slice(0, 10),
    activeProducts,
  };
}

export async function fetchTraderPurchases(traderId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      orderId,
      cropId,
      cropName,
      quantity,
      pricePerUnit,
      farmerId,
      originalFarmerId,
      orders!inner ( id, buyerId, status, createdAt )
    `)
    .eq('orders.buyerId', traderId)
    .eq('orders.status', 'completed');

  if (error) {
    console.error('Trader purchases error:', error);
    return [];
  }
  return data ?? [];
}

export async function fetchTraderProducts(traderId: string): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', traderId);

  if (error) {
    console.error('Trader products error:', error);
    return [];
  }
  return (data ?? []) as ProductRow[];
}

export function computeTraderInventory(
  purchases: Awaited<ReturnType<typeof fetchTraderPurchases>>,
  traderProducts: ProductRow[]
): TraderInventoryStats {
  const allocations = new Map<string, { allocated: number; onMarket: number }>();

  for (const product of traderProducts) {
    const meta = parseRelistMetadata(product.description);
    if (!meta?.source_order_item_id || meta.source_order_item_qty == null) continue;

    const entry = allocations.get(meta.source_order_item_id) ?? { allocated: 0, onMarket: 0 };
    entry.allocated += meta.source_order_item_qty;
    entry.onMarket += Number(product.quantity ?? 0);
    allocations.set(meta.source_order_item_id, entry);
  }

  const items: TraderInventoryItem[] = purchases.map((row) => {
    const purchasedQty = Number(row.quantity ?? 0);
    const alloc = allocations.get(row.id) ?? { allocated: 0, onMarket: 0 };
    const remainingQty = Math.max(0, purchasedQty - alloc.allocated);
    const soldFromListingsQty = Math.max(0, alloc.allocated - alloc.onMarket);

    return {
      orderItemId: row.id,
      orderId: row.orderId,
      name: row.cropName ?? 'Unknown',
      crop_type: '',
      purchasedQty,
      remainingQty,
      listedQty: alloc.onMarket,
      soldFromListingsQty,
      pricePerUnit: Number(row.pricePerUnit ?? 0),
      originalFarmerId: row.originalFarmerId ?? null,
    };
  });

  const visibleItems = items.filter(
    (i) => i.remainingQty > 0 || i.listedQty > 0 || i.soldFromListingsQty > 0
  );

  return {
    items: visibleItems,
    totalRemainingKg: visibleItems.reduce((s, i) => s + i.remainingQty, 0),
    totalListedKg: visibleItems.reduce((s, i) => s + i.listedQty, 0),
    totalPurchasedKg: visibleItems.reduce((s, i) => s + i.purchasedQty, 0),
    activeListingCount: traderProducts.filter((p) => p.quantity > 0).length,
  };
}

export async function loadTraderInventory(traderId: string): Promise<TraderInventoryStats> {
  const [purchases, traderProducts] = await Promise.all([
    fetchTraderPurchases(traderId),
    fetchTraderProducts(traderId),
  ]);
  return computeTraderInventory(purchases, traderProducts);
}

export async function relistTraderInventoryItem(
  traderId: string,
  item: TraderInventoryItem,
  listQty: number,
  listPrice: number
): Promise<void> {
  if (listQty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (listQty > item.remainingQty) {
    throw new Error(`Only ${item.remainingQty} kg available to list`);
  }
  if (listPrice <= 0) {
    throw new Error('Price must be greater than zero');
  }

  const description = buildRelistMeta(traderId, {
    originalFarmerId: item.originalFarmerId,
    orderItemId: item.orderItemId,
    listQty,
    pricePerUnit: item.pricePerUnit,
  });

  const { error } = await supabase.from('products').insert({
    name: item.name,
    crop_type: item.crop_type || 'General',
    price_per_unit: listPrice,
    quantity: listQty,
    unit: 'kg',
    seller_id: traderId,
    description,
  });

  if (error) throw error;
}

function parseListingMeta(description?: string | null): Record<string, unknown> {
  if (!description?.trim()) return {};
  try {
    return JSON.parse(description) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchFarmerListings(farmerId: string): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', farmerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function updateFarmerListing(
  productId: string,
  farmerId: string,
  updates: { price_per_unit?: number; quantity?: number; name?: string },
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .eq('seller_id', farmerId);

  if (error) throw error;
}

export async function pauseFarmerListing(productId: string, farmerId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('products')
    .select('quantity, description')
    .eq('id', productId)
    .eq('seller_id', farmerId)
    .single();

  if (fetchErr || !row) throw new Error('Listing not found');

  const meta = parseListingMeta(row.description);
  meta.paused_quantity = row.quantity;
  meta.paused = true;

  const { error } = await supabase
    .from('products')
    .update({ quantity: 0, description: JSON.stringify(meta) })
    .eq('id', productId)
    .eq('seller_id', farmerId);

  if (error) throw error;
}

export async function resumeFarmerListing(productId: string, farmerId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('products')
    .select('quantity, description')
    .eq('id', productId)
    .eq('seller_id', farmerId)
    .single();

  if (fetchErr || !row) throw new Error('Listing not found');

  const meta = parseListingMeta(row.description);
  const restoreQty = Number(meta.paused_quantity ?? 0);
  if (restoreQty <= 0) throw new Error('No paused quantity to restore — edit listing quantity');

  delete meta.paused;
  delete meta.paused_quantity;

  const { error } = await supabase
    .from('products')
    .update({ quantity: restoreQty, description: JSON.stringify(meta) })
    .eq('id', productId)
    .eq('seller_id', farmerId);

  if (error) throw error;
}

export async function fetchBuyerOrders(buyerId: string): Promise<OrderWithItems[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, buyerId, buyerName, buyerRole, totalAmount, status, createdAt')
    .eq('buyerId', buyerId)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Buyer orders error:', error);
    return [];
  }
  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, orderId, cropId, cropName, quantity, pricePerUnit, totalPrice, farmerId, sellerId, originalFarmerId, royaltyAmount, royaltyPercent, ownershipChain')
    .in('orderId', orderIds);

  if (itemsError) console.error('Order items error:', itemsError);

  const itemsByOrder = new Map<string, OrderLineItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    const row = item as Record<string, unknown>;
    list.push({
      ...(item as OrderLineItem),
      sellerId: (row.sellerId as string) ?? item.farmerId ?? null,
      royaltyAmount: Number(row.royaltyAmount ?? 0),
      royaltyPercent: Number(row.royaltyPercent ?? 0),
      ownershipChain: (row.ownershipChain as OwnershipChainEntry[]) ?? null,
    });
    itemsByOrder.set(item.orderId, list);
  }

  return orders.map((o) => ({
    ...(o as OrderHeader),
    items: itemsByOrder.get(o.id) ?? [],
  }));
}

export async function fetchFarmerSalesOrders(farmerId: string): Promise<
  Array<FarmerSale & { orderStatus: string }>
> {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id, orderId, cropName, quantity, pricePerUnit, totalPrice,
      orders!inner ( buyerName, buyerRole, status, createdAt )
    `)
    .eq('farmerId', farmerId)
    .eq('orders.status', 'completed')
    .order('createdAt', { ascending: false, foreignTable: 'orders' });

  if (error) {
    console.error('Farmer sales orders error:', error);
    return [];
  }

  return (data ?? [])
    .map((row) => ({
      ...mapFarmerSale(row as Parameters<typeof mapFarmerSale>[0]),
      orderStatus: (row as { orders: { status: string } }).orders?.status ?? 'completed',
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchTraderResales(traderId: string): Promise<TraderResale[]> {
  const { data: saleItems, error } = await supabase
    .from('order_items')
    .select(`
      id, orderId, cropId, cropName, quantity, pricePerUnit, totalPrice,
      orders!inner ( buyerName, status, createdAt )
    `)
    .eq('farmerId', traderId)
    .eq('orders.status', 'completed');

  if (error) {
    console.error('Trader resales error:', error);
    return [];
  }

  const traderProducts = await fetchTraderProducts(traderId);
  const purchasePriceByProductId = new Map<string, number>();

  for (const product of traderProducts) {
    const meta = parseRelistMetadata(product.description);
    if (meta?.purchase_price_per_unit != null) {
      purchasePriceByProductId.set(product.id, meta.purchase_price_per_unit);
    }
  }

  return (saleItems ?? [])
    .map((row) => {
    const qty = Number(row.quantity ?? 0);
    const salePrice = Number(row.pricePerUnit ?? 0);
    const totalPrice = Number(row.totalPrice ?? 0);
    const purchasePrice =
      purchasePriceByProductId.get(row.cropId) ?? salePrice * 0.7;
    const profitEstimate = totalPrice - purchasePrice * qty;

    return {
      orderItemId: row.id,
      orderId: row.orderId,
      cropName: row.cropName ?? 'Unknown',
      quantity: qty,
      salePrice,
      totalPrice,
      purchasePricePerUnit: purchasePrice,
      profitEstimate,
      buyerName: (row as { orders: { buyerName: string; createdAt: string } }).orders?.buyerName ?? 'Unknown',
      createdAt: (row as { orders: { createdAt: string } }).orders?.createdAt ?? '',
    };
  })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchSupplierProfiles(farmerIds: string[]) {
  const unique = [...new Set(farmerIds.filter(Boolean))];
  if (!unique.length) return new Map<string, { name: string; email?: string }>();

  const { data } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', unique);

  const map = new Map<string, { name: string; email?: string }>();
  for (const p of data ?? []) {
    map.set(p.id, { name: p.name, email: p.email });
  }
  return map;
}
