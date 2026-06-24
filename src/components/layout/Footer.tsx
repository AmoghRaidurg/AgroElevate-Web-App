import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border/50 mt-auto">
    <div className="container mx-auto py-8 px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} AgroElevate. All rights reserved.</p>
      <nav className="flex gap-6 text-sm text-muted-foreground">
        <Link to="/#features" className="hover:text-foreground transition-colors">Features</Link>
        <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
        <Link to="/intelligence" className="hover:text-foreground transition-colors">Intelligence</Link>
      </nav>
    </div>
  </footer>
);

export default Footer;
