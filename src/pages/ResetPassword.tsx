import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { supabase } from '@/lib/supabaseClient';
import { updatePassword } from '@/lib/auth';
import { toast } from 'sonner';
import { GlassCard } from '@/components/design/GlassCard';

const schema = z.object({
  password: z.string().min(6),
  confirm: z.string().min(6),
}).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (values: FormValues) => {
    const { error } = await updatePassword(values.password);
    if (error) { toast.error(error.message); return; }
    toast.success('Password updated.');
    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      <SEO title="Reset Password | AgroElevate" />
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <GlassCard className="w-full max-w-md">
          <h1 className="text-2xl font-semibold mb-6">Set new password</h1>
          {!ready ? (
            <p className="text-muted-foreground">Open the reset link from your email to continue.</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div><Label>New password</Label><Input type="password" {...register('password')} className="bg-muted/30 mt-1" /></div>
              <div><Label>Confirm</Label><Input type="password" {...register('confirm')} className="bg-muted/30 mt-1" />{errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}</div>
              <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Update password</Button>
            </form>
          )}
          <p className="text-sm text-muted-foreground mt-4 text-center"><Link to="/login" className="underline">Back to login</Link></p>
        </GlassCard>
      </div>
    </>
  );
}
