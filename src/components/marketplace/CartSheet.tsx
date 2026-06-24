import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CartItem {
  id: string;
  name: string;
  qty: number;
  lineTotal: number;
}

interface CartSheetProps {
  cart: CartItem[];
  totalAmount: number;
  walletBalance: number;
  itemCount: number;
  onCheckout: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CartSheet({
  cart,
  totalAmount,
  walletBalance,
  itemCount,
  onCheckout,
  open,
  onOpenChange,
}: CartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="hero" size="lg" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Cart ({itemCount})
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-card border-border w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Order Summary</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[50vh] mt-4 pr-4">
          <div className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Your cart is empty</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b border-border/50 pb-2">
                  <span>{item.name} × {item.qty}</span>
                  <span className="tabular-nums font-medium">₹{item.lineTotal.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {cart.length > 0 && (
          <div className="mt-6 space-y-4 border-t border-border/50 pt-4">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="tabular-nums text-primary">₹{totalAmount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground text-right">Wallet: ₹{walletBalance.toLocaleString()}</p>
            <Button className="w-full h-12" variant="hero" onClick={onCheckout}>Pay & Checkout</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
