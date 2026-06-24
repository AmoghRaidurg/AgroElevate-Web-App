-- Option B Phase 1 — Wallet provisioning + customer/Android role compatibility
-- Apply after 20250625100008_prod_wallet_balance_sync.sql
-- Does NOT modify checkout_order (remains migration 003 until Phase 2)

-- ---------------------------------------------------------------------------
-- 1. Role helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_valid_profile_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_role IN ('farmer', 'middleman', 'trader', 'industrialist', 'customer', 'admin');
$$;

CREATE OR REPLACE FUNCTION public._is_valid_users_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_role IN ('farmer', 'trader', 'middleman', 'industrialist', 'customer', 'admin');
$$;

CREATE OR REPLACE FUNCTION public._role_for_profiles_table(p_role TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_role = 'trader' THEN 'middleman'
    WHEN p_role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin') THEN p_role
    ELSE 'farmer'
  END;
$$;

CREATE OR REPLACE FUNCTION public._role_for_users_table(p_role TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_role = 'middleman' THEN 'trader'
    WHEN p_role IN ('farmer', 'trader', 'industrialist', 'customer', 'admin') THEN p_role
    ELSE 'farmer'
  END;
$$;

CREATE OR REPLACE FUNCTION public._buyer_participates_in_royalty_chain(p_buyer_role TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_buyer_role, '') IN ('farmer', 'middleman', 'trader', 'industrialist');
$$;

CREATE OR REPLACE FUNCTION public._is_trader_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_role, '') IN ('middleman', 'trader');
$$;

REVOKE ALL ON FUNCTION public._is_valid_profile_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._is_valid_users_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._role_for_profiles_table(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._role_for_users_table(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._buyer_participates_in_royalty_chain(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._is_trader_role(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Expand CHECK constraints
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('farmer', 'middleman', 'trader', 'industrialist', 'customer', 'admin'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('farmer', 'trader', 'middleman', 'industrialist', 'customer', 'admin'));

-- ---------------------------------------------------------------------------
-- 3. Identity resolution + wallet provisioning
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_user_identity(p_uid TEXT)
RETURNS TABLE (
  resolved_name TEXT,
  resolved_role TEXT,
  resolved_phone TEXT,
  resolved_address TEXT,
  resolved_bank TEXT,
  resolved_email TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID;
  v_meta JSONB;
  v_email TEXT;
  v_raw_role TEXT;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN RETURN; END IF;
  v_uid := p_uid::uuid;

  SELECT p.name, p.role, p.phone, p.address, p.bank_account, p.email
  INTO resolved_name, resolved_role, resolved_phone, resolved_address, resolved_bank, resolved_email
  FROM public.profiles p WHERE p.id = v_uid;

  IF FOUND THEN
    resolved_name := COALESCE(NULLIF(resolved_name, ''), 'User');
    resolved_role := public._role_for_profiles_table(COALESCE(NULLIF(resolved_role, ''), 'farmer'));
    resolved_phone := COALESCE(NULLIF(resolved_phone, ''), '0000000000');
    resolved_address := COALESCE(resolved_address, '');
    resolved_bank := COALESCE(resolved_bank, '');
    resolved_email := COALESCE(resolved_email, '');
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT au.email, au.raw_user_meta_data INTO v_email, v_meta
  FROM auth.users au WHERE au.id = v_uid;

  resolved_name := COALESCE(v_meta->>'name', split_part(COALESCE(v_email, ''), '@', 1), 'User');
  v_raw_role := COALESCE(v_meta->>'role', 'farmer');
  IF NOT public._is_valid_profile_role(v_raw_role) AND NOT public._is_valid_users_role(v_raw_role) THEN
    v_raw_role := 'farmer';
  END IF;
  resolved_role := public._role_for_profiles_table(v_raw_role);
  resolved_phone := COALESCE(NULLIF(v_meta->>'phone', ''), '0000000000');
  resolved_address := COALESCE(v_meta->>'address', '');
  resolved_bank := COALESCE(v_meta->>'bank_account', '');
  resolved_email := COALESCE(v_email, '');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_user_identity(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._ensure_users_row(
  p_uid TEXT,
  p_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_profile_role TEXT;
  v_users_role TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_bank TEXT;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN RAISE EXCEPTION 'Invalid user id'; END IF;

  SELECT ri.resolved_name, ri.resolved_role, ri.resolved_phone, ri.resolved_address, ri.resolved_bank
  INTO v_name, v_profile_role, v_phone, v_address, v_bank
  FROM public._resolve_user_identity(p_uid) ri;

  v_name := COALESCE(NULLIF(p_name, ''), v_name, 'User');
  v_profile_role := public._role_for_profiles_table(COALESCE(NULLIF(p_role, ''), v_profile_role, 'farmer'));
  v_users_role := public._role_for_users_table(v_profile_role);
  v_phone := COALESCE(v_phone, '0000000000');
  v_address := COALESCE(v_address, '');
  v_bank := COALESCE(v_bank, '');

  INSERT INTO public.users (
    uid, name, role, "phoneNumber", address, "bankUPI",
    "walletBalance", approved, "createdAt"
  )
  VALUES (p_uid, v_name, v_users_role, v_phone, v_address, v_bank, 0, true, now())
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_users_row(TEXT, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ensure_profile_from_auth()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_meta JSONB;
  v_name TEXT;
  v_raw_role TEXT;
  v_profile_role TEXT;
  v_users_role TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_bank TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT email, raw_user_meta_data INTO v_email, v_meta
  FROM auth.users WHERE id = v_uid;

  v_name := COALESCE(v_meta->>'name', split_part(v_email, '@', 1));
  v_raw_role := COALESCE(v_meta->>'role', 'farmer');
  IF NOT public._is_valid_profile_role(v_raw_role) AND NOT public._is_valid_users_role(v_raw_role) THEN
    v_raw_role := 'farmer';
  END IF;
  v_profile_role := public._role_for_profiles_table(v_raw_role);
  v_users_role := public._role_for_users_table(v_profile_role);
  v_phone := COALESCE(NULLIF(v_meta->>'phone', ''), '0000000000');
  v_address := COALESCE(v_meta->>'address', '');
  v_bank := COALESCE(v_meta->>'bank_account', '');

  INSERT INTO public.profiles (id, email, name, role, address, phone, bank_account, approved, suspended)
  VALUES (v_uid, v_email, v_name, v_profile_role, v_address, v_phone, v_bank, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (
    uid, name, role, "phoneNumber", address, "bankUPI",
    "walletBalance", approved, "createdAt"
  )
  VALUES (v_uid::text, v_name, v_users_role, v_phone, v_address, v_bank, 0, true, now())
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_from_auth() TO authenticated;

-- Backfill missing wallet rows
INSERT INTO public.users (
  uid, name, role, "phoneNumber", address, "bankUPI",
  "walletBalance", approved, "createdAt"
)
SELECT
  p.id::text, p.name, public._role_for_users_table(p.role),
  COALESCE(NULLIF(p.phone, ''), '0000000000'),
  COALESCE(p.address, ''), COALESCE(p.bank_account, ''),
  0, COALESCE(p.approved, true), now()
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL
ON CONFLICT (uid) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Harden add_funds / transfer_funds / get_wallet_balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_funds(p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_name TEXT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT name, role INTO v_name, v_role FROM public.profiles WHERE id = auth.uid();
  PERFORM public._ensure_users_row(v_uid, v_name, v_role);
  PERFORM public._reconcile_wallet_balance(v_uid);
  PERFORM public._wallet_ledger_entry(v_uid, 'deposit', p_amount, NULL, 'Mock wallet deposit');
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_funds(p_receiver_id TEXT, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_name TEXT;
  v_role TEXT;
  v_recv_name TEXT;
  v_recv_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT name, role INTO v_name, v_role FROM public.profiles WHERE id = auth.uid();
  PERFORM public._ensure_users_row(v_uid, v_name, v_role);

  SELECT name, role INTO v_recv_name, v_recv_role FROM public.profiles WHERE id::text = p_receiver_id;
  PERFORM public._ensure_users_row(p_receiver_id, v_recv_name, v_recv_role);

  PERFORM public._wallet_transfer(v_uid, p_receiver_id, p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(TEXT, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Optional AI table role expansion
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_crop_recommendations') THEN
    ALTER TABLE public.ai_crop_recommendations DROP CONSTRAINT IF EXISTS ai_crop_recommendations_role_check;
    ALTER TABLE public.ai_crop_recommendations ADD CONSTRAINT ai_crop_recommendations_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_income_forecasts') THEN
    ALTER TABLE public.ai_income_forecasts DROP CONSTRAINT IF EXISTS ai_income_forecasts_role_check;
    ALTER TABLE public.ai_income_forecasts ADD CONSTRAINT ai_income_forecasts_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_user_insights') THEN
    ALTER TABLE public.ai_user_insights DROP CONSTRAINT IF EXISTS ai_user_insights_role_check;
    ALTER TABLE public.ai_user_insights ADD CONSTRAINT ai_user_insights_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;
END $$;
