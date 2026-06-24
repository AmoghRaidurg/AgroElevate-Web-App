import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useNavigate, Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import GuestRoute from '@/components/auth/GuestRoute';
import { signUpWithEmail, ensureUserRecords } from '@/lib/auth';
import { toast } from 'sonner';
import { GlassCard } from '@/components/design/GlassCard';
import { Sprout, Store, Factory } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2), email: z.string().email(), password: z.string().min(6),
  role: z.enum(['farmer', 'middleman', 'industrialist']),
  address: z.string().min(3), phone: z.string().min(6), bankAccount: z.string().min(4),
});
type FormValues = z.infer<typeof schema>;

const roleOptions = [
  { value: 'farmer', label: 'Farmer', icon: Sprout },
  { value: 'middleman', label: 'Trader', icon: Store },
  { value: 'industrialist', label: 'Industrialist', icon: Factory },
] as const;

export default function Register() {
  const navigate = useNavigate();
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema), defaultValues: { role: 'farmer' },
  });

  const onSubmit = async (values: FormValues) => {
    const { data, error } = await signUpWithEmail(values);
    if (error) { toast.error(error.message); return; }
    if (!data.user) { toast.error('Registration failed.'); return; }
    if (data.session) {
      const { profile: createdProfile, error: recordError } = await ensureUserRecords(data.user);
      if (recordError || !createdProfile) {
        toast.error(`Profile setup failed: ${recordError ?? 'unknown'}`);
        return;
      }
      toast.success('Registration successful!');
      navigate('/dashboard', { replace: true });
      return;
    }
    toast.success('Check your email to verify your account.');
    navigate('/verify-email', { replace: true, state: { email: values.email } });
  };

  return (
    <GuestRoute>
      <SEO title="Register | AgroElevate" />
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <GlassCard variant="primary" glow>
          <h1 className="font-display text-2xl font-extrabold tracking-tight mb-2">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-6">Join the AgroElevate supply chain network</p>
          <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...register('name')} className="bg-muted/30 mt-1" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} className="bg-muted/30 mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} className="bg-muted/30 mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Role</Label>
              <Controller name="role" control={control} render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-3 gap-2 mt-2">
                  {roleOptions.map(({ value, label, icon: Icon }) => (
                    <label key={value} className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${field.value === value ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-border'}`}>
                      <RadioGroupItem value={value} id={value} className="sr-only" />
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </RadioGroup>
              )} />
            </div>
            <div className="sm:col-span-2"><Label>Address</Label><Input {...register('address')} className="bg-muted/30 mt-1" /></div>
            <div><Label>Phone</Label><Input {...register('phone')} className="bg-muted/30 mt-1" /></div>
            <div><Label>Bank account</Label><Input {...register('bankAccount')} className="bg-muted/30 mt-1" /></div>
            <div className="sm:col-span-2 mt-2">
              <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Create account</Button>
              <p className="text-sm text-muted-foreground text-center mt-3">Have an account? <Link to="/login" className="underline text-primary">Log in</Link></p>
            </div>
          </form>
        </GlassCard>
      </div>
    </GuestRoute>
  );
}
