import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, TrendingUp, Sprout, BarChart3 } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px] animate-pulse-glow" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full bg-accent/15 blur-[90px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full bg-highlight/15 blur-[80px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-grid opacity-20" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
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

          {/* Product mockup */}
          <div className="relative hidden lg:block h-[520px]">
            {/* Main dashboard card */}
            <div className="absolute inset-4 glass-elevated rounded-2xl p-5 border border-border/60 shadow-2xl animate-float">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-primary/80" />
                <span className="ml-2 text-xs text-muted-foreground font-medium">AgroElevate Intelligence</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {['Revenue', 'Demand', 'Risk'].map((label, i) => (
                  <div key={label} className="rounded-xl bg-secondary/80 p-3 border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="font-display font-bold text-lg mt-1 tabular-nums">{['₹2.4L', '87%', 'Low'][i]}</p>
                  </div>
                ))}
              </div>
              <div className="h-32 rounded-xl bg-gradient-to-r from-primary/20 via-accent/15 to-highlight/20 border border-border/40 flex items-end p-3 gap-1">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-[image:var(--gradient-primary)] opacity-80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* Floating analytics card */}
            <div className="absolute -left-4 top-16 glass-intelligence rounded-xl p-4 w-48 animate-float-delayed shadow-xl">
              <div className="flex items-center gap-2 text-highlight mb-2">
                <Brain className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wide">AI Copilot</span>
              </div>
              <p className="text-xs text-muted-foreground">Top crop: Wheat</p>
              <p className="font-display font-bold text-primary mt-1">+23% profit</p>
            </div>

            {/* Floating marketplace card */}
            <div className="absolute -right-2 bottom-20 glass-card rounded-xl p-4 w-44 animate-float shadow-xl border-accent/30">
              <div className="flex items-center gap-2 text-accent mb-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-semibold">Marketplace</span>
              </div>
              <p className="text-xs text-muted-foreground">Wheat · 500 kg</p>
              <p className="font-display font-bold mt-1 tabular-nums">₹24/kg</p>
            </div>

            {/* Trend badge */}
            <div className="absolute right-8 top-8 glass-card rounded-lg px-3 py-2 flex items-center gap-2 animate-float shadow-lg">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">+18% yield</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
