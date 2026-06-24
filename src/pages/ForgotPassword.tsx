import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import GuestRoute from '@/components/auth/GuestRoute';
import { requestPasswordReset } from '@/lib/auth';
import { toast } from 'sonner';
import { GlassCard } from '@/components/design/GlassCard';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    const { error } = await requestPasswordReset(values.email);
    if (error) { toast.error(error.message); return; }
    toast.success('Password reset link sent. Check your email.');
  };

  return (
    <GuestRoute>
      <SEO title="Forgot Password | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <GlassCard className="w-full max-w-md">
          <h1 className="text-2xl font-semibold mb-2">Forgot password</h1>
          <p className="text-muted-foreground text-sm mb-6">Enter your email for a reset link.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} className="bg-muted/30 mt-1" />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Send reset link</Button>
            <p className="text-sm text-muted-foreground text-center"><Link to="/login" className="underline text-primary">Back to login</Link></p>
          </form>
        </GlassCard>
      </div>
    </GuestRoute>
  );
}
