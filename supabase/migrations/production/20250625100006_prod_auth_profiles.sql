-- PRODUCTION Phase D — 006: Auth profile fields + admin RLS + users self-insert
-- Apply after 20250625100005_prod_ai_tables.sql

-- Profile moderation fields (approval workflow)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.suspended IS 'Admin suspend — blocks app access';
COMMENT ON COLUMN public.profiles.approved IS 'Admin approval for new accounts';

-- Admin can read/update all profiles (OR with existing own-row policies)
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- Authenticated users can create their users wallet row on registration
DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
  FOR INSERT WITH CHECK (uid = auth.uid()::text);

-- Admin can update users (approve/suspend wallet account flags)
DROP POLICY IF EXISTS users_admin_update ON public.users;
CREATE POLICY users_admin_update ON public.users
  FOR UPDATE USING (public.is_admin());

-- Sync helper: ensure profile exists from auth metadata (optional RPC for recovery)
CREATE OR REPLACE FUNCTION public.ensure_profile_from_auth()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_meta JSONB;
  v_name TEXT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT email, raw_user_meta_data INTO v_email, v_meta
  FROM auth.users WHERE id = v_uid;

  v_name := COALESCE(v_meta->>'name', split_part(v_email, '@', 1));
  v_role := COALESCE(v_meta->>'role', 'farmer');
  IF v_role NOT IN ('farmer', 'middleman', 'industrialist', 'admin') THEN
    v_role := 'farmer';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, address, phone, bank_account, approved, suspended)
  VALUES (
    v_uid,
    v_email,
    v_name,
    v_role,
    COALESCE(v_meta->>'address', ''),
    COALESCE(v_meta->>'phone', ''),
    COALESCE(v_meta->>'bank_account', ''),
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (uid, name, role, "walletBalance", approved, "createdAt")
  VALUES (v_uid::text, v_name, v_role, 0, true, now())
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_from_auth() TO authenticated;
