import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile } from '@/lib/auth';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/design/GlassCard';

const schema = z.object({
  name: z.string().min(2), phone: z.string().min(6), address: z.string().min(3), bank_account: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (profile) reset({ name: profile.name ?? '', phone: profile.phone ?? '', address: profile.address ?? '', bank_account: profile.bank_account ?? '' });
  }, [profile, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    const { error } = await updateUserProfile(user.id, values);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success('Profile updated.');
  };

  return (
    <>
      <SEO title="Profile | AgroElevate" />
      <PageHeader title="Your Profile" subtitle="Manage account details" />
      <GlassCard className="max-w-xl">
        <div className="space-y-4 mb-6">
          <div><Label>Email</Label><Input value={profile?.email ?? user?.email ?? ''} disabled className="bg-muted/20 mt-1" /></div>
          <div><Label>Role</Label><Input value={profile?.role ?? ''} disabled className="bg-muted/20 mt-1 capitalize" /></div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><Label>Name</Label><Input {...register('name')} className="bg-muted/30 mt-1" />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
          <div><Label>Phone</Label><Input {...register('phone')} className="bg-muted/30 mt-1" /></div>
          <div><Label>Address</Label><Input {...register('address')} className="bg-muted/30 mt-1" /></div>
          <div><Label>Bank account</Label><Input {...register('bank_account')} className="bg-muted/30 mt-1" /></div>
          <Button type="submit" disabled={isSubmitting} variant="hero">Save changes</Button>
        </form>
      </GlassCard>
    </>
  );
}
