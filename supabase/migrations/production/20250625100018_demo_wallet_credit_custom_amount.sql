-- Demo wallet credit: allow custom amounts (1–100000 INR)
-- Apply after 20250625100017_demo_wallet_credit.sql

CREATE OR REPLACE FUNCTION public.admin_demo_wallet_credit(
  p_target_user_id TEXT,
  p_amount_inr NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id TEXT;
  v_audit_id UUID;
  v_wh_id UUID;
  v_balance NUMERIC;
  v_desc TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_target_user_id IS NULL OR btrim(p_target_user_id) = '' THEN
    RAISE EXCEPTION 'Target user id is required';
  END IF;

  IF p_amount_inr IS NULL OR p_amount_inr < 1 OR p_amount_inr > 100000 THEN
    RAISE EXCEPTION 'Demo credit amount must be between ₹1 and ₹100000';
  END IF;

  v_admin_id := auth.uid()::text;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public._ensure_users_row(p_target_user_id);

  v_desc := 'Demo wallet credit · ₹' || p_amount_inr::TEXT;

  v_wh_id := public._wallet_ledger_entry(
    p_target_user_id, 'demo_credit', p_amount_inr, NULL, v_desc,
    'demo_credit', NULL
  );

  INSERT INTO public.demo_wallet_credits (
    target_user_id, admin_user_id, amount_inr, wallet_history_id, note
  ) VALUES (
    p_target_user_id, v_admin_id, p_amount_inr, v_wh_id,
    'BE demonstration credit'
  ) RETURNING id INTO v_audit_id;

  UPDATE public.wallet_history
  SET "reference_id" = v_audit_id,
      description = v_desc || ' · audit ' || v_audit_id::TEXT
  WHERE id = v_wh_id;

  v_balance := public._get_user_wallet_balance(p_target_user_id);

  RETURN jsonb_build_object(
    'demo_credit_id', v_audit_id,
    'wallet_history_id', v_wh_id,
    'target_user_id', p_target_user_id,
    'amount_inr', p_amount_inr,
    'balance', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_demo_wallet_credit(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_demo_wallet_credit(TEXT, NUMERIC) TO authenticated;
