import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  applyDemoWalletCredit,
  DEMO_CREDIT_PRESETS,
  DEMO_CREDIT_MAX,
  DEMO_CREDIT_MIN,
  isValidDemoCreditAmount,
  type DemoCreditResult,
} from '@/lib/demoWalletCredit';

interface AdminDemoWalletCreditPanelProps {
  initialUserId?: string;
  onCredited?: (result: DemoCreditResult) => void;
}

export function AdminDemoWalletCreditPanel({ initialUserId = '', onCredited }: AdminDemoWalletCreditPanelProps) {
  const [targetUserId, setTargetUserId] = useState(initialUserId);
  const [customAmount, setCustomAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialUserId) setTargetUserId(initialUserId);
  }, [initialUserId]);

  const credit = async (amount: number) => {
    if (!targetUserId.trim()) {
      toast.error('Enter a target user ID');
      return;
    }
    if (!isValidDemoCreditAmount(amount)) {
      toast.error(`Amount must be between ₹${DEMO_CREDIT_MIN} and ₹${DEMO_CREDIT_MAX.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await applyDemoWalletCredit(targetUserId, amount);
      toast.success(
        `Credited ₹${amount.toLocaleString('en-IN')} · new balance ₹${Number(result.balance).toLocaleString('en-IN')}`,
      );
      onCredited?.(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Demo credit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomCredit = async () => {
    const amount = Number(customAmount);
    if (!customAmount || !Number.isFinite(amount)) {
      toast.error('Enter a valid custom amount');
      return;
    }
    await credit(amount);
    setCustomAmount('');
  };

  return (
    <div className="glass-card rounded-xl p-6 mb-8 border border-amber-500/30 bg-amber-500/5">
      <h3 className="font-semibold mb-1">Demo Wallet Credit</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Admin-only instant funding for demonstrations. Credits <code className="text-xs">wallet_history</code> as{' '}
        <code className="text-xs">demo_credit</code> — no Razorpay records.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="demo-target-user">Target user UUID</Label>
          <Input
            id="demo-target-user"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="users.uid / profiles.id"
            className="bg-muted/30 font-mono text-sm mt-1"
          />
        </div>

        <div>
          <Label className="mb-2 block">Quick credit</Label>
          <div className="flex flex-wrap gap-2">
            {DEMO_CREDIT_PRESETS.map((amount) => (
              <Button
                key={amount}
                variant="secondary"
                disabled={submitting}
                onClick={() => credit(amount)}
              >
                +₹{amount.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-md">
          <div className="flex-1">
            <Label htmlFor="demo-custom-amount">Custom amount (₹)</Label>
            <Input
              id="demo-custom-amount"
              type="number"
              min={DEMO_CREDIT_MIN}
              max={DEMO_CREDIT_MAX}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`${DEMO_CREDIT_MIN} – ${DEMO_CREDIT_MAX.toLocaleString('en-IN')}`}
              className="bg-muted/30 mt-1"
            />
          </div>
          <Button variant="hero" disabled={submitting} onClick={handleCustomCredit}>
            Credit custom
          </Button>
        </div>
      </div>
    </div>
  );
}
