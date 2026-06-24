import { useEffect, useMemo, useState, useCallback } from 'react';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Store } from 'lucide-react';
import { getWalletInfo } from '@/lib/wallet';
import { checkoutOrder } from '@/lib/checkout';
import { buildFarmerListingMeta } from '@/lib/commerceMeta';
import { loadTraderInventory, relistTraderInventoryItem, type TraderInventoryItem } from '@/lib/marketplaceData';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductCard, getProductImage } from '@/components/marketplace/ProductCard';
import { MarketplaceFilters } from '@/components/marketplace/MarketplaceFilters';
import { FarmerMyListings } from '@/components/marketplace/FarmerMyListings';
import { CartSheet } from '@/components/marketplace/CartSheet';
import { DashboardSkeleton } from '@/components/design/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Product {
  id: string;
  name: string;
  crop_type: string;
  price_per_unit: number;
  unit: string;
  quantity: number;
  seller_id: string;
  description?: string;
}

export default function Marketplace() {
  const { session, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [walletBalance, setWalletBalance] = useState(0);
  const [inventory, setInventory] = useState<TraderInventoryItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [relistOpen, setRelistOpen] = useState(false);
  const [relistItem, setRelistItem] = useState<TraderInventoryItem | null>(null);
  const [relistQty, setRelistQty] = useState('');
  const [relistPrice, setRelistPrice] = useState('');
  const [relistSubmitting, setRelistSubmitting] = useState(false);
  const [farmerView, setFarmerView] = useState<'browse' | 'my-listings'>('browse');

  const isFarmer = profile?.role === 'farmer';
  const isTrader = profile?.role === 'middleman';
  const isIndustrialist = profile?.role === 'industrialist';
  const isCustomer = profile?.role === 'customer';
  const canPurchase = isTrader || isIndustrialist || isCustomer;

  const refreshTraderInventory = useCallback(async (userId: string) => {
    const stats = await loadTraderInventory(userId);
    setInventory(stats.items.filter((i) => i.remainingQty > 0));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*');
    setProducts(data || []);
    if (session?.user.id) {
      const { balance } = await getWalletInfo(session.user.id);
      setWalletBalance(balance);
      if (isTrader) await refreshTraderInventory(session.user.id);
    }
    setLoading(false);
  }, [session, isTrader, refreshTraderInventory]);

  useEffect(() => { loadData(); }, [loadData]);

  const cropTypes = useMemo(() => [...new Set(products.map((p) => p.crop_type))].sort(), [products]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      if (p.quantity <= 0) return false;
      if (p.seller_id === session?.user?.id) return false;
      if (!p.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (cropFilter !== 'all' && p.crop_type !== cropFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price_per_unit - b.price_per_unit;
      if (sortBy === 'price-desc') return b.price_per_unit - a.price_per_unit;
      if (sortBy === 'qty') return b.quantity - a.quantity;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [query, cropFilter, sortBy, products, session]);

  const addToCart = (id: string) => {
    if (!canPurchase) return toast.error('Sign in as customer, trader, or industrialist to purchase');
    const p = products.find((prod) => prod.id === id);
    if (!p || p.quantity <= 0) return toast.error('Out of stock');
    setCart((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) {
        if (found.qty >= p.quantity) { toast.error(`Only ${p.quantity} kg available`); return prev; }
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id, qty: 1 }];
    });
    setCartOpen(true);
  };

  const changeQty = (id: string, delta: number) => {
    const p = products.find((prod) => prod.id === id);
    const maxQty = p?.quantity ?? 1;
    setCart((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const next = Math.max(1, i.qty + delta);
      if (next > maxQty) { toast.error(`Only ${maxQty} kg available`); return { ...i, qty: maxQty }; }
      return { ...i, qty: next };
    }));
  };

  const totalAmount = useMemo(() => cart.reduce((sum, i) => {
    const p = products.find((prod) => prod.id === i.id);
    return sum + (p ? p.price_per_unit * i.qty : 0);
  }, 0), [cart, products]);

  const cartItems = useMemo(() => cart.map((item) => {
    const p = products.find((prod) => prod.id === item.id);
    return { id: item.id, name: p?.name ?? '', qty: item.qty, lineTotal: (p?.price_per_unit ?? 0) * item.qty };
  }), [cart, products]);

  const checkout = async () => {
    if (!session) return toast.error('Login required');
    for (const item of cart) {
      const p = products.find((prod) => prod.id === item.id);
      if (!p || item.qty > p.quantity) return toast.error(`Insufficient stock for ${p?.name ?? 'item'}`);
    }
    if (walletBalance < totalAmount) return toast.error('Insufficient wallet balance. Please add funds.');
    try {
      const result = await checkoutOrder(cart);
      const hasTraderRoyalty = isIndustrialist && cart.some((item) => {
        const product = products.find((p) => p.id === item.id);
        if (!product?.description) return false;
        try {
          const meta = JSON.parse(product.description);
          return meta.product_kind === 'trader_relist' || !!meta.source_order_item_id;
        } catch { return false; }
      });
      if (hasTraderRoyalty) toast.success('12.5% royalty credited to original farmer');
      toast.success(`Order placed! Total: ₹${Number(result.total_amount).toLocaleString()}`);
      setCart([]);
      setCartOpen(false);
      await loadData();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Checkout failed';
      toast.error(message);
    }
  };

  const listProduce = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from('products').insert({
      name: form.get('name'), crop_type: form.get('crop_type'),
      price_per_unit: Number(form.get('price')), quantity: Number(form.get('quantity')),
      unit: 'kg', seller_id: session?.user.id,
      description: session?.user.id ? buildFarmerListingMeta(session.user.id, profile?.role ?? 'farmer') : undefined,
    });
    if (error) return toast.error('Failed to list produce');
    toast.success('Product listed!');
    await loadData();
    e.currentTarget.reset();
  };

  const submitRelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.id || !relistItem) return;
    setRelistSubmitting(true);
    try {
      await relistTraderInventoryItem(session.user.id, relistItem, Number(relistQty), Number(relistPrice));
      toast.success('Product listed for Industrialists!');
      setRelistOpen(false);
      await loadData();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to list';
      toast.error(message);
    } finally {
      setRelistSubmitting(false);
    }
  };

  return (
    <>
      <SEO title="Marketplace | AgroElevate" description="Agri trading platform" />
      <PageHeader
        title="Agri Marketplace"
        subtitle="Discover crops, list produce, and trade with transparency"
        actions={
          canPurchase && (
            <CartSheet cart={cartItems} totalAmount={totalAmount} walletBalance={walletBalance}
              itemCount={cart.reduce((a, i) => a + i.qty, 0)} onCheckout={checkout} open={cartOpen} onOpenChange={setCartOpen} />
          )
        }
      />

      {loading ? <DashboardSkeleton /> : (
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="space-y-4">
            {isFarmer && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> List Produce</h3>
                <form onSubmit={listProduce} className="space-y-3">
                  <div><Label>Crop Name</Label><Input name="name" placeholder="Wheat" required className="bg-muted/30" /></div>
                  <div><Label>Crop Type</Label><Input name="crop_type" placeholder="Grain" required className="bg-muted/30" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Price/kg</Label><Input name="price" type="number" required min="0.01" step="0.01" className="bg-muted/30" /></div>
                    <div><Label>Qty (kg)</Label><Input name="quantity" type="number" required min="1" className="bg-muted/30" /></div>
                  </div>
                  <Button type="submit" variant="hero" className="w-full">Submit Listing</Button>
                </form>
              </div>
            )}
            {isTrader && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold mb-3">My Inventory</h3>
                {inventory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Buy from farmers to build inventory.</p>
                ) : inventory.map((item) => (
                  <div key={item.orderItemId} className="p-3 border border-border/50 rounded-lg mb-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground">{item.remainingQty} kg @ ₹{item.pricePerUnit}/kg</p>
                      </div>
                      <Button size="sm" onClick={() => { setRelistItem(item); setRelistQty(String(item.remainingQty)); setRelistPrice(''); setRelistOpen(true); }}>Sell</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <MarketplaceFilters query={query} onQueryChange={setQuery} cropFilter={cropFilter} onCropFilterChange={setCropFilter}
              sortBy={sortBy} onSortChange={setSortBy} cropTypes={cropTypes} resultCount={filteredProducts.length} />
          </div>
          <div className="lg:col-span-3">
            {isFarmer ? (
              <Tabs value={farmerView} onValueChange={(v) => setFarmerView(v as 'browse' | 'my-listings')} className="space-y-4">
                <TabsList>
                  <TabsTrigger value="browse">Browse marketplace</TabsTrigger>
                  <TabsTrigger value="my-listings">My listings</TabsTrigger>
                </TabsList>
                <TabsContent value="browse" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-0">
                  {filteredProducts.length === 0 ? (
                    <p className="col-span-full text-sm text-muted-foreground py-12 text-center">No other sellers&apos; listings match your filters.</p>
                  ) : filteredProducts.map((p) => {
                    let isRelisted = false;
                    try { if (p.description) isRelisted = !!JSON.parse(p.description).original_farmer_id; } catch { /* */ }
                    const cartItem = cart.find((c) => c.id === p.id);
                    return (
                      <ProductCard key={p.id}
                        product={{ ...p, imageUrl: getProductImage(p.name), isRelisted }}
                        cartQty={cartItem?.qty} canPurchase={canPurchase} showRoyaltyNote={isIndustrialist}
                        onAdd={() => addToCart(p.id)} onChangeQty={(d) => changeQty(p.id, d)} maxQty={p.quantity}
                      />
                    );
                  })}
                </TabsContent>
                <TabsContent value="my-listings" className="mt-0">
                  {session?.user.id && (
                    <FarmerMyListings farmerId={session.user.id} onChanged={loadData} />
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((p) => {
                  let isRelisted = false;
                  try { if (p.description) isRelisted = !!JSON.parse(p.description).original_farmer_id; } catch { /* */ }
                  const cartItem = cart.find((c) => c.id === p.id);
                  return (
                    <ProductCard key={p.id}
                      product={{ ...p, imageUrl: getProductImage(p.name), isRelisted }}
                      cartQty={cartItem?.qty} canPurchase={canPurchase} showRoyaltyNote={isIndustrialist}
                      onAdd={() => addToCart(p.id)} onChangeQty={(d) => changeQty(p.id, d)} maxQty={p.quantity}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={relistOpen} onOpenChange={setRelistOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>List {relistItem?.name} for Resale</DialogTitle></DialogHeader>
          <form onSubmit={submitRelist} className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Available: {relistItem?.remainingQty ?? 0} kg</p>
            <div><Label>Quantity (kg)</Label><Input type="number" value={relistQty} onChange={(e) => setRelistQty(e.target.value)} required min="1" max={relistItem?.remainingQty ?? 1} /></div>
            <div><Label>Price/kg (₹)</Label><Input type="number" value={relistPrice} onChange={(e) => setRelistPrice(e.target.value)} required min="0.01" step="0.01" /></div>
            <Button type="submit" className="w-full" variant="hero" disabled={relistSubmitting}>{relistSubmitting ? 'Listing...' : 'List Product'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
