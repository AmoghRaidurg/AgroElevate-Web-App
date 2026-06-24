-- PRODUCTION Phase F0 — 008: Wallet balance reconciliation
-- Fixes desync when users.walletBalance is 0 but wallet_history has entries.
-- Apply after 20250625100007_prod_commerce_rls_fix.sql

CREATE OR REPLACE FUNCTION public._reconcile_wallet_balance(p_uid TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_sum NUMERIC;
  v_current NUMERIC;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger_sum
  FROM public.wallet_history
  WHERE "userId" = p_uid;

  SELECT COALESCE("walletBalance", 0) INTO v_current
  FROM public.users
  WHERE uid = p_uid;

  -- Only repair obvious desync: balance zero/null but ledger non-zero
  IF COALESCE(v_current, 0) = 0 AND v_ledger_sum <> 0 THEN
    UPDATE public.users
    SET "walletBalance" = v_ledger_sum
    WHERE uid = p_uid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._reconcile_wallet_balance(TEXT) FROM PUBLIC;

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
  PERFORM public._reconcile_wallet_balance(v_uid);

  RETURN public._get_user_wallet_balance(v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;
