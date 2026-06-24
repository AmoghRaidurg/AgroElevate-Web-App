import type { PaymentReceipt } from '@/lib/razorpayWallet';
import { formatIstDateTime } from '@/lib/razorpayWallet';
import { Badge } from '@/components/ui/badge';

interface PaymentReceiptListProps {
  receipts: PaymentReceipt[];
}

export function PaymentReceiptList({ receipts }: PaymentReceiptListProps) {
  if (!receipts.length) {
    return (
      <p className="text-sm text-muted-foreground">No Razorpay receipts yet. Top up your wallet to see payment receipts here.</p>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((r) => (
        <div key={r.id} className="rounded-lg border border-border/60 p-4 bg-card/50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-mono text-sm font-semibold">{r.receipt_number}</span>
            <Badge variant="secondary">₹{Number(r.amount_inr).toLocaleString('en-IN')}</Badge>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
            <div><dt className="inline">Paid (IST): </dt><dd className="inline text-foreground">{formatIstDateTime(r.paid_at_ist)}</dd></div>
            <div><dt className="inline">Method: </dt><dd className="inline text-foreground">{r.payment_method ?? '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="inline">Order: </dt><dd className="inline font-mono text-foreground">{r.razorpay_order_id}</dd></div>
            <div className="sm:col-span-2"><dt className="inline">Payment: </dt><dd className="inline font-mono text-foreground">{r.razorpay_payment_id}</dd></div>
          </dl>
        </div>
      ))}
    </div>
  );
}
