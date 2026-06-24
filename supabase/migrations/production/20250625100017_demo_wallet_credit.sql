-- Demo wallet credit for BE demonstrations (admin-only, separate from Razorpay)
-- Apply after 20250625100016_phase_g_razorpay_wallet.sql

-- ---------------------------------------------------------------------------
-- Audit table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_wallet_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
  wallet_history_id UUID NOT NULL REFERENCES public.wallet_history(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_credits_target_created
  ON public.demo_wallet_credits (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_wallet_credits_admin_created
  ON public.demo_wallet_credits (admin_user_id, created_at DESC);

-- Extend reference_type to include demo_credit
ALTER TABLE public.wallet_history DROP CONSTRAINT IF EXISTS wallet_history_reference_type_check;
ALTER TABLE public.wallet_history
  ADD CONSTRAINT wallet_history_reference_type_check
  CHECK (
    "reference_type" IS NULL
    OR "reference_type" IN ('payment_intent', 'royalty_obligation', 'order', 'transfer', 'demo_credit')
  );

-- ---------------------------------------------------------------------------
-- Admin RPC: instant demo wallet credit (preset amounts only)
-- ---------------------------------------------------------------------------

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

  IF p_amount_inr IS NULL OR p_amount_inr NOT IN (1000, 5000, 10000) THEN
    RAISE EXCEPTION 'Demo credit amount must be ₹1000, ₹5000, or ₹10000';
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

-- ---------------------------------------------------------------------------
-- Extend payment audit summary with demo credit KPI
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_payment_audit_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ist TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_start_ist := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';

  RETURN jsonb_build_object(
    'paid_today', (
      SELECT COUNT(*) FROM public.payment_intents
      WHERE status = 'paid' AND paid_at_ist >= v_start_ist
    ),
    'failed_today', (
      SELECT COUNT(*) FROM public.payment_intents
      WHERE status IN ('failed', 'expired') AND updated_at >= v_start_ist
    ),
    'webhook_failures_24h', (
      SELECT COUNT(*) FROM public.razorpay_webhook_events
      WHERE status = 'failed' AND processed_at >= now() - interval '24 hours'
    ),
    'duplicate_webhooks_24h', (
      SELECT COUNT(*) FROM public.razorpay_webhook_events
      WHERE status = 'duplicate' AND processed_at >= now() - interval '24 hours'
    ),
    'demo_credits_today', (
      SELECT COUNT(*) FROM public.demo_wallet_credits
      WHERE created_at >= v_start_ist
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_audit_summary() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.demo_wallet_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demo_wallet_credits_admin ON public.demo_wallet_credits;
CREATE POLICY demo_wallet_credits_admin ON public.demo_wallet_credits
  FOR SELECT USING (public.is_admin());
