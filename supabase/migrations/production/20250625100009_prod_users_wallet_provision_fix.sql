-- PRODUCTION Phase F1 — 009: Fix users row provisioning
-- Root cause: _ensure_users_row omitted NOT NULL columns (phoneNumber, address, bankUPI)
-- Apply after 20250625100008_prod_wallet_balance_sync.sql

-- ---------------------------------------------------------------------------
-- Resolve identity fields from profiles (preferred) or auth.users metadata
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_meta JSONB;
  v_email TEXT;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN
  RETURN;
  END IF;

  v_uid := p_uid::uuid;

  SELECT p.name, p.role, p.phone, p.address, p.bank_account, p.email
  INTO resolved_name, resolved_role, resolved_phone, resolved_address, resolved_bank, resolved_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF FOUND THEN
    resolved_name := COALESCE(NULLIF(resolved_name, ''), 'User');
    resolved_role := COALESCE(NULLIF(resolved_role, ''), 'farmer');
    resolved_phone := COALESCE(NULLIF(resolved_phone, ''), '0000000000');
    resolved_address := COALESCE(resolved_address, '');
    resolved_bank := COALESCE(resolved_bank, '');
    resolved_email := COALESCE(resolved_email, '');
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT au.email, au.raw_user_meta_data INTO v_email, v_meta
  FROM auth.users au
  WHERE au.id = v_uid;

  resolved_name := COALESCE(v_meta->>'name', split_part(COALESCE(v_email, ''), '@', 1), 'User');
  resolved_role := COALESCE(v_meta->>'role', 'farmer');
  IF resolved_role NOT IN ('farmer', 'middleman', 'industrialist', 'admin') THEN
    resolved_role := 'farmer';
  END IF;
  resolved_phone := COALESCE(NULLIF(v_meta->>'phone', ''), '0000000000');
  resolved_address := COALESCE(v_meta->>'address', '');
  resolved_bank := COALESCE(v_meta->>'bank_account', '');
  resolved_email := COALESCE(v_email, '');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_user_identity(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Ensure users row with all production NOT NULL columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_users_row(
  p_uid TEXT,
  p_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_bank TEXT;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  SELECT ri.resolved_name, ri.resolved_role, ri.resolved_phone, ri.resolved_address, ri.resolved_bank
  INTO v_name, v_role, v_phone, v_address, v_bank
  FROM public._resolve_user_identity(p_uid) ri;

  v_name := COALESCE(NULLIF(p_name, ''), v_name, 'User');
  v_role := COALESCE(NULLIF(p_role, ''), v_role, 'farmer');
  v_phone := COALESCE(v_phone, '0000000000');
  v_address := COALESCE(v_address, '');
  v_bank := COALESCE(v_bank, '');

  INSERT INTO public.users (
    uid,
    name,
    role,
    "phoneNumber",
    address,
    "bankUPI",
    "walletBalance",
    approved,
    "createdAt"
  )
  VALUES (
    p_uid,
    v_name,
    v_role,
    v_phone,
    v_address,
    v_bank,
    0,
    true,
    now()
  )
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_users_row(TEXT, TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- ensure_profile_from_auth — sync users with full column set
-- ---------------------------------------------------------------------------
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
  v_phone TEXT;
  v_address TEXT;
  v_bank TEXT;
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
  v_phone := COALESCE(NULLIF(v_meta->>'phone', ''), '0000000000');
  v_address := COALESCE(v_meta->>'address', '');
  v_bank := COALESCE(v_meta->>'bank_account', '');

  INSERT INTO public.profiles (id, email, name, role, address, phone, bank_account, approved, suspended)
  VALUES (v_uid, v_email, v_name, v_role, v_address, v_phone, v_bank, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (
    uid, name, role, "phoneNumber", address, "bankUPI",
    "walletBalance", approved, "createdAt"
  )
  VALUES (
    v_uid::text, v_name, v_role, v_phone, v_address, v_bank,
    0, true, now()
  )
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_from_auth() TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: create users rows for profiles missing wallet accounts
-- ---------------------------------------------------------------------------
INSERT INTO public.users (
  uid, name, role, "phoneNumber", address, "bankUPI",
  "walletBalance", approved, "createdAt"
)
SELECT
  p.id::text,
  p.name,
  p.role,
  COALESCE(NULLIF(p.phone, ''), '0000000000'),
  COALESCE(p.address, ''),
  COALESCE(p.bank_account, ''),
  0,
  COALESCE(p.approved, true),
  now()
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL
ON CONFLICT (uid) DO NOTHING;
