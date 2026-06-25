import { Link, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import Footer from './Footer';

export default function MarketingLayout() {
  const { session, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background bg-mesh">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl shadow-sm">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] p-1.5 shadow-md">
              <img src="/logo.png" alt="AgroElevate" className="h-full w-full object-contain" />
            </div>
            <span className="font-display font-bold text-lg">AgroElevate</span>
          </Link>
          <div className="flex items-center gap-3 min-w-[200px] justify-end">
            <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block font-medium">
              Marketplace
            </Link>
            <Link to="/intelligence" className="text-sm text-highlight hover:text-highlight/80 hidden md:block font-medium">
              Intelligence
            </Link>
            <ThemeToggle compact />
            {loading ? (
              <div className="h-9 w-[168px] rounded-md bg-muted/40" aria-hidden />
            ) : session ? (
              <Link to="/dashboard"><Button variant="hero" size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="outline" size="sm">Log in</Button></Link>
                <Link to="/register"><Button variant="hero" size="sm">Get Started</Button></Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
