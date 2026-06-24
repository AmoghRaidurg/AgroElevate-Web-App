const Footer = () => {
  return (
    <footer className="border-t mt-16">
      <div className="container mx-auto py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} AgroElevate. All rights reserved.</p>
        <nav className="flex gap-6 text-sm">
          <a href="#features" className="hover:opacity-80">Features</a>
          <a href="#pricing" className="hover:opacity-80">Pricing</a>
          <a href="#contact" className="hover:opacity-80">Contact</a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
