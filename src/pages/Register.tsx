import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['farmer','middleman','industrialist']),
  address: z.string().min(3),
  phone: z.string().min(6),
  bankAccount: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'farmer' }
  });

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { name: values.name, role: values.role, address: values.address, phone: values.phone, bankAccount: values.bankAccount } }
    });
    if (error) return alert(error.message);
    localStorage.setItem('agronexProfile', JSON.stringify({ name: values.name, role: values.role, address: values.address, phone: values.phone, bankAccount: values.bankAccount }));
    navigate('/dashboard');
  };

  return (
    <div>
      <SEO title="Register | Agronex" description="Create your Agronex account as Farmer, Middleman, or Industrialist." />
      <Navbar />
      <main className="container mx-auto max-w-2xl py-16">
        <h1 className="text-3xl font-semibold mb-6">Create your account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label>Role</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="mt-2 grid grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="farmer" id="r1" /><Label htmlFor="r1">Farmer</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="middleman" id="r2" /><Label htmlFor="r2">Middleman</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="industrialist" id="r3" /><Label htmlFor="r3">Industrialist</Label></div>
                </RadioGroup>
              )}
            />
            {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register('address')} />
            {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
            {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <Label htmlFor="bankAccount">Bank account</Label>
            <Input id="bankAccount" {...register('bankAccount')} />
            {errors.bankAccount && <p className="text-sm text-destructive mt-1">{errors.bankAccount.message}</p>}
          </div>
          <div className="sm:col-span-2 mt-2">
            <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Create account</Button>
            <p className="text-sm text-muted-foreground mt-2">Already have an account? <Link to="/login" className="underline">Log in</Link></p>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
