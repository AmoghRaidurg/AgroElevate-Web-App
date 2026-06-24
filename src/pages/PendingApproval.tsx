import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { GlassCard } from '@/components/design/GlassCard';

export default function PendingApproval() {
  const { signOut, refreshProfile } = useAuth();
  return (
    <>
      <SEO title="Pending Approval | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <GlassCard className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold">Awaiting approval</h1>
          <p className="text-muted-foreground mt-3">Your account is pending administrator approval.</p>
          <div className="flex gap-2 justify-center mt-6">
            <Button variant="outline" onClick={() => refreshProfile()}>Check again</Button>
            <Button variant="ghost" onClick={() => signOut().then(() => window.location.assign('/'))}>Sign out</Button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
