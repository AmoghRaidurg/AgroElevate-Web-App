import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductCardData {
  id: string;
  name: string;
  crop_type: string;
  price_per_unit: number;
  quantity: number;
  description?: string;
  imageUrl: string;
  isRelisted?: boolean;
}

interface ProductCardProps {
  product: ProductCardData;
  cartQty?: number;
  canPurchase: boolean;
  showRoyaltyNote?: boolean;
  onAdd: () => void;
  onChangeQty: (delta: number) => void;
  maxQty: number;
}

export function ProductCard({
  product,
  cartQty,
  canPurchase,
  showRoyaltyNote,
  onAdd,
  onChangeQty,
  maxQty,
}: ProductCardProps) {
  return (
    <div className="glass-card rounded-xl overflow-hidden p-0 group hover:border-primary/30 transition-all duration-200 hover:shadow-[var(--shadow-glow-emerald)]">
      <Link to={`/marketplace/${product.id}`} className="block relative">
        <img src={product.imageUrl} className="h-44 w-full object-cover group-hover:scale-[1.02] transition-transform duration-300" alt={product.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
        {product.isRelisted && (
          <Badge className="absolute top-3 right-3 bg-accent/90 text-accent-foreground">Trader Certified</Badge>
        )}
        <div className="absolute bottom-3 left-3">
          <p className="font-semibold text-white capitalize">{product.name}</p>
          <p className="text-xs text-white/70">{product.crop_type}</p>
        </div>
      </Link>
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm text-muted-foreground">{product.quantity} kg available</p>
            <p className="text-2xl font-bold text-primary tabular-nums">
              ₹{product.price_per_unit}<span className="text-sm text-muted-foreground font-normal">/kg</span>
            </p>
          </div>
          {canPurchase && (
            <div className="w-28">
              {!cartQty ? (
                <Button onClick={onAdd} variant="hero" size="sm" className="w-full">Add</Button>
              ) : (
                <div className="flex items-center justify-between border border-border/50 rounded-lg bg-muted/20">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChangeQty(-1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-medium text-sm tabular-nums">{cartQty}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChangeQty(1)} disabled={cartQty >= maxQty}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {showRoyaltyNote && product.isRelisted && (
          <p className="text-xs text-accent bg-accent/10 p-2 rounded-lg">12.5% royalty goes to the original farmer</p>
        )}
      </div>
    </div>
  );
}

export function getProductImage(name: string) {
  const key = name.toLowerCase();
  if (key.includes('maize')) return '/crops/maize.jpg';
  if (key.includes('wheat')) return '/crops/wheat.jpg';
  if (key.includes('rice')) return '/crops/rice.jpg';
  if (key.includes('potato')) return '/crops/potato.jpg';
  if (key.includes('tomato')) return '/crops/tomato.jpg';
  if (key.includes('onion')) return '/crops/onion.jpg';
  return '/placeholder.svg';
}
