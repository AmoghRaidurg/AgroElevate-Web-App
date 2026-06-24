import { Link, useLocation } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { resendVerificationEmail } from '@/lib/auth';
import { toast } from 'sonner';
import { GlassCard } from '@/components/design/GlassCard';

export default function VerifyEmail() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const handleResend = async () => {
    if (!email) { toast.error('No email on file.'); return; }
    const { error } = await resendVerificationEmail(email);
    if (error) toast.error(error.message);
    else toast.success('Verification email sent.');
  };

  return (
    <>
      <SEO title="Verify Email | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <GlassCard className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold">Verify your email</h1>
          <p className="text-muted-foreground mt-3">We sent a confirmation link{email ? ` to ${email}` : ''}.</p>
          {email && <Button variant="outline" className="mt-6" onClick={handleResend}>Resend email</Button>}
          <p className="text-sm mt-6"><Link to="/login" className="underline text-primary">Back to login</Link></p>
        </GlassCard>
      </div>
    </>
  );
}
