import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShoppingCart, Loader2, CheckCircle2, Truck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  qty: number;
  lineTotal: number;
  unitPrice?: number;
  maxStock?: number;
  isRelisted?: boolean;
}

interface CartSheetProps {
  cart: CartItem[];
  totalAmount: number;
  walletBalance: number;
  itemCount: number;
  estimatedRoyalty?: number;
  checkoutLoading?: boolean;
  onCheckout: () => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CartSheet({
  cart,
  totalAmount,
  walletBalance,
  itemCount,
  estimatedRoyalty = 0,
  checkoutLoading = false,
  onCheckout,
  open,
  onOpenChange,
}: CartSheetProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const insufficient = walletBalance < totalAmount;
  const canCheckout = cart.length > 0 && !insufficient && !checkoutLoading;

  const validationMessage = useMemo(() => {
    if (cart.length === 0) return null;
    if (insufficient) return `Add ₹${(totalAmount - walletBalance).toLocaleString('en-IN')} to your wallet to complete this order.`;
    return null;
  }, [cart.length, insufficient, totalAmount, walletBalance]);

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await onCheckout();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button variant="hero" size="lg" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Cart ({itemCount})
          </Button>
        </SheetTrigger>
        <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Order Summary</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-4 pr-4 min-h-0">
            <div className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Your cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{item.name}</span>
                      <span className="tabular-nums font-medium">₹{item.lineTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.qty} kg × ₹{(item.unitPrice ?? 0).toLocaleString('en-IN')}/kg
                      {item.maxStock != null ? ` · ${item.maxStock - item.qty} kg left` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {cart.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border/50 pt-4 shrink-0">
              {estimatedRoyalty > 0 && (
                <div className="flex justify-between text-sm text-accent">
                  <span>Est. farmer royalty (12.5%)</span>
                  <span className="tabular-nums">₹{estimatedRoyalty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Est. fulfillment</span>
                <span>2–5 business days</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="tabular-nums text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-muted-foreground text-right tabular-nums">
                Wallet balance: ₹{walletBalance.toLocaleString('en-IN')}
              </p>
              {validationMessage && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{validationMessage}</p>
              )}
              <Button
                className="w-full h-12 gap-2"
                variant="hero"
                disabled={!canCheckout}
                onClick={() => setConfirmOpen(true)}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Review & Pay
                  </>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm purchase</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>You are about to pay <strong className="text-foreground">₹{totalAmount.toLocaleString('en-IN')}</strong> from your wallet for {itemCount} kg total across {cart.length} item(s).</p>
                {estimatedRoyalty > 0 && (
                  <p>₹{estimatedRoyalty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} will be credited to the original farmer as royalty.</p>
                )}
                <p>Remaining wallet balance after payment: ₹{Math.max(0, walletBalance - totalAmount).toLocaleString('en-IN')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={checkoutLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(checkoutLoading && 'pointer-events-none opacity-70')}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {checkoutLoading ? 'Processing…' : 'Confirm & Pay'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
