-- BE-002: Server-side wallet RPC functions

-- ---------------------------------------------------------------------------
-- Internal transfer helper (not exposed to clients)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wallet_transfer(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount NUMERIC
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

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_sender_id) THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_receiver_id) THEN
    RAISE EXCEPTION 'Receiver profile not found';
  END IF;

  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_balance
  FROM public.orders
  WHERE status = 'wallet_tx' AND buyer_id = p_sender_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.orders (buyer_id, total_amount, status, items)
  VALUES
    (
      p_sender_id,
      -p_amount,
      'wallet_tx',
      jsonb_build_array(jsonb_build_object('type', 'transfer', 'receiver_id', p_receiver_id))
    ),
    (
      p_receiver_id,
      p_amount,
      'wallet_tx',
      jsonb_build_array(jsonb_build_object('type', 'transfer', 'sender_id', p_sender_id))
    );
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_transfer(UUID, UUID, NUMERIC) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- get_wallet_balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_balance()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC
  FROM public.orders
  WHERE status = 'wallet_tx' AND buyer_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;

-- ---------------------------------------------------------------------------
-- add_funds (mock deposit until Razorpay — Phase C)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_funds(p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.orders (buyer_id, total_amount, status, items)
  VALUES (
    auth.uid(),
    p_amount,
    'wallet_tx',
    '[{"type": "deposit"}]'::JSONB
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- transfer_funds (authenticated user is sender)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_receiver_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public._wallet_transfer(auth.uid(), p_receiver_id, p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(UUID, NUMERIC) TO authenticated;
