import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShoppingCart, Plus, Minus, Store } from 'lucide-react';
import { getWalletInfo, transferFunds } from '@/lib/wallet';

interface Product {
  id: string;
  name: string;
  crop_type: string;
  price_per_unit: number;
  unit: string;
  quantity: number;
  seller_id: string;
  description?: string; // used for JSON like {"original_farmer_id": "..."}
  image_url?: string;
}

export default function Marketplace() {
  const { session, profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Wallet
  const [walletBalance, setWalletBalance] = useState(0);

  // Trader Inventory
  const [inventory, setInventory] = useState<any[]>([]);

  const isFarmer = profile?.role === 'farmer';
  const isTrader = profile?.role === 'middleman';
  const isIndustrialist = profile?.role === 'industrialist';

  // ---------------- LOAD DATA ----------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Fetch products
      const { data } = await supabase.from('products').select('*');
      setProducts(data || []);

      if (session?.user.id) {
        // Fetch wallet balance
        const { balance } = await getWalletInfo(session.user.id);
        setWalletBalance(balance);

        // Fetch trader inventory (completed purchases)
        if (isTrader) {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('buyer_id', session.user.id)
            .eq('status', 'completed');
          
          if (orders) {
            // Flatten the items from all completed orders
            const items = orders.flatMap(o => o.items.map((i: any) => ({ ...i, order_id: o.id })));
            setInventory(items);
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [session, isTrader]);

  // ---------------- SEARCH FILTER ----------------
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) && p.quantity > 0
    );
  }, [query, products]);

  // ---------------- IMAGE HANDLER ----------------
  const getImage = (name: string) => {
    const key = name.toLowerCase();
    if (key.includes('maize')) return '/crops/maize.jpg';
    if (key.includes('wheat')) return '/crops/wheat.jpg';
    if (key.includes('rice')) return '/crops/rice.jpg';
    if (key.includes('potato')) return '/crops/potato.jpg';
    if (key.includes('tomato')) return '/crops/tomato.jpg';
    if (key.includes('onion')) return '/crops/onion.jpg';
    return '/placeholder.svg';
  };

  // ---------------- CART LOGIC ----------------
  const addToCart = (id: string) => {
    if (!isTrader && !isIndustrialist) {
      toast.error("Only traders & industrialists can purchase");
      return;
    }
    setCart(prev => {
      const found = prev.find(i => i.id === id);
      if (found) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, i) => {
      const p = products.find(p => p.id === i.id);
      return sum + (p ? p.price_per_unit * i.qty : 0);
    }, 0);
  }, [cart, products]);

  // ---------------- CHECKOUT ----------------
  const checkout = async () => {
    if (!session) return toast.error("Login required");

    if (walletBalance < totalAmount) {
      toast.error("Insufficient wallet balance. Please add funds.");
      return;
    }

    try {
      // 1. Process wallet transfers for each item
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (!product) continue;

        const itemTotal = product.price_per_unit * item.qty;

        // Check for Royalty (12.5% to original farmer)
        let metadata: any = {};
        try { if (product.description) metadata = JSON.parse(product.description); } catch (e) {}

        if (metadata.original_farmer_id) {
          const royalty = itemTotal * 0.125;
          const traderShare = itemTotal - royalty;
          // Transfer to Trader
          await transferFunds(session.user.id, product.seller_id, traderShare);
          // Transfer to Original Farmer
          await transferFunds(session.user.id, metadata.original_farmer_id, royalty);
          toast.success(`12.5% Royalty auto-distributed to original farmer!`);
        } else {
          // Standard transfer to seller
          await transferFunds(session.user.id, product.seller_id, itemTotal);
        }

        // Reduce product quantity
        const newQty = product.quantity - item.qty;
        await supabase.from('products').update({ quantity: newQty }).eq('id', product.id);
      }

      // 2. Record the completed order
      const enrichedCart = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        let metadata: any = {};
        try { if (product?.description) metadata = JSON.parse(product.description); } catch(e){}
        return {
          ...item,
          name: product?.name,
          crop_type: product?.crop_type,
          price_per_unit: product?.price_per_unit,
          seller_id: product?.seller_id,
          original_farmer_id: metadata.original_farmer_id || (isFarmer ? session.user.id : product?.seller_id)
        };
      });

      const { error } = await supabase.from('orders').insert({
        buyer_id: session.user.id,
        total_amount: totalAmount,
        items: enrichedCart,
        status: 'completed'
      });

      if (error) throw error;

      toast.success("Order placed successfully!");
      setCart([]);
      
      // Refresh state
      const { balance } = await getWalletInfo(session.user.id);
      setWalletBalance(balance);
      const { data } = await supabase.from('products').select('*');
      setProducts(data || []);

    } catch (err) {
      console.error(err);
      toast.error("Checkout failed");
    }
  };

  // ---------------- FARMER LIST PRODUCT ----------------
  const listProduce = async (e: any) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const { error } = await supabase.from('products').insert({
      name: form.get('name'),
      crop_type: form.get('crop_type'),
      price_per_unit: Number(form.get('price')),
      quantity: Number(form.get('quantity')),
      unit: 'kg',
      seller_id: session?.user.id
    });

    if (error) return toast.error("Failed to list produce");
    toast.success("Product listed!");
    location.reload();
  };

  // ---------------- TRADER RELIST PRODUCT ----------------
  const reListProduct = async (item: any) => {
    const price = prompt(`Enter selling price per kg for ${item.name} (Current qty: ${item.qty}kg)`);
    if (!price || isNaN(Number(price))) return;

    const metadata = { original_farmer_id: item.original_farmer_id };

    const { error } = await supabase.from('products').insert({
      name: item.name,
      crop_type: item.crop_type,
      price_per_unit: Number(price),
      quantity: item.qty,
      unit: 'kg',
      seller_id: session?.user.id,
      description: JSON.stringify(metadata)
    });

    if (error) return toast.error("Failed to list product");
    toast.success("Product listed for Industrialists!");
    
    // We ideally should remove/reduce from inventory, but for demo we just reload
    location.reload();
  };

  // ---------------- UI ----------------
  return (
    <div className="bg-slate-50 min-h-screen">
      <SEO title="Marketplace | AgroElevate" description="Agri trading platform" />
      <Navbar />

      <main className="container mx-auto py-10 space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="text-primary" /> Agri Marketplace
            </h1>
            {session && (
              <p className="text-muted-foreground mt-2 font-medium">
                Wallet Balance: <span className="text-green-600">₹{walletBalance.toLocaleString()}</span>
              </p>
            )}
          </div>

          {(isTrader || isIndustrialist) && (
            <Button variant="hero" size="lg">
              <ShoppingCart className="mr-2" />
              Cart ({cart.reduce((a,i)=>a+i.qty,0)})
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* SIDEBAR */}
          <div className="space-y-6">
            {/* FARMER PANEL */}
            {isFarmer && (
              <Card className="shadow-sm">
                <CardHeader><CardTitle>List Produce</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={listProduce} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Crop Name</Label>
                      <Input name="name" placeholder="e.g. Wheat" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Crop Type</Label>
                      <Input name="crop_type" placeholder="e.g. Grain" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Price/kg (₹)</Label>
                        <Input name="price" type="number" placeholder="0.00" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity (kg)</Label>
                        <Input name="quantity" type="number" placeholder="0" required />
                      </div>
                    </div>
                    <Button type="submit" variant="hero" className="w-full">Submit Listing</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* TRADER INVENTORY PANEL */}
            {isTrader && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>My Inventory (Purchased)</CardTitle>
                </CardHeader>
                <CardContent>
                  {inventory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Buy products from farmers to see them here.</p>
                  ) : (
                    <div className="space-y-4">
                      {inventory.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-slate-50 flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.qty} kg (Bought at ₹{item.price_per_unit}/kg)</p>
                          </div>
                          <Button size="sm" onClick={() => reListProduct(item)}>
                            Sell
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SEARCH */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle>Search</CardTitle></CardHeader>
              <CardContent>
                <Input
                  placeholder="Search crops..."
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          {/* MAIN PRODUCTS GRID */}
          <div className="lg:col-span-2">
            {loading ? (
              <p>Loading market data...</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {filteredProducts.map(p => {
                  const cartItem = cart.find(c => c.id === p.id);
                  let metadata: any = {};
                  try { if (p.description) metadata = JSON.parse(p.description); } catch(e){}
                  const isRelisted = !!metadata.original_farmer_id;

                  // Hide Trader's own products from them
                  if (p.seller_id === session?.user?.id) return null;

                  return (
                    <Card key={p.id} className="overflow-hidden hover:shadow-xl transition border-none shadow-md">
                      <div className="relative">
                        <img
                          src={getImage(p.name)}
                          className="h-48 w-full object-cover"
                        />
                        {isRelisted && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full shadow">
                            Trader Certified
                          </div>
                        )}
                      </div>

                      <CardContent className="p-5 space-y-3">
                        <div>
                          <h3 className="text-xl font-semibold capitalize">{p.name}</h3>
                          <p className="text-sm text-muted-foreground">{p.crop_type}</p>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm">Available: <span className="font-medium">{p.quantity} kg</span></p>
                            <p className="text-green-600 font-bold text-2xl mt-1">₹{p.price_per_unit}<span className="text-sm text-muted-foreground">/kg</span></p>
                          </div>
                          
                          {(isTrader || isIndustrialist) && (
                            <div className="w-32">
                              {!cartItem ? (
                                <Button onClick={() => addToCart(p.id)} variant="hero" className="w-full">
                                  Add
                                </Button>
                              ) : (
                                <div className="flex items-center justify-between border rounded-md">
                                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={()=>changeQty(p.id,-1)}><Minus className="h-4 w-4"/></Button>
                                  <span className="font-medium">{cartItem.qty}</span>
                                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={()=>changeQty(p.id,1)}><Plus className="h-4 w-4"/></Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isRelisted && isIndustrialist && (
                          <p className="text-xs text-primary bg-primary/10 p-2 rounded">
                            ✨ 12.5% of this purchase goes back to the original farmer!
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CART SUMMARY */}
        {(isTrader || isIndustrialist) && cart.length > 0 && (
          <div className="fixed bottom-6 right-6 bg-white shadow-2xl p-6 rounded-xl w-80 border-t-4 border-primary z-50 animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Order Summary</h3>
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-semibold">{cart.reduce((a,i)=>a+i.qty,0)} items</span>
            </div>
            
            <div className="space-y-2 mb-4 max-h-40 overflow-auto">
              {cart.map(item => {
                const p = products.find(p => p.id === item.id);
                if (!p) return null;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{p.name} (x{item.qty})</span>
                    <span>₹{p.price_per_unit * item.qty}</span>
                  </div>
                )
              })}
            </div>

            <div className="border-t pt-3 mb-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>₹{totalAmount.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground text-right mt-1">
                Wallet Balance: ₹{walletBalance.toLocaleString()}
              </p>
            </div>
            
            <Button className="w-full text-lg h-12 shadow-lg hover:shadow-xl transition-shadow" variant="hero" onClick={checkout}>
              Pay & Checkout
            </Button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
