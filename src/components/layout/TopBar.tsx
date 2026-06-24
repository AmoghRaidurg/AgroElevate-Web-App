import { Link } from 'react-router-dom';
import { MobileNav } from './AppSidebar';
import { ProfileMenu } from './ProfileMenu';

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/85 backdrop-blur-xl px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <MobileNav />
        <Link to="/dashboard" className="md:hidden flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[image:var(--gradient-primary)] p-1">
            <img src="/logo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <span className="font-display font-semibold text-sm">AgroElevate</span>
        </Link>
      </div>
      <ProfileMenu />
    </header>
  );
}
