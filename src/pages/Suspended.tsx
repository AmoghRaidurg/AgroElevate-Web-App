import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { GlassCard } from '@/components/design/GlassCard';

export default function Suspended() {
  const { signOut } = useAuth();
  return (
    <>
      <SEO title="Account Suspended | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <GlassCard className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold">Account suspended</h1>
          <p className="text-muted-foreground mt-3">Contact support if you believe this is an error.</p>
          <Button variant="outline" className="mt-6" onClick={() => signOut().then(() => window.location.assign('/'))}>Sign out</Button>
        </GlassCard>
      </div>
    </>
  );
}
