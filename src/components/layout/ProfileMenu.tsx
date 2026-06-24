import { Link } from 'react-router-dom';
import { LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function ProfileMenu() {
  const { session, profile, signOut } = useAuth();
  const name = profile?.name ?? session?.user?.email ?? 'User';
  const initials = name.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await signOut();
    window.location.assign('/');
  };

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle compact />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-border/80 bg-card/60 hover:bg-card pl-1.5 pr-3 shadow-sm">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline max-w-[120px] truncate text-sm">{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
          <DropdownMenuLabel className="font-normal">
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            {profile?.role && <p className="text-xs text-primary capitalize mt-1">{profile.role}</p>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile" className="gap-2 cursor-pointer"><User className="h-4 w-4" /> Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="gap-2 cursor-pointer"><Settings className="h-4 w-4" /> Dashboard</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
