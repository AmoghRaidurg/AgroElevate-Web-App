import { SEO } from '@/components/SEO';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getWalletInfo, addFunds, WalletTransaction } from '@/lib/wallet';
import { toast } from 'sonner';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Wallet() {
  const { session, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchWallet = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const info = await getWalletInfo(session.user.id);
    setBalance(info.balance);
    setTransactions(info.transactions);
    setLoading(false);
  };

  useEffect(() => {
    fetchWallet();
  }, [session]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountToAdd);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!session?.user.id) return;

    try {
      await addFunds(session.user.id, amount);
      toast.success(`Successfully added ₹${amount} to your wallet!`);
      setIsDialogOpen(false);
      setAmountToAdd('');
      fetchWallet();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add funds');
    }
  };

  if (!session) {
    return (
      <div>
        <Navbar />
        <main className="container mx-auto py-20 text-center">
          <h2 className="text-2xl font-bold">Please login to view your wallet.</h2>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO title="Wallet | AgroElevate" description="Manage your funds and transactions" />
      <Navbar />

      <main className="container mx-auto py-10 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <WalletIcon className="h-8 w-8 text-primary" />
              My Wallet
            </h1>
            <p className="text-muted-foreground mt-1">Manage your funds and view transaction history</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" /> Add Funds
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Funds (Mock Payment)</DialogTitle>
                <CardDescription>
                  This is a simulated payment gateway. No real money will be deducted.
                </CardDescription>
              </DialogHeader>
              <form onSubmit={handleAddFunds} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Card Details (Simulated)</label>
                  <Input placeholder="1234 5678 9101 1121" disabled value="**** **** **** 4242" />
                  <div className="flex gap-4">
                    <Input placeholder="MM/YY" disabled value="12/28" />
                    <Input placeholder="CVC" disabled value="***" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="Enter amount to add" 
                    value={amountToAdd}
                    onChange={(e) => setAmountToAdd(e.target.value)}
                    required
                    min="1"
                  />
                </div>
                <Button type="submit" className="w-full">Pay Securely</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-primary-foreground/80 font-medium">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-10 w-32 bg-primary-foreground/20 animate-pulse rounded"></div>
              ) : (
                <p className="text-5xl font-bold">₹{balance.toLocaleString()}</p>
              )}
              <p className="mt-4 text-sm text-primary-foreground/80">
                User: {profile?.name || session.user.email}
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading transactions...</p>
              ) : transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No transactions found.</p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          tx.type === 'transfer_out' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {tx.type === 'transfer_out' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium capitalize">
                            {tx.type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className={`font-bold ${
                        tx.type === 'transfer_out' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {tx.type === 'transfer_out' ? '-' : '+'}₹{Math.abs(tx.amount).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
