-- UPGRADE 11: orders.status constraint (preserves pending + existing data)
-- Does NOT reference orders.items
-- Does NOT delete or recreate tables

-- Normalize formatting only
UPDATE public.orders
SET status = lower(trim(status))
WHERE status IS NOT NULL
  AND status <> lower(trim(status));

-- Empty status → pending (marketplace default, preserves row)
UPDATE public.orders
SET status = 'pending'
WHERE trim(COALESCE(status, '')) = '';

-- Map legacy labels to supported values (rows are updated, not deleted)
UPDATE public.orders
SET status = 'wallet_tx'
WHERE status IN (
  'wallet', 'deposit', 'transfer', 'payment',
  'wallet_transaction', 'topup', 'top_up', 'credit'
);

UPDATE public.orders
SET status = 'completed'
WHERE status IN (
  'processing', 'paid', 'success', 'confirmed',
  'delivered', 'shipped', 'fulfilled', 'active', 'done', 'complete'
);

-- Any other unknown status → pending (safe default; does not touch pending/completed/wallet_tx)
UPDATE public.orders
SET status = 'pending'
WHERE status NOT IN ('pending', 'completed', 'wallet_tx');

-- Verify before constraint
DO $$
DECLARE
  v_bad_count INTEGER;
  v_bad_sample TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(string_agg(DISTINCT status, ', '), '')
  INTO v_bad_count, v_bad_sample
  FROM public.orders
  WHERE status NOT IN ('pending', 'completed', 'wallet_tx');

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      'Cannot apply status constraint: % row(s) still have status: %',
      v_bad_count, v_bad_sample;
  END IF;
END $$;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'completed', 'wallet_tx'));

COMMENT ON CONSTRAINT orders_status_check ON public.orders IS
  'pending = marketplace order not yet paid; completed = paid purchase; wallet_tx = wallet ledger entry';
