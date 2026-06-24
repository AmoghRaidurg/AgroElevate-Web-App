import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const { session, profile, signOut } = useAuth();
  const email = session?.user?.email ?? null;
  const isAdmin = profile?.role === 'admin';

  const handleLogout = async () => {
    await signOut();
    window.location.assign("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="AgroElevate logo" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold">AgroElevate</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/marketplace" className="text-sm hover:opacity-80">Marketplace</Link>
          {session && (
            <>
              <Link to="/dashboard" className="text-sm hover:opacity-80">Dashboard</Link>
              <Link to="/orders" className="text-sm hover:opacity-80">Orders</Link>
              <Link to="/intelligence" className="text-sm hover:opacity-80">Intelligence</Link>
              <Link to="/wallet" className="text-sm hover:opacity-80">Wallet</Link>
              {isAdmin && <Link to="/admin" className="text-sm hover:opacity-80">Admin</Link>}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {email ? (
            <>
              <Link to="/profile" className="hidden sm:block text-sm text-muted-foreground hover:underline">{email}</Link>
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
