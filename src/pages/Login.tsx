import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import GuestRoute from '@/components/auth/GuestRoute';
import { signInWithEmail } from '@/lib/auth';
import { toast } from 'sonner';
import { GlassCard } from '@/components/design/GlassCard';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    const { data, error } = await signInWithEmail(values.email, values.password);
    if (error) { toast.error(error.message); return; }
    if (data.user && !data.user.email_confirmed_at) {
      navigate('/verify-email', { replace: true, state: { email: values.email } });
      return;
    }
    toast.success('Welcome back!');
    navigate(from, { replace: true });
  };

  return (
    <GuestRoute>
      <SEO title="Login | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
          <div className="hidden md:block">
            <img src="/logo.png" alt="" className="w-20 mb-6" />
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-3">Access your dashboard, marketplace, wallet, and AI intelligence.</p>
          </div>
          <GlassCard variant="accent" glow>
            <h2 className="font-display text-2xl font-bold mb-6 md:hidden">Log in</h2>
            <h2 className="font-display text-2xl font-bold mb-6 hidden md:block">Sign in</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} className="bg-muted/30 mt-1" />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot?</Link>
                </div>
                <Input id="password" type="password" autoComplete="current-password" {...register('password')} className="bg-muted/30 mt-1" />
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Log in</Button>
              <p className="text-sm text-muted-foreground text-center">No account? <Link to="/register" className="text-primary underline">Register</Link></p>
            </form>
          </GlassCard>
        </div>
      </div>
    </GuestRoute>
  );
}
