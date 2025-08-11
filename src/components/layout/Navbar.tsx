import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const Navbar = () => {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent" />
          <span className="text-lg font-semibold">Agronex</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/marketplace" className="text-sm hover:opacity-80">Marketplace</Link>
          <Link to="/dashboard" className="text-sm hover:opacity-80">Dashboard</Link>
          <Link to="/admin" className="text-sm hover:opacity-80">Admin</Link>
        </div>
        <div className="flex items-center gap-2">
          {email ? (
            <>
              <span className="hidden sm:block text-sm text-muted-foreground">{email}</span>
              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="outline">Log in</Button></Link>
              <Link to="/register"><Button variant="hero">Get Started</Button></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
