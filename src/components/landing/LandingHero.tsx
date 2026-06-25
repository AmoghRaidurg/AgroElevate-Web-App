import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sprout } from 'lucide-react';
import { HeroSupplyChainChart } from '@/components/charts/HeroSupplyChainChart';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Static background — no pulse/float (prevents perceived page shake) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px]" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full bg-highlight/10 blur-[80px]" />
        <div className="absolute inset-0 bg-grid opacity-20" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Sprout className="h-4 w-4" />
              India&apos;s AI-Powered Agri Supply Chain
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Elevate agriculture with{' '}
              <span className="text-gradient-brand">intelligence</span> &amp; fairness
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Connect farmers, traders, and industrialists on one platform — transparent royalties, secure wallet trading, and district-aware AI forecasts.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/register">
                <Button variant="hero" size="lg" className="gap-2 h-12 px-8">
                  Start Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" size="lg" className="h-12 px-8">
                  Explore Marketplace
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              <div><p className="font-display font-bold text-2xl text-foreground">10–15%</p><p className="text-muted-foreground">Farmer royalties</p></div>
              <div><p className="font-display font-bold text-2xl text-foreground">AI</p><p className="text-muted-foreground">Crop intelligence</p></div>
              <div><p className="font-display font-bold text-2xl text-foreground">₹0</p><p className="text-muted-foreground">To get started</p></div>
            </div>
          </div>

          {/* Stable supply-chain chart — fixed size, no floating overlays */}
          <div className="relative w-full min-h-[400px] lg:min-h-[420px]">
            <HeroSupplyChainChart />
          </div>
        </div>
      </div>
    </section>
  );
}
