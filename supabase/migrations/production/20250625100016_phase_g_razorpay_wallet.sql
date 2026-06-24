-- Phase G — Razorpay wallet integration (RG-001 through RG-004)
-- Apply after 20250625100015_prod_commerce_e2e_fix_v2.sql

-- ---------------------------------------------------------------------------
-- RG-001: Payment tables + wallet_history references + wallet_transfers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_receipt_counters (
  year INT PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
  v_seq BIGINT;
BEGIN
  v_year := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::INT;

  UPDATE public.payment_receipt_counters
  SET last_value = last_value + 1
  WHERE year = v_year
  RETURNING last_value INTO v_seq;

  IF NOT FOUND THEN
    INSERT INTO public.payment_receipt_counters (year, last_value)
    VALUES (v_year, 1)
    RETURNING last_value INTO v_seq;
  END IF;

  RETURN 'AGR-' || v_year::TEXT || '-' || lpad(v_seq::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_receipt_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO service_role;

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'expired')),
  receipt_number TEXT NOT NULL UNIQUE,
  wallet_history_id UUID REFERENCES public.wallet_history(id),
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  paid_at_ist TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_created
  ON public.payment_intents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL UNIQUE REFERENCES public.payment_intents(id),
  user_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  amount_inr NUMERIC(12, 2) NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  razorpay_signature TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ NOT NULL,
  paid_at_ist TIMESTAMPTZ NOT NULL,
  wallet_history_id UUID NOT NULL REFERENCES public.wallet_history(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_paid
  ON public.payment_receipts (user_id, paid_at_ist DESC);

CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('processed', 'ignored', 'failed', 'duplicate')),
  failure_reason TEXT,
  duplicate_of_event_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_processed
  ON public.razorpay_webhook_events (status, processed_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_sender
  ON public.wallet_transfers (sender_id, created_at DESC);

ALTER TABLE public.wallet_history
  ADD COLUMN IF NOT EXISTS "reference_type" TEXT,
  ADD COLUMN IF NOT EXISTS "reference_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_history_reference_type_check'
  ) THEN
    ALTER TABLE public.wallet_history
      ADD CONSTRAINT wallet_history_reference_type_check
      CHECK (
        "reference_type" IS NULL
        OR "reference_type" IN ('payment_intent', 'royalty_obligation', 'order', 'transfer')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_history_reference
  ON public.wallet_history ("reference_type", "reference_id");

-- Backfill legacy references (non-destructive)
UPDATE public.wallet_history
SET "reference_type" = 'order', "reference_id" = "orderId"
WHERE "orderId" IS NOT NULL AND "reference_id" IS NULL;

UPDATE public.wallet_history wh
SET "reference_type" = 'royalty_obligation', "reference_id" = wh."royaltyObligationId"
WHERE wh."royaltyObligationId" IS NOT NULL AND wh."reference_id" IS NULL;

-- ---------------------------------------------------------------------------
-- RG-003: Extend _wallet_ledger_entry (returns wallet_history.id)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public._wallet_ledger_entry(TEXT, TEXT, NUMERIC, UUID, TEXT);

CREATE OR REPLACE FUNCTION public._wallet_ledger_entry(
  p_user_id TEXT,
  p_type TEXT,
  p_amount NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_royalty_obligation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  PERFORM public._ensure_users_row(p_user_id);

  UPDATE public.users
  SET "walletBalance" = COALESCE("walletBalance", 0) + p_amount
  WHERE uid = p_user_id;

  INSERT INTO public.wallet_history (
    "userId", type, amount, "orderId", description, "createdAt",
    "reference_type", "reference_id", "royaltyObligationId"
  ) VALUES (
    p_user_id, p_type, p_amount, p_order_id, p_description, now(),
    p_reference_type, p_reference_id, p_royalty_obligation_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_ledger_entry(TEXT, TEXT, NUMERIC, UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RG-003: _wallet_transfer with wallet_transfers row + references
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public._wallet_transfer(TEXT, TEXT, NUMERIC, UUID, TEXT);

CREATE OR REPLACE FUNCTION public._wallet_transfer(
  p_sender_id TEXT,
  p_receiver_id TEXT,
  p_amount NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_transfer_id UUID;
  v_desc_out TEXT;
  v_desc_in TEXT;
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

  INSERT INTO public.wallet_transfers (sender_id, receiver_id, amount_inr, status)
  VALUES (p_sender_id, p_receiver_id, p_amount, 'completed')
  RETURNING id INTO v_transfer_id;

  v_desc_out := COALESCE(p_description, 'Transfer to ' || p_receiver_id);
  v_desc_in := COALESCE(p_description, 'Transfer from ' || p_sender_id);

  PERFORM public._wallet_ledger_entry(
    p_sender_id, 'transfer_out', -p_amount, p_order_id, v_desc_out, 'transfer', v_transfer_id
  );
  PERFORM public._wallet_ledger_entry(
    p_receiver_id, 'transfer_in', p_amount, p_order_id, v_desc_in, 'transfer', v_transfer_id
  );

  RETURN v_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_transfer(TEXT, TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RG-003: _commerce_settle_sale with order references
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._commerce_settle_sale(
  p_buyer_id TEXT,
  p_seller_id TEXT,
  p_original_farmer_id TEXT,
  p_royalty_percent NUMERIC,
  p_item_total NUMERIC,
  p_order_id UUID,
  p_product_name TEXT
)
RETURNS TABLE (royalty_amount NUMERIC, seller_net NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_royalty NUMERIC := 0;
  v_seller_net NUMERIC;
  v_apply_royalty BOOLEAN;
BEGIN
  IF p_item_total IS NULL OR p_item_total <= 0 THEN
    RAISE EXCEPTION 'Invalid item total';
  END IF;

  PERFORM public._ensure_users_row(p_buyer_id);
  PERFORM public._ensure_users_row(p_seller_id);

  v_apply_royalty := p_original_farmer_id IS NOT NULL
    AND btrim(p_original_farmer_id) <> ''
    AND p_original_farmer_id <> p_seller_id;

  IF v_apply_royalty THEN
    v_royalty := round(p_item_total * COALESCE(p_royalty_percent, 12.5) / 100, 2);
    v_seller_net := p_item_total - v_royalty;
    PERFORM public._ensure_users_row(p_original_farmer_id);

    PERFORM public._wallet_ledger_entry(p_buyer_id, 'purchase', -p_item_total, p_order_id, 'Purchase: ' || p_product_name, 'order', p_order_id);
    PERFORM public._wallet_ledger_entry(p_seller_id, 'sale_income', v_seller_net, p_order_id, 'Sale proceeds: ' || p_product_name, 'order', p_order_id);
    PERFORM public._wallet_ledger_entry(p_original_farmer_id, 'royalty_income', v_royalty, p_order_id, 'Royalty (' || COALESCE(p_royalty_percent, 12.5) || '%): ' || p_product_name, 'order', p_order_id);
    PERFORM public._wallet_ledger_entry(p_seller_id, 'royalty_paid', -v_royalty, p_order_id, 'Royalty remittance for ' || p_product_name, 'order', p_order_id);
  ELSE
    v_seller_net := p_item_total;
    PERFORM public._wallet_ledger_entry(p_buyer_id, 'purchase', -p_item_total, p_order_id, 'Purchase: ' || p_product_name, 'order', p_order_id);
    PERFORM public._wallet_ledger_entry(p_seller_id, 'sale_income', v_seller_net, p_order_id, 'Sale proceeds: ' || p_product_name, 'order', p_order_id);
  END IF;

  royalty_amount := v_royalty;
  seller_net := v_seller_net;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._commerce_settle_sale(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._record_obligation_settlement(
  p_obligation_id UUID,
  p_order_item_id UUID,
  p_royalty_amount NUMERIC,
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.royalty_obligations
  SET settled_amount = settled_amount + p_royalty_amount,
      status = CASE
        WHEN settled_amount + p_royalty_amount > 0 THEN 'settled'
        ELSE status
      END,
      settled_at = COALESCE(settled_at, now())
  WHERE id = p_obligation_id;

  UPDATE public.wallet_history
  SET "royaltyObligationId" = p_obligation_id,
      "reference_type" = 'royalty_obligation',
      "reference_id" = p_obligation_id
  WHERE "orderId" = p_order_id
    AND type IN ('royalty_income', 'royalty_paid')
    AND ("royaltyObligationId" IS NULL OR "reference_id" IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public._record_obligation_settlement(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RG-002: confirm_wallet_deposit (webhook-only settlement)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_wallet_deposit(
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_amount_paise INTEGER,
  p_payment_method TEXT DEFAULT NULL,
  p_paid_at_epoch BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_paid_at TIMESTAMPTZ;
  v_paid_at_ist TIMESTAMPTZ;
  v_wh_id UUID;
  v_desc TEXT;
  v_receipt_id UUID;
  v_balance NUMERIC;
BEGIN
  IF p_razorpay_order_id IS NULL OR p_razorpay_payment_id IS NULL THEN
    RAISE EXCEPTION 'Razorpay order and payment ids are required';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent not found for order %', p_razorpay_order_id;
  END IF;

  IF v_intent.status = 'paid' THEN
  RETURN jsonb_build_object(
    'receipt_number', v_intent.receipt_number,
    'wallet_history_id', v_intent.wallet_history_id,
    'balance', public._get_user_wallet_balance(v_intent.user_id),
    'paid_at_ist', v_intent.paid_at_ist,
    'idempotent', true
  );
  END IF;

  IF v_intent.amount_paise <> p_amount_paise THEN
    UPDATE public.payment_intents
    SET status = 'failed', failure_reason = 'amount_mismatch', updated_at = now()
    WHERE id = v_intent.id;
    RAISE EXCEPTION 'Amount mismatch: expected % paise, got %', v_intent.amount_paise, p_amount_paise;
  END IF;

  v_paid_at := COALESCE(to_timestamp(p_paid_at_epoch), now());
  v_paid_at_ist := v_paid_at AT TIME ZONE 'Asia/Kolkata';

  v_desc := 'Razorpay deposit · Receipt ' || v_intent.receipt_number
    || ' · ' || p_razorpay_order_id || ' · ' || p_razorpay_payment_id;

  v_wh_id := public._wallet_ledger_entry(
    v_intent.user_id, 'deposit', v_intent.amount_inr, NULL, v_desc,
    'payment_intent', v_intent.id
  );

  INSERT INTO public.payment_receipts (
    intent_id, user_id, receipt_number, amount_inr,
    razorpay_order_id, razorpay_payment_id, payment_method,
    paid_at, paid_at_ist, wallet_history_id
  ) VALUES (
    v_intent.id, v_intent.user_id, v_intent.receipt_number, v_intent.amount_inr,
    p_razorpay_order_id, p_razorpay_payment_id, p_payment_method,
    v_paid_at, v_paid_at_ist, v_wh_id
  ) RETURNING id INTO v_receipt_id;

  UPDATE public.payment_intents
  SET status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      wallet_history_id = v_wh_id,
      paid_at = v_paid_at,
      paid_at_ist = v_paid_at_ist,
      updated_at = now()
  WHERE id = v_intent.id;

  v_balance := public._get_user_wallet_balance(v_intent.user_id);

  RETURN jsonb_build_object(
    'receipt_number', v_intent.receipt_number,
    'wallet_history_id', v_wh_id,
    'payment_receipt_id', v_receipt_id,
    'balance', v_balance,
    'paid_at_ist', v_paid_at_ist,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_wallet_deposit(TEXT, TEXT, INTEGER, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_wallet_deposit(TEXT, TEXT, INTEGER, TEXT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_payment_intent_failed(
  p_razorpay_order_id TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_intents
  SET status = 'failed',
      failure_reason = COALESCE(p_failure_reason, 'payment_failed'),
      updated_at = now()
  WHERE razorpay_order_id = p_razorpay_order_id
    AND status = 'created';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_intent_failed(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_intent_failed(TEXT, TEXT) TO service_role;

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
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_audit_summary() TO authenticated;

-- Service-role helper for CI / commerce:verify (simulate webhook path)
CREATE OR REPLACE FUNCTION public.prepare_test_payment_intent(
  p_user_id TEXT,
  p_amount_inr NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent_id UUID;
  v_receipt TEXT;
  v_paise INTEGER;
  v_order_id TEXT;
BEGIN
  IF p_user_id IS NULL OR p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'Invalid test intent parameters';
  END IF;

  v_receipt := public.generate_receipt_number();
  v_paise := round(p_amount_inr * 100)::INTEGER;
  v_order_id := 'order_test_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.payment_intents (
    user_id, amount_inr, amount_paise, currency, razorpay_order_id,
    status, receipt_number, idempotency_key
  ) VALUES (
    p_user_id, p_amount_inr, v_paise, 'INR', v_order_id,
    'created', v_receipt, p_user_id || ':' || v_order_id
  ) RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'intent_id', v_intent_id,
    'razorpay_order_id', v_order_id,
    'receipt_number', v_receipt,
    'amount_paise', v_paise
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_test_payment_intent(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_test_payment_intent(TEXT, NUMERIC) TO service_role;

-- ---------------------------------------------------------------------------
-- RG-004: Retire add_funds for authenticated clients
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_funds(p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Direct wallet credits disabled. Use Razorpay wallet top-up.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_funds(NUMERIC) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_funds(NUMERIC) FROM anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_intents_select_own ON public.payment_intents;
CREATE POLICY payment_intents_select_own ON public.payment_intents
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS payment_receipts_select_own ON public.payment_receipts;
CREATE POLICY payment_receipts_select_own ON public.payment_receipts
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS webhook_events_admin ON public.razorpay_webhook_events;
CREATE POLICY webhook_events_admin ON public.razorpay_webhook_events
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS wallet_transfers_select ON public.wallet_transfers;
CREATE POLICY wallet_transfers_select ON public.wallet_transfers
  FOR SELECT USING (
    sender_id = auth.uid()::text
    OR receiver_id = auth.uid()::text
    OR public.is_admin()
  );
