import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { MetricCard } from '@/components/design/MetricCard';
import { Factory, Users, Brain, IndianRupee, Package, Cog } from 'lucide-react';
import type { ManufacturingBatch, ProcessedProduct, RoyaltyObligation } from '@/lib/manufacturingData';
import {
  completeManufacturingBatch,
  listProcessedProduct,
  countOpenBatches,
  countOpenObligations,
} from '@/lib/manufacturingData';
import { toast } from 'sonner';

interface OrderRow {
  id: string;
  totalAmount: number;
  createdAt?: string;
}

interface Props {
  orders: OrderRow[];
  batches: ManufacturingBatch[];
  processedProducts: ProcessedProduct[];
  obligations: RoyaltyObligation[];
  userId: string;
  userName?: string;
  onRefresh: () => void;
}

export function IndustrialistDashboardSection({
  orders,
  batches,
  processedProducts,
  obligations,
  userId,
  userName,
  onRefresh,
}: Props) {
  const totalSpent = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ManufacturingBatch | null>(null);
  const [selectedProcessed, setSelectedProcessed] = useState<ProcessedProduct | null>(null);
  const [outputQty, setOutputQty] = useState('');
  const [productName, setProductName] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [listQty, setListQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const draftBatches = useMemo(
    () => batches.filter((b) => b.status === 'draft' || b.status === 'in_progress'),
    [batches]
  );
  const unlistedProcessed = useMemo(
    () => processedProducts.filter((p) => p.status === 'created'),
    [processedProducts]
  );

  const handleCompleteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      await completeManufacturingBatch(
        selectedBatch.id,
        Number(outputQty),
        productName || `${selectedBatch.input_crop_name} (processed)`
      );
      toast.success('Manufacturing batch completed');
      setCompleteOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleListProcessed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcessed) return;
    setSubmitting(true);
    try {
      await listProcessedProduct(selectedProcessed.id, Number(listPrice), Number(listQty));
      toast.success('Processed product listed on marketplace');
      setListOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${userName ? `, ${userName}` : ''}`}
        subtitle="Procurement, manufacturing & downstream royalty tracking"
        actions={
          <>
            <Link to="/marketplace"><Button variant="outline">Procure</Button></Link>
            <Link to="/intelligence"><Button variant="hero" className="gap-2"><Brain className="h-4 w-4" /> Forecast</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroMetric label="Total Procurement" value={`₹${totalSpent.toLocaleString()}`} icon={<IndianRupee className="h-5 w-5" />} />
        <MetricCard title="Procurement Orders" value={orders.length} icon={Package} variant="success" />
        <MetricCard title="Active Batches" value={countOpenBatches(batches)} icon={Cog} variant="accent" />
        <MetricCard title="Open Royalties" value={countOpenObligations(obligations, userId)} icon={Factory} variant="highlight" />
      </div>

      {draftBatches.length > 0 && (
        <div className="glass-card rounded-xl p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Cog className="h-4 w-4" /> Manufacturing Batches</h3>
          {draftBatches.map((batch) => (
            <div key={batch.id} className="flex justify-between items-center p-3 border border-border/50 rounded-lg text-sm">
              <div>
                <p className="font-medium">{batch.input_crop_name}</p>
                <p className="text-muted-foreground">{batch.input_qty} {batch.input_unit} · {batch.status} · {batch.royalty_percent}% downstream royalty</p>
              </div>
              <Button size="sm" onClick={() => {
                setSelectedBatch(batch);
                setOutputQty(String(batch.input_qty));
                setProductName(`${batch.input_crop_name} (processed)`);
                setCompleteOpen(true);
              }}>Complete</Button>
            </div>
          ))}
        </div>
      )}

      {unlistedProcessed.length > 0 && (
        <div className="glass-card rounded-xl p-6 space-y-3">
          <h3 className="font-semibold">Processed Products (ready to list)</h3>
          {unlistedProcessed.map((pp) => (
            <div key={pp.id} className="flex justify-between items-center p-3 border border-border/50 rounded-lg text-sm">
              <div>
                <p className="font-medium">{pp.name}</p>
                <p className="text-muted-foreground">{pp.qty_produced} {pp.unit} produced · farmer royalty {pp.royalty_percent}%</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                setSelectedProcessed(pp);
                setListQty(String(pp.qty_produced));
                setListPrice('');
                setListOpen(true);
              }}>List</Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold">Supplier Analytics</h3>
              <p className="text-sm text-muted-foreground">View procurement orders and supplier history.</p>
            </div>
            <Link to="/orders"><Button size="sm" variant="outline">Orders</Button></Link>
          </div>
        </div>
        <div className="glass-elevated rounded-2xl p-6 border-highlight/25">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-highlight" />
            <div className="flex-1">
              <h3 className="font-display font-bold">Cost Forecasting</h3>
              <p className="text-sm text-muted-foreground">AI-powered spend projections.</p>
            </div>
            <Link to="/intelligence"><Button size="sm" variant="highlight">Forecast</Button></Link>
          </div>
        </div>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Manufacturing Batch</DialogTitle></DialogHeader>
          <form onSubmit={handleCompleteBatch} className="space-y-4">
            <div><Label>Output quantity</Label><Input type="number" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} required min="1" /></div>
            <div><Label>Product name</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Saving...' : 'Complete batch'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>List Processed Product</DialogTitle></DialogHeader>
          <form onSubmit={handleListProcessed} className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedProcessed?.name} — {selectedProcessed?.qty_produced} {selectedProcessed?.unit} available</p>
            <div><Label>List quantity</Label><Input type="number" value={listQty} onChange={(e) => setListQty(e.target.value)} required min="1" max={selectedProcessed?.qty_produced} /></div>
            <div><Label>Price per unit (₹)</Label><Input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} required min="0.01" step="0.01" /></div>
            <p className="text-xs text-accent">12.5% royalty to original farmer on each sale</p>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Listing...' : 'List on marketplace'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
