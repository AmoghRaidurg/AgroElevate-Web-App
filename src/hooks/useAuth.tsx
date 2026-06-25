import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensureUserRecords, signOutEverywhere } from '@/lib/auth';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/auth';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUserIdRef = useRef<string | null>(null);
  const profileLoadInFlight = useRef<string | null>(null);

  const loadProfile = useCallback(async (user: User, force = false) => {
    if (!force && profileUserIdRef.current === user.id) {
      setLoading(false);
      return;
    }
    if (profileLoadInFlight.current === user.id) return;

    profileLoadInFlight.current = user.id;
    try {
      const { profile: p } = await ensureUserRecords(user);
      profileUserIdRef.current = user.id;
      setProfile(p);
    } finally {
      profileLoadInFlight.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) void loadProfile(s.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (!s?.user) {
        profileUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        void loadProfile(s.user, true);
        return;
      }

      if (event === 'INITIAL_SESSION' && profileUserIdRef.current !== s.user.id) {
        void loadProfile(s.user);
        return;
      }

      if (event === 'USER_UPDATED') {
        void loadProfile(s.user, true);
        return;
      }

      // TOKEN_REFRESHED and other events — keep session, avoid profile reload flicker
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadProfile(user, true);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await signOutEverywhere();
    profileUserIdRef.current = null;
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
