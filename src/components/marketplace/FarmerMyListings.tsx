import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pause, Play, Pencil, Package } from 'lucide-react';
import {
  fetchFarmerListings,
  updateFarmerListing,
  pauseFarmerListing,
  resumeFarmerListing,
  type ProductRow,
} from '@/lib/marketplaceData';

interface FarmerMyListingsProps {
  farmerId: string;
  onChanged?: () => void;
}

export function FarmerMyListings({ farmerId, onChanged }: FarmerMyListingsProps) {
  const [listings, setListings] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await fetchFarmerListings(farmerId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (product: ProductRow) => {
    setEditing(product);
    setEditPrice(String(product.price_per_unit));
    setEditQty(String(product.quantity));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(editPrice);
    const qty = Number(editQty);
    if (!Number.isFinite(price) || price <= 0) return toast.error('Enter a valid price');
    if (!Number.isFinite(qty) || qty < 0) return toast.error('Enter a valid quantity');
    setSubmitting(true);
    try {
      await updateFarmerListing(editing.id, farmerId, { price_per_unit: price, quantity: qty });
      toast.success('Listing updated');
      setEditOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePause = async (product: ProductRow) => {
    setSubmitting(true);
    try {
      if (product.quantity > 0) {
        await pauseFarmerListing(product.id, farmerId);
        toast.success('Listing paused — hidden from marketplace');
      } else {
        await resumeFarmerListing(product.id, farmerId);
        toast.success('Listing resumed');
      }
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading your listings…</p>;
  }

  if (!listings.length) {
    return (
      <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
        <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
        <p className="font-medium">No listings yet</p>
        <p className="text-sm text-muted-foreground mt-1">Use List Produce to add your first crop.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {listings.map((p) => {
          const active = p.quantity > 0;
          return (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-border/50 bg-card/40 hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{p.name}</p>
                    <Badge variant={active ? 'default' : 'secondary'}>
                      {active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {p.crop_type} · ₹{Number(p.price_per_unit).toLocaleString('en-IN')}/kg · {p.quantity} kg
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate max-w-xs">{p.id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)} disabled={submitting}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={active ? 'secondary' : 'hero'}
                    onClick={() => togglePause(p)}
                    disabled={submitting}
                  >
                    {active ? (
                      <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
                    ) : (
                      <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Price per kg (₹)</Label>
              <Input type="number" min="0.01" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="bg-muted/30 mt-1" />
            </div>
            <div>
              <Label>Quantity (kg)</Label>
              <Input type="number" min="0" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="bg-muted/30 mt-1" />
            </div>
            <Button className="w-full" variant="hero" onClick={saveEdit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
