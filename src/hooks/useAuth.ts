import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type AgronexProfile = {
  name?: string;
  role?: 'farmer' | 'middleman' | 'industrialist';
  address?: string;
  phone?: string;
  bankAccount?: string;
};

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<AgronexProfile | null>(null);

  useEffect(() => {
    const local = localStorage.getItem('agronexProfile');
    if (local) setProfile(JSON.parse(local));

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const meta = data.user.user_metadata as AgronexProfile;
        if (meta) {
          setProfile(meta);
          localStorage.setItem('agronexProfile', JSON.stringify(meta));
        }
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      const meta = session?.user?.user_metadata as AgronexProfile | undefined;
      if (meta) {
        setProfile(meta);
        localStorage.setItem('agronexProfile', JSON.stringify(meta));
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  return { loading, email, profile };
}
