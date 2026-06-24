-- PRODUCTION Phase A — 004: Orders status constraint (additive, data-preserving)
-- Does NOT change existing pending rows.
-- Does NOT reference orders.items or buyer_id.
-- DO NOT APPLY until approved.

-- Document column for future developers
COMMENT ON COLUMN public.orders.status IS
  'Marketplace order lifecycle: pending | completed (paid via checkout_order RPC) | wallet_tx (ledger)';

-- Only add CHECK constraint when all rows use known statuses.
-- CHECK expressions must be static SQL literals — PL/pgSQL variables cannot be used inside CHECK (...).
DO $$
DECLARE
  v_unknown_count INTEGER;
  v_unknown_sample TEXT;
  v_allowed TEXT[] := ARRAY['pending', 'completed', 'wallet_tx'];
BEGIN
  SELECT COUNT(*), COALESCE(string_agg(DISTINCT status, ', '), '')
  INTO v_unknown_count, v_unknown_sample
  FROM public.orders
  WHERE status IS NULL
     OR NOT (status = ANY (v_allowed));

  IF v_unknown_count > 0 THEN
    RAISE NOTICE
      'Skipping orders_status_check: % row(s) have statuses not in allowed set: %. '
      'Normalize those rows or extend the allowed list, then re-run.',
      v_unknown_count, v_unknown_sample;
  ELSE
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'completed', 'wallet_tx'));
    RAISE NOTICE 'orders_status_check applied successfully.';
  END IF;
END $$;
