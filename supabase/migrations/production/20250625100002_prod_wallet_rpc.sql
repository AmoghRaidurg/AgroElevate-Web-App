-- PRODUCTION Phase A — 002: Wallet RPCs
-- Uses: wallet_history + users.walletBalance (NOT orders.wallet_tx)
-- User IDs: TEXT (auth.uid()::text)
-- DO NOT APPLY until approved.

-- ---------------------------------------------------------------------------
-- Internal: ensure users row exists for auth user (additive upsert)
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
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  INSERT INTO public.users (uid, name, role, "walletBalance", approved, "createdAt")
  VALUES (
    p_uid,
    COALESCE(p_name, 'User'),
    COALESCE(p_role, 'farmer'),
    0,
    true,
    now()
  )
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_users_row(TEXT, TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Internal: read wallet balance from users table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._get_user_wallet_balance(p_uid TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT "walletBalance" FROM public.users WHERE uid = p_uid),
    0
  )::NUMERIC;
$$;

REVOKE ALL ON FUNCTION public._get_user_wallet_balance(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Internal: append wallet_history and sync users.walletBalance
-- p_amount: positive = credit, negative = debit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wallet_ledger_entry(
  p_user_id TEXT,
  p_type TEXT,
  p_amount NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  PERFORM public._ensure_users_row(p_user_id);

  UPDATE public.users
  SET "walletBalance" = COALESCE("walletBalance", 0) + p_amount
  WHERE uid = p_user_id;

  INSERT INTO public.wallet_history ("userId", type, amount, "orderId", description, "createdAt")
  VALUES (p_user_id, p_type, p_amount, p_order_id, p_description, now());
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_ledger_entry(TEXT, TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Internal: transfer between two users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wallet_transfer(
  p_sender_id TEXT,
  p_receiver_id TEXT,
  p_amount NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  IF p_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot transfer to yourself';
  END IF;

  PERFORM public._ensure_users_row(p_sender_id);
  PERFORM public._ensure_users_row(p_receiver_id);

  v_balance := public._get_user_wallet_balance(p_sender_id);

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  PERFORM public._wallet_ledger_entry(
    p_sender_id, 'transfer_out', -p_amount, p_order_id,
    COALESCE(p_description, 'Transfer to ' || p_receiver_id)
  );

  PERFORM public._wallet_ledger_entry(
    p_receiver_id, 'transfer_in', p_amount, p_order_id,
    COALESCE(p_description, 'Transfer from ' || p_sender_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_transfer(TEXT, TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- get_wallet_balance — callable by authenticated user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM public._ensure_users_row(v_uid);

  RETURN public._get_user_wallet_balance(v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;

-- ---------------------------------------------------------------------------
-- add_funds — mock deposit (Phase C replaces with Razorpay)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_funds(p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  PERFORM public._wallet_ledger_entry(
    v_uid, 'deposit', p_amount, NULL, 'Mock wallet deposit'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- transfer_funds — authenticated user is sender
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_receiver_id TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public._wallet_transfer(v_uid, p_receiver_id, p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(TEXT, NUMERIC) TO authenticated;
