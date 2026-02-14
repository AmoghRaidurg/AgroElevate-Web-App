import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Define the shape of data coming from DB
interface Product {
  id: string;
  name: string;
  crop_type: string;
  price_per_unit: number;
  unit: string;
  seller_id: string;
}

export default function Marketplace() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);

  // Fetch products from Supabase
  useEffect(() => {
    async function fetchProducts() {
      let req = supabase.from('products').select('*');
      
      // Basic filtering (For advanced filtering, apply .eq or .gte here directly)
      const { data, error } = await req;
      if (error) console.error(error);
      else setProducts(data || []);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  // Client-side filtering (simplest transition from your demo code)
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (!type || p.crop_type?.toLowerCase() === type.toLowerCase()) &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase())) &&
      (!min || p.price_per_unit >= Number(min)) &&
      (!max || p.price_per_unit <= Number(max))
    );
  }, [query, type, min, max, products]);

  const addToCart = (id: string) => {
    setCart(prev => {
      const found = prev.find(i => i.id === id);
      if (found) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id, qty: 1 }];
    });
    toast.success("Added to cart");
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, i) => {
      const p = products.find(p => p.id === i.id);
      return sum + (p ? p.price_per_unit * i.qty : 0);
    }, 0);
  }, [cart, products]);

  const checkout = async () => {
    if (!session) return toast.error("Please login to purchase");

    try {
      // 1. Create Payment Intent via Edge Function
      const { data: payData, error: payError } = await supabase.functions.invoke('razorpay-create-order', { 
        body: { amount: Math.round(totalAmount*100), currency: 'INR' }
      });
      
      if (payError) throw payError;

      // 2. Record the Order in Supabase
      const { error: dbError } = await supabase.from('orders').insert({
        buyer_id: session.user.id,
        total_amount: totalAmount,
        items: cart,
        status: 'pending' // You would update this to 'paid' via webhook later
      });

      if (dbError) throw dbError;

      toast.success(`Order created! ID: ${payData?.id}`);
      setCart([]); // Clear cart
      
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Checkout failed');
    }
  };

  return (
    <div>
      <SEO title="Marketplace | Agronex" description="Browse and buy agricultural products." />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="col-span-2 md:col-span-2"><Label>Search</Label><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products" /></div>
          <div><Label>Crop Type</Label><Input value={type} onChange={e=>setType(e.target.value)} placeholder="e.g. Wheat" /></div>
          <div><Label>Min Price</Label><Input value={min} onChange={e=>setMin(e.target.value)} placeholder="e.g. 10" /></div>
          <div><Label>Max Price</Label><Input value={max} onChange={e=>setMax(e.target.value)} placeholder="e.g. 50" /></div>
        </section>

        {loading ? <p>Loading products...</p> : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(p => (
              <Card key={p.id} className="animate-fade-in">
                <CardHeader><CardTitle>{p.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">Type: {p.crop_type}</p>
                  <p><span className="text-2xl font-semibold">₹ {p.price_per_unit}</span> <span className="text-sm text-muted-foreground">/ {p.unit}</span></p>
                  <Button variant="hero" onClick={() => addToCart(p.id)}>Add to cart</Button>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && <p>No products found.</p>}
          </section>
        )}

        <section className="border rounded-lg p-4 flex items-center justify-between bg-card">
          <div className="text-sm text-muted-foreground">Items: {cart.reduce((a,i)=>a+i.qty,0)} • Total: ₹ {totalAmount.toFixed(2)}</div>
          <Button variant="hero" disabled={totalAmount===0} onClick={checkout}>Checkout</Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}