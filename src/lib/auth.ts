import { supabase } from './supabaseClient';
import type { RegisterPayload, ProfileUpdatePayload, UserProfile } from '@/types/auth';
import type { User } from '@supabase/supabase-js';

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(payload: RegisterPayload) {
  return supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo: `${SITE_URL}/login`,
      data: {
        name: payload.name,
        role: payload.role,
        address: payload.address,
        phone: payload.phone,
        bank_account: payload.bankAccount,
      },
    },
  });
}

export async function signOutEverywhere() {
  return supabase.auth.signOut({ scope: 'global' });
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/reset-password`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function resendVerificationEmail(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${SITE_URL}/login` },
  });
}

/** Ensure profiles + users rows exist (handles email-confirm delayed session). */
export async function ensureUserRecords(user: User): Promise<{ profile: UserProfile | null; error?: string }> {
  const meta = user.user_metadata ?? {};
  const role = (meta.role as string) || 'farmer';
  const name = (meta.name as string) || user.email?.split('@')[0] || 'User';

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      name,
      role,
      address: meta.address ?? '',
      phone: meta.phone ?? '',
      bank_account: meta.bank_account ?? '',
      approved: true,
      suspended: false,
    });
    if (profileError) {
      try {
        await supabase.rpc('ensure_profile_from_auth');
      } catch {
        /* RPC may be unavailable until migration 006 is applied */
      }
    }
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('uid')
    .eq('uid', user.id)
    .maybeSingle();

  if (!existingUser) {
    const { error: rpcError } = await supabase.rpc('ensure_profile_from_auth');
    if (rpcError) {
      console.error('Failed to provision users wallet row via RPC:', rpcError.message);
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return { profile: null, error: error.message };
  return { profile: profile as UserProfile };
}

export async function updateUserProfile(userId: string, payload: ProfileUpdatePayload) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      bank_account: payload.bank_account,
    })
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

export async function fetchAllProfilesForAdmin() {
  return supabase
    .from('profiles')
    .select('id, email, name, role, phone, address, suspended, approved, created_at')
    .order('created_at', { ascending: false });
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  return supabase.from('profiles').update({ suspended }).eq('id', userId);
}

export async function adminSetApproved(userId: string, approved: boolean) {
  const [profileRes, userRes] = await Promise.all([
    supabase.from('profiles').update({ approved }).eq('id', userId),
    supabase.from('users').update({ approved }).eq('uid', userId),
  ]);
  return { profileRes, userRes };
}

export function isEmailVerified(user: User): boolean {
  return !!user.email_confirmed_at;
}
