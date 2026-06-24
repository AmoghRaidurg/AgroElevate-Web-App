import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, Brain, Wallet, Shield, Menu, Sparkles, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/intelligence', label: 'Intelligence', icon: Brain, flagship: true },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const links = isAdmin
    ? [
        ...navItems,
        { to: '/admin', label: 'Admin', icon: Shield, flagship: false },
        { to: '/admin/payments', label: 'Payments', icon: CreditCard, flagship: false },
      ]
    : navItems;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {links.map(({ to, label, icon: Icon, flagship }) => {
        const active = to === '/admin'
          ? location.pathname === '/admin'
          : location.pathname === to || location.pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? flagship
                  ? 'bg-gradient-to-r from-highlight/20 to-accent/10 text-foreground border border-highlight/30 shadow-sm'
                  : 'bg-primary/15 text-foreground border border-primary/25 shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-transparent',
              flagship && !active && 'text-accent hover:border-accent/20',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active && flagship && 'text-highlight')} />
            <span className="flex-1">{label}</span>
            {flagship && (
              <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-highlight">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
      <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] p-1.5 shadow-md">
        <img src="/logo.png" alt="AgroElevate" className="h-full w-full object-contain" />
      </div>
      <div>
        <span className="font-display font-bold text-foreground">AgroElevate</span>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AgriTech OS</p>
      </div>
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar shrink-0">
      <SidebarBrand />
      <NavLinks />
      <div className="mt-auto p-4 m-3 rounded-xl glass-card text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">AI Intelligence</p>
        <p>Crop advisory, forecasts & copilot — your competitive edge.</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden border-border/80">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
        <SidebarBrand />
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
