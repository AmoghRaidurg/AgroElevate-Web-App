import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const location = useLocation();
  const isIntelligence = location.pathname.startsWith('/intelligence');

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main
          className={cn(
            'flex-1 relative',
            isIntelligence
              ? 'bg-[hsl(228_35%_5%)] dark:bg-[hsl(228_35%_5%)]'
              : 'bg-mesh',
          )}
        >
          {isIntelligence && (
            <>
              <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-highlight/10 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-accent/8 blur-[100px] rounded-full pointer-events-none" />
            </>
          )}
          <div className={cn('container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-7xl relative z-10', isIntelligence && 'pb-12')}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
