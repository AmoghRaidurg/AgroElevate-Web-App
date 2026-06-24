import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div>
      <SEO 
        title="AgroElevate | Fair Agriculture Marketplace"
        description="Sell and buy crops fairly with transparent royalties, secure payments, and analytics."
        jsonLd={{
          "@context":"https://schema.org",
          "@type":"Organization",
          "name":"AgroElevate",
          "url":typeof window!=="undefined"?window.location.origin:undefined,
          "logo":"/logo.png"
        }}
      />

      <Navbar />

      <main>

        {/* HERO SECTION */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-50 to-background" />

          <div className="container mx-auto relative z-10 min-h-[72vh] flex items-center">
            <div className="max-w-2xl py-16">

              {/* LOGO HERO */}
              <img 
                src="/logo.png"
                alt="AgroElevate"
                className="w-32 mb-6"
              />

              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                A fair marketplace for agriculture
              </h1>

              <p className="mt-4 text-lg text-muted-foreground">
                AgroElevate connects farmers, traders, and industrialists with transparent pricing, automated royalties, and data-driven insights.
              </p>

              <div className="mt-8 flex gap-3">
                <Link to="/register">
                  <Button variant="hero" size="lg">Get Started</Button>
                </Link>
                <Link to="/marketplace">
                  <Button variant="outline" size="lg">Explore Marketplace</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="container mx-auto grid md:grid-cols-3 gap-6 py-16">

          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Transparent Royalties</h3>
            <p className="text-muted-foreground mt-2">
              10–15% of downstream profit margins automatically redistributed back to farmers.
            </p>
          </div>

          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Secure Transactions</h3>
            <p className="text-muted-foreground mt-2">
              Platform-based trading with verified buyers and structured order flows.
            </p>
          </div>

          <div className="p-6 rounded-xl border shadow-sm bg-card">
            <h3 className="text-xl font-semibold">Income Intelligence</h3>
            <p className="text-muted-foreground mt-2">
              Analytics dashboards predicting long-term farmer income uplift.
            </p>
          </div>

        </section>

      </main>

      <Footer />
    </div>
  );
};

export default Index;
