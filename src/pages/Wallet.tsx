import { useEffect, useMemo, useState } from 'react';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { getWalletInfo, addFunds, transferFunds, WalletTransaction } from '@/lib/wallet';
import { toast } from 'sonner';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { MetricCard } from '@/components/design/MetricCard';
import { DashboardSkeleton } from '@/components/design/skeletons';
import { ThemedChart, CHART_COLORS } from '@/components/design/ThemedChart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Wallet() {
  const { session, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferReceiverId, setTransferReceiverId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const fetchWallet = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const info = await getWalletInfo(session.user.id);
    if (info.error) {
      toast.error(`Wallet error: ${info.error}`);
    }
    setBalance(info.balance);
    setTransactions(info.transactions);
    setLoading(false);
  };

  useEffect(() => { fetchWallet(); }, [session]);

  const analytics = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const tx of transactions) {
      const isOut = ['transfer_out', 'purchase', 'royalty_paid', 'withdrawal'].includes(tx.type) || tx.amount < 0;
      if (isOut) outflow += Math.abs(tx.amount);
      else inflow += Math.abs(tx.amount);
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [transactions]);

  const chartData = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const tx of transactions.slice(0, 14)) {
      const d = new Date(tx.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const entry = map.get(d) ?? { in: 0, out: 0 };
      const isOut = ['transfer_out', 'purchase', 'royalty_paid', 'withdrawal'].includes(tx.type) || tx.amount < 0;
      if (isOut) entry.out += Math.abs(tx.amount);
      else entry.in += Math.abs(tx.amount);
      map.set(d, entry);
    }
    return Array.from(map.entries()).map(([date, v]) => ({ date, in: v.in, out: v.out }));
  }, [transactions]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, WalletTransaction[]>();
    for (const tx of transactions) {
      const key = new Date(tx.created_at).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    return Array.from(groups.entries());
  }, [transactions]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountToAdd);
    if (!amount || amount <= 0) return toast.error('Please enter a valid amount');
    if (!session?.user.id) return;
    try {
      await addFunds(session.user.id, amount);
      toast.success(`Successfully added ₹${amount} to your wallet!`);
      setIsDialogOpen(false);
      setAmountToAdd('');
      fetchWallet();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to add funds';
      toast.error(message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (!transferReceiverId.trim()) return toast.error('Please enter a receiver user ID');
    if (!amount || amount <= 0) return toast.error('Please enter a valid amount');
    if (amount > balance) return toast.error('Insufficient balance');
    setTransferSubmitting(true);
    try {
      await transferFunds(transferReceiverId.trim(), amount);
      toast.success(`Transferred ₹${amount} successfully`);
      setIsTransferOpen(false);
      setTransferReceiverId('');
      setTransferAmount('');
      fetchWallet();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Transfer failed. Check receiver ID and balance.';
      toast.error(message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <SEO title="Wallet | AgroElevate" />
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <>
      <SEO title="Wallet | AgroElevate" description="Manage your funds and transactions" />
      <PageHeader
        title="My Wallet"
        subtitle="Manage funds, transfers & transaction history"
        actions={
          <div className="flex gap-2">
            <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Send className="h-4 w-4" /> Transfer</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Transfer Funds</DialogTitle></DialogHeader>
                <form onSubmit={handleTransfer} className="space-y-4 pt-2">
                  <div><Label>Receiver User ID</Label><Input value={transferReceiverId} onChange={(e) => setTransferReceiverId(e.target.value)} required className="bg-muted/30" /></div>
                  <div><Label>Amount (₹)</Label><Input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} required min="1" max={balance} className="bg-muted/30" /></div>
                  <p className="text-xs text-muted-foreground">Available: ₹{balance.toLocaleString()}</p>
                  <Button type="submit" className="w-full" variant="hero" disabled={transferSubmitting}>{transferSubmitting ? 'Transferring...' : 'Send'}</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> Add Funds</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Add Funds (Mock Payment)</DialogTitle></DialogHeader>
                <form onSubmit={handleAddFunds} className="space-y-4 pt-2">
                  <Input placeholder="**** **** **** 4242" disabled value="**** **** **** 4242" className="bg-muted/30" />
                  <div><Label>Amount (₹)</Label><Input type="number" value={amountToAdd} onChange={(e) => setAmountToAdd(e.target.value)} required min="1" className="bg-muted/30" /></div>
                  <Button type="submit" className="w-full" variant="hero">Pay Securely</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <HeroMetric
          label="Available Balance"
          value={`₹${balance.toLocaleString()}`}
          subtitle={profile?.name || session?.user?.email}
          icon={<WalletIcon className="h-5 w-5" />}
          className="lg:col-span-1 border-primary/30 glass-card-glow"
        />
        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          <MetricCard title="Total In" value={`₹${analytics.inflow.toLocaleString()}`} variant="success" />
          <MetricCard title="Total Out" value={`₹${analytics.outflow.toLocaleString()}`} variant="warning" />
          <MetricCard title="Net Flow" value={`₹${analytics.net.toLocaleString()}`} variant="accent" />
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-4">Transaction Analytics</h3>
          <ThemedChart height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215 15% 58%)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(215 15% 58%)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'hsl(220 16% 11%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8 }} />
              <Bar dataKey="in" fill={CHART_COLORS.primary} name="In" radius={[2, 2, 0, 0]} />
              <Bar dataKey="out" fill={CHART_COLORS.danger} name="Out" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ThemedChart>
        </div>
      )}

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold mb-6">Transaction Timeline</h3>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-8">
            {groupedByDate.map(([date, txs]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{date}</p>
                <div className="space-y-2 border-l-2 border-primary/30 pl-4 ml-2">
                  {txs.map((tx) => {
                    const isOut = ['transfer_out', 'purchase', 'royalty_paid', 'withdrawal'].includes(tx.type) || tx.amount < 0;
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isOut ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
                            {isOut ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{tx.type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <p className={`font-bold tabular-nums ${isOut ? 'text-red-400' : 'text-primary'}`}>
                          {isOut ? '-' : '+'}₹{Math.abs(tx.amount).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
