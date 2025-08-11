import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import hero from "@/assets/agronex-hero.jpg";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div>
      <SEO title="Agronex | Fair Agriculture Marketplace" description="Sell and buy crops fairly with transparent royalties, secure payments, and analytics." jsonLd={{"@context":"https://schema.org","@type":"Organization","name":"Agronex","url":typeof window!=="undefined"?window.location.origin:undefined,"logo":"/agronex-og.png","sameAs":["https://twitter.com/agronex"]}} />
      <Navbar />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0"><img src={hero} alt="Agronex agriculture marketplace hero image with fields and data overlays" className="h-full w-full object-cover" loading="eager" /></div>
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
          <div className="container mx-auto relative z-10 min-h-[72vh] flex items-center">
            <div className="max-w-2xl py-16">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">A fair marketplace for agriculture</h1>
              <p className="mt-4 text-lg text-muted-foreground">Agronex connects farmers, middlemen, and industrialists with transparent pricing, automated royalties, and secure payments.</p>
              <div className="mt-8 flex gap-3">
                <Link to="/register"><Button variant="hero" size="lg">Get Started</Button></Link>
                <Link to="/marketplace"><Button variant="outline" size="lg">Explore Marketplace</Button></Link>
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto grid md:grid-cols-3 gap-6 py-16">
          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Transparent Royalties</h3>
            <p className="text-muted-foreground mt-2">10–15% of profit margins flow back to farmers automatically after each sale.</p>
          </div>
          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Secure Payments</h3>
            <p className="text-muted-foreground mt-2">Razorpay-powered e-transactions with digital invoicing.</p>
          </div>
          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Actionable Analytics</h3>
            <p className="text-muted-foreground mt-2">Dashboards and projections to grow smarter with data.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
