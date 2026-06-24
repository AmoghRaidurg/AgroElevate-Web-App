import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { getProductImage } from '@/components/marketplace/ProductCard';
import { PageLoading } from '@/components/design/skeletons';
import { ArrowLeft } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<{
    id: string; name: string; crop_type: string; price_per_unit: number;
    quantity: number; unit: string; description?: string; seller_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      setProduct(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <PageLoading />;
  if (!product) return <p className="text-muted-foreground">Product not found.</p>;

  let isRelisted = false;
  try { if (product.description) isRelisted = !!JSON.parse(product.description).original_farmer_id; } catch { /* */ }

  return (
    <>
      <SEO title={`${product.name} | Marketplace`} />
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="glass-card rounded-2xl overflow-hidden p-0">
          <img src={getProductImage(product.name)} alt={product.name} className="w-full h-80 object-cover" />
        </div>
        <div className="space-y-6">
          <PageHeader title={product.name} subtitle={product.crop_type} />
          {isRelisted && <Badge className="bg-accent/20 text-accent border-accent/30">Trader Certified · Royalty eligible</Badge>}
          <div className="glass-card rounded-xl p-6">
            <p className="text-4xl font-bold text-primary tabular-nums">₹{product.price_per_unit}<span className="text-lg text-muted-foreground font-normal">/kg</span></p>
            <p className="text-muted-foreground mt-2">{product.quantity} {product.unit} available</p>
          </div>
          <Link to="/marketplace"><Button variant="hero" size="lg">Back to Marketplace to Purchase</Button></Link>
        </div>
      </div>
    </>
  );
}
