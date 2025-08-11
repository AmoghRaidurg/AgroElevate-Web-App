import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEO } from '@/components/SEO';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.signInWithPassword({ email: values.email!, password: values.password! });
    if (error) return alert(error.message);
    navigate('/dashboard');
  };
  return (
    <div>
      <SEO title="Login | Agronex" description="Log in to Agronex to access your dashboard and marketplace." />
      <Navbar />
      <main className="container mx-auto max-w-md py-16">
        <h1 className="text-3xl font-semibold mb-6">Log in</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Button type="submit" disabled={isSubmitting} variant="hero" className="w-full">Log in</Button>
          <p className="text-sm text-muted-foreground">No account? <Link to="/register" className="underline">Register</Link></p>
        </form>
      </main>
      <Footer />
    </div>
  );
}
