import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { MetricCard } from '@/components/design/MetricCard';
import { ShoppingBag, IndianRupee, Package } from 'lucide-react';

interface OrderRow {
  id: string;
  totalAmount: number;
  createdAt?: string;
}

interface Props {
  orders: OrderRow[];
  userName?: string;
}

export function CustomerDashboardSection({ orders, userName }: Props) {
  const totalSpent = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${userName ? `, ${userName}` : ''}`}
        subtitle="Shop fresh produce directly from farmers"
        actions={
          <Link to="/marketplace">
            <Button variant="hero" className="gap-2">
              <ShoppingBag className="h-4 w-4" /> Browse Marketplace
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HeroMetric
          label="Total Orders"
          value={orders.length}
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard
          title="Total Spent"
          value={`₹${totalSpent.toLocaleString()}`}
          icon={IndianRupee}
          variant="success"
        />
        <MetricCard title="Account" value="Customer" variant="accent" />
      </div>

      <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Direct from farmers</p>
        <p>Purchase raw produce with zero royalty fees. Your orders support local farmers directly.</p>
        <Link to="/orders" className="inline-block mt-3">
          <Button size="sm" variant="outline">View order history</Button>
        </Link>
      </div>
    </div>
  );
}
