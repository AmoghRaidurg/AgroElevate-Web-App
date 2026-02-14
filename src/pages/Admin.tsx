import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Admin() {
  const [products, setProducts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    // Admin fetch: Get all products and all profiles
    // Note: In a real app, you would need specific Admin RLS policies or use a Service Role Key
    supabase.from('products').select('*').limit(10).then(({ data }) => setProducts(data || []));
    supabase.from('profiles').select('*').limit(10).then(({ data }) => setProfiles(data || []));
  }, []);

  return (
    <div>
      <SEO title="Admin | Agronex" description="Admin Panel" />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <h1 className="text-3xl font-semibold">Admin Panel (Live Data)</h1>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Recent Products</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {products.map(p => (
                  <li key={p.id} className="flex justify-between border-b py-2">
                    <span>{p.name} ({p.crop_type})</span>
                    <span>₹{p.price_per_unit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent Users</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {profiles.map(p => (
                  <li key={p.id} className="flex justify-between border-b py-2">
                    <span>{p.name}</span>
                    <span className="capitalize">{p.role}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}