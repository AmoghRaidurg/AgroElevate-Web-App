import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';
import { demoProducts, demoTransactions } from '@/data/demo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Admin() {
  return (
    <div>
      <SEO title="Admin | Agronex" description="Manage users, transactions, and analytics." />
      <Navbar />
      <main className="container mx-auto py-10 space-y-8">
        <h1 className="text-3xl font-semibold">Admin Panel (Demo)</h1>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Products</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {demoProducts.map(p => (
                  <li key={p.id} className="flex justify-between"><span>{p.name}</span><span>₹{p.pricePerUnit}/{p.unit}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                {demoTransactions.map(t => (
                  <li key={t.id} className="flex justify-between"><span>{t.id}</span><span>{t.sellerRole} ➜ {t.buyerRole}</span><span>₹{t.unitPrice} x {t.units}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
