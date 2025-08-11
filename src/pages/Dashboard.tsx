import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { demoTransactions } from '@/data/demo';
import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function useProjection() {
  const points = demoTransactions.map((t, i) => ({ x: i + 1, y: t.profitMargin }));
  const n = points.length;
  const sumX = points.reduce((a,p)=>a+p.x,0);
  const sumY = points.reduce((a,p)=>a+p.y,0);
  const sumXY = points.reduce((a,p)=>a+p.x*p.y,0);
  const sumXX = points.reduce((a,p)=>a+p.x*p.x,0);
  const slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX || 1);
  const intercept = (sumY - slope*sumX)/n;
  const next = slope*(n+12) + intercept; // next 12 intervals outlook
  return Math.max(0, Math.round(next));
}

export default function Dashboard() {
  const { email, profile } = useAuth();
  const isFarmer = profile?.role === 'farmer';
  const isMiddle = profile?.role === 'middleman';
  const isInd = profile?.role === 'industrialist';
  const projection = useProjection();

  const royalties = useMemo(() => {
    // 12% royalty of profit margins where seller is farmer
    const farmerTx = demoTransactions.filter(t => t.sellerRole === 'farmer');
    return Math.round(farmerTx.reduce((a,t)=> a + t.profitMargin*0.12, 0));
  }, []);

  const role = profile?.role ?? 'farmer';
  const distribution = [
    { name: 'Farmer', value: 12 },
    { name: 'Middleman', value: 8 },
    { name: 'Industrialist', value: 5 },
  ];
  const colors = ['hsl(var(--primary))','hsl(var(--accent))','hsl(var(--muted-foreground))'];

  return (
    <div>
      <SEO title="Dashboard | Agronex" description="Your role-based dashboard with royalties, orders, and analytics." />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <h1 className="text-3xl font-semibold">Welcome{profile?.name ? `, ${profile.name}` : ''}</h1>
        <p className="text-muted-foreground">Role: {role} {email ? `• ${email}` : ''}</p>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="animate-fade-in"><CardHeader><CardTitle>Royalties Earned</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">₹ {royalties.toLocaleString()}</p><p className="text-sm text-muted-foreground">Cumulative (demo)</p></CardContent></Card>
          <Card className="animate-fade-in"><CardHeader><CardTitle>Projected Income</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">₹ {projection.toLocaleString()}</p><p className="text-sm text-muted-foreground">AI projection (demo)</p></CardContent></Card>
          <Card className="animate-fade-in"><CardHeader><CardTitle>Transactions</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{demoTransactions.length}</p><p className="text-sm text-muted-foreground">Past 6 months</p></CardContent></Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Profit Distribution</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={distribution} innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {distribution.map((_, i) => (<Cell key={i} fill={colors[i]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Role Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {isFarmer && (
                <ul className="list-disc pl-5">
                  <li>List new crops for sale</li>
                  <li>Track royalties and payouts</li>
                  <li>View income projections</li>
                </ul>
              )}
              {isMiddle && (
                <ul className="list-disc pl-5">
                  <li>Browse and purchase from farmers</li>
                  <li>Sell to industrialists</li>
                  <li>View transaction margins</li>
                </ul>
              )}
              {isInd && (
                <ul className="list-disc pl-5">
                  <li>Buy directly from farmers/middlemen</li>
                  <li>Manage orders and spend</li>
                  <li>Supplier analytics</li>
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
