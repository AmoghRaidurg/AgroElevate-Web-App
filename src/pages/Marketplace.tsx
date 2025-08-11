import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { demoProducts } from '@/data/demo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Marketplace() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);

  const products = useMemo(() => {
    return demoProducts.filter(p =>
      (!type || p.cropType.toLowerCase() === type.toLowerCase()) &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase())) &&
      (!min || p.pricePerUnit >= Number(min)) &&
      (!max || p.pricePerUnit <= Number(max))
    );
  }, [query, type, min, max]);

  const addToCart = (id: string) => {
    setCart(prev => {
      const found = prev.find(i => i.id === id);
      if (found) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id, qty: 1 }];
    });
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, i) => {
      const p = demoProducts.find(p => p.id === i.id);
      return sum + (p ? p.pricePerUnit * i.qty : 0);
    }, 0);
  }, [cart]);

  const checkout = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body: { amount: Math.round(totalAmount*100), currency: 'INR' }});
      if (error) throw error;
      alert(`Order created (demo): ${data?.id || 'no-id'}`);
    } catch (e) {
      alert('Payment in demo mode. Configure Razorpay secrets to enable live payments.');
    }
  };

  return (
    <div>
      <SEO title="Marketplace | Agronex" description="Browse and buy agricultural products with transparent pricing and royalties." />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="col-span-2 md:col-span-2"><Label>Search</Label><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products" /></div>
          <div><Label>Crop Type</Label><Input value={type} onChange={e=>setType(e.target.value)} placeholder="e.g. Wheat" /></div>
          <div><Label>Min Price</Label><Input value={min} onChange={e=>setMin(e.target.value)} placeholder="e.g. 10" /></div>
          <div><Label>Max Price</Label><Input value={max} onChange={e=>setMax(e.target.value)} placeholder="e.g. 50" /></div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <Card key={p.id} className="animate-fade-in">
              <CardHeader><CardTitle>{p.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Type: {p.cropType} • Seller: {p.sellerRole}</p>
                <p><span className="text-2xl font-semibold">₹ {p.pricePerUnit}</span> <span className="text-sm text-muted-foreground">/ {p.unit}</span></p>
                <Button variant="hero" onClick={() => addToCart(p.id)}>Add to cart</Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="border rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Items: {cart.reduce((a,i)=>a+i.qty,0)} • Total: ₹ {totalAmount.toFixed(2)}</div>
          <Button variant="hero" disabled={totalAmount===0} onClick={checkout}>Checkout</Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
