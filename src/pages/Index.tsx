import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Brain, Shield, TrendingUp, Store, Sprout, Factory, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/design/GlassCard";
import { LandingHero } from "@/components/landing/LandingHero";

const features = [
  { icon: TrendingUp, title: "Transparent Royalties", desc: "10–15% of downstream profit margins automatically redistributed to farmers.", accent: "primary" },
  { icon: Shield, title: "Secure Transactions", desc: "Platform-based trading with verified buyers and structured order flows.", accent: "accent" },
  { icon: Brain, title: "AI Intelligence", desc: "India-aware crop advisory, demand forecasts, and income scenarios.", accent: "highlight" },
];

const roles = [
  { icon: Sprout, title: "Farmers", desc: "List produce, track sales, get AI crop recommendations." },
  { icon: Store, title: "Traders", desc: "Procure inventory, resell with royalty tracking, demand alerts." },
  { icon: Factory, title: "Industrialists", desc: "Bulk procurement, supplier analytics, cost forecasting." },
];

export default function Index() {
  return (
    <>
      <SEO
        title="AgroElevate | Fair Agriculture Marketplace"
        description="Sell and buy crops fairly with transparent royalties, secure payments, and AI analytics."
        jsonLd={{ "@context": "https://schema.org", "@type": "Organization", name: "AgroElevate", logo: "/logo.png" }}
      />

      <LandingHero />

      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Built for the entire supply chain</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Every role gets purpose-built tools — from field to factory.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <GlassCard key={f.title} variant={f.accent === 'highlight' ? 'highlight' : f.accent as 'primary' | 'accent'} className="hover:glass-card-glow transition-all duration-300 hover:-translate-y-1" glow>
              <f.icon className={`h-8 w-8 mb-4 ${f.accent === 'highlight' ? 'text-highlight' : f.accent === 'accent' ? 'text-accent' : 'text-primary'}`} />
              <h3 className="font-display text-xl font-bold">{f.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="glass-intelligence rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
          <Brain className="h-14 w-14 text-highlight mx-auto mb-5 relative" />
          <h2 className="font-display text-3xl md:text-4xl font-bold relative">AI Intelligence Command Center</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto relative text-lg">
            District-aware recommendations, 3-scenario income forecasts, demand prediction, and an AI copilot — your unfair advantage.
          </p>
          <Link to="/intelligence" className="inline-block mt-8 relative">
            <Button variant="highlight" size="lg" className="gap-2">Launch Intelligence <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl font-bold text-center mb-12">Who it&apos;s for</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((r) => (
            <GlassCard key={r.title} className="text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <r.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg">{r.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{r.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold">Ready to elevate your agri business?</h2>
        <p className="text-muted-foreground mt-4 text-lg">Join thousands building a fairer supply chain.</p>
        <Link to="/register" className="inline-block mt-10">
          <Button variant="hero" size="lg" className="h-12 px-10">Create Free Account</Button>
        </Link>
      </section>
    </>
  );
}
