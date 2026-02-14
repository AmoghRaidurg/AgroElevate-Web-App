import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabaseClient';

export default function Dashboard() {
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (session?.user.id) {
      // Fetch orders where the user is the buyer
      supabase.from('orders').select('*').eq('buyer_id', session.user.id)
        .then(({ data }) => setOrders(data || []));
    }
  }, [session]);

  const isFarmer = profile?.role === 'farmer';
  const isMiddle = profile?.role === 'middleman';
  const isInd = profile?.role === 'industrialist';

  // Real calculation based on Orders
  const totalSpent = useMemo(() => orders.reduce((sum, o) => sum + (o.total_amount || 0), 0), [orders]);

  // Demo visual data (Pie Chart) - kept for UI structure, but you can replace with real counts later
  const distribution = [
    { name: 'Pending', value: orders.filter(o => o.status === 'pending').length },
    { name: 'Completed', value: orders.filter(o => o.status === 'paid').length },
  ];
  const colors = ['hsl(var(--primary))','hsl(var(--accent))'];

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <SEO title="Dashboard | Agronex" description="View your orders, spending, and account details on Agronex" />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <h1 className="text-3xl font-semibold">Welcome{profile?.name ? `, ${profile.name}` : ''}</h1>
        <p className="text-muted-foreground">Role: {profile?.role} • {profile?.email}</p>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card><CardHeader><CardTitle>Total Orders</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{orders.length}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Total Spend</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">₹ {totalSpent.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Account Status</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">Active</p></CardContent></Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Order Status</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={distribution} innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {distribution.map((_, i) => (<Cell key={i} fill={colors[i % colors.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Role Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {isFarmer && <p>• List new crops for sale via Admin Panel</p>}
              {isMiddle && <p>• View transaction margins</p>}
              {isInd && <p>• Buy directly from farmers/middlemen</p>}
              <p className="mt-4 font-bold text-primary">Your ID: {session?.user.id}</p>
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}