import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Legend,
  LineChart, Line,
  ResponsiveContainer, Tooltip, CartesianGrid
} from 'recharts';
import { supabase } from '@/lib/supabaseClient';

export default function Dashboard() {
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (session?.user.id) {
      supabase.from('orders').select('*').eq('buyer_id', session.user.id)
        .then(({ data }) => setOrders(data || []));
    }
  }, [session]);

  const totalSpent = useMemo(
    () => orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    [orders]
  );

  // ===============================
  // VALUE CHAIN DATA
  // ===============================

  const valueChainData = [
    { crop: "Wheat", farmer: 12, trader: 20, industrial: 32, retail: 50 },
    { crop: "Rice", farmer: 18, trader: 28, industrial: 42, retail: 65 },
    { crop: "Onion", farmer: 10, trader: 18, industrial: 30, retail: 48 },
    { crop: "Potato", farmer: 9, trader: 16, industrial: 26, retail: 40 },
    { crop: "Tomato", farmer: 8, trader: 15, industrial: 25, retail: 42 },
    { crop: "Maize", farmer: 11, trader: 19, industrial: 31, retail: 47 },
  ];

  const disparityData = valueChainData.map(item => ({
    crop: item.crop,
    Farmer: item.farmer,
    Trader: item.trader,
    Industrial: item.industrial,
    Retail: item.retail
  }));

  // ===============================
  // INCOME PROJECTION
  // ===============================

  const futureProjection = [
    { year: "2025", without: 245000, with: 245000 },
    { year: "2026", without: 268275, with: 307235 },
    { year: "2027", without: 293760, with: 361940 },
    { year: "2028", without: 321667, with: 496000 },
  ];

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <SEO title="Dashboard | AgroElevate" description="Farmer uplift and supply-chain impact." />
      <Navbar />

      <main className="container mx-auto py-10 space-y-10">

        <h1 className="text-3xl font-semibold">
          Welcome{profile?.name ? `, ${profile.name}` : ''}
        </h1>

        <p className="text-muted-foreground">
          Role: {profile?.role} • {profile?.email}
        </p>

        {/* USER STATS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>Total Orders</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{orders.length}</p></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Spend</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">₹ {totalSpent.toLocaleString()}</p></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Account Status</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-green-600">Active</p></CardContent>
          </Card>
        </section>

        {/* VALUE CHAIN GRAPH */}
        <Card>
          <CardHeader>
            <CardTitle>Value Distribution Across Agricultural Supply Chain</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disparityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="crop" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Farmer" fill="#16a34a" />
                <Bar dataKey="Trader" fill="#f59e0b" />
                <Bar dataKey="Industrial" fill="#3b82f6" />
                <Bar dataKey="Retail" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SPLIT SECTION — IMPACT GRAPH + SOCIAL CONTEXT */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT — GRAPH */}
          <Card>
            <CardHeader>
              <CardTitle>
                Farmer Income Projection (2025–2028)
              </CardTitle>
            </CardHeader>

            <CardContent className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={futureProjection}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="without"
                    stroke="#ef4444"
                    strokeWidth={3}
                    name="Traditional Supply Chain"
                    dot={{ r: 4 }}
                    activeDot={{ r: 8 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="with"
                    stroke="#16a34a"
                    strokeWidth={4}
                    name="With AgroElevate"
                    dot={{ r: 5 }}
                    activeDot={{ r: 9 }}
                  />

                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* RIGHT — SOCIAL IMPACT PANEL */}
          <Card>
            <CardHeader>
              <CardTitle>Why This Problem Exists & How AgroElevate Solves It</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">

              <p>
                Farmers receive the lowest value share despite being primary producers.
                Middlemen and fragmented supply chains reduce direct price realisation.
              </p>

              <p>
                Lack of direct market access forces farmers to depend on mandi-based selling,
                resulting in low margins and high wastage.
              </p>

              <p className="font-semibold text-green-700">
                AgroElevate addresses this through:
              </p>

              <ul className="list-disc pl-5 space-y-2">
                <li>Direct farmer-to-buyer digital marketplace</li>
                <li>Royalty redistribution from supply-chain participants</li>
                <li>Reduced post-harvest losses via demand prediction</li>
                <li>Industry linkage & bulk procurement</li>
                <li>Transparent pricing and real-time market data</li>
              </ul>

              <p className="font-semibold text-primary">
                Social Impact:
              </p>

              <ul className="list-disc pl-5 space-y-2">
                <li>Higher income stability for farmers</li>
                <li>Reduced dependence on intermediaries</li>
                <li>Fair value distribution across the ecosystem</li>
                <li>Strengthened rural economic sustainability</li>
              </ul>

            </CardContent>
          </Card>

        </section>

      </main>

      <Footer />
    </div>
  );
}
