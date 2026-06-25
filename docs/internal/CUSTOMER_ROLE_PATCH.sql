-- CUSTOMER_ROLE_PATCH.sql
-- Supersedes failed 009, do-not-apply 011, and customer-buggy 010.
-- Shared Android + Web production database — preserves ALL roles:
--   farmer, trader, middleman, industrialist, customer, admin
--
-- SAFE: no DELETE, no UPDATE on existing rows, no auth.users changes.
-- Apply in Supabase SQL Editor after migrations 007 + 008.
-- DO NOT apply 009, 010, or 011 as-is.

-- ===========================================================================
-- 1. Role helpers
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._is_valid_profile_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN ('farmer', 'middleman', 'trader', 'industrialist', 'customer', 'admin');
$$;

CREATE OR REPLACE FUNCTION public._is_valid_users_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN ('farmer', 'trader', 'middleman', 'industrialist', 'customer', 'admin');
$$;

-- profiles/app canonical: trader (users) → middleman (profiles)
CREATE OR REPLACE FUNCTION public._role_for_profiles_table(p_role TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role = 'trader' THEN 'middleman'
    WHEN p_role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin') THEN p_role
    ELSE 'farmer'
  END;
$$;

-- users/wallet store: middleman (profiles) → trader (users); customer passes through
CREATE OR REPLACE FUNCTION public._role_for_users_table(p_role TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role = 'middleman' THEN 'trader'
    WHEN p_role IN ('farmer', 'trader', 'industrialist', 'customer', 'admin') THEN p_role
    ELSE 'farmer'
  END;
$$;

-- Royalty chain participants: B2B roles only — NOT customer or admin
CREATE OR REPLACE FUNCTION public._buyer_participates_in_royalty_chain(p_buyer_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_buyer_role, '') IN ('farmer', 'middleman', 'trader', 'industrialist');
$$;

REVOKE ALL ON FUNCTION public._is_valid_profile_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._is_valid_users_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._role_for_profiles_table(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._role_for_users_table(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._buyer_participates_in_royalty_chain(TEXT) FROM PUBLIC;

-- ===========================================================================
-- 2. Expand CHECK constraints (additive union — no data changes)
-- ===========================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('farmer', 'middleman', 'trader', 'industrialist', 'customer', 'admin'));

COMMENT ON CONSTRAINT profiles_role_check ON public.profiles IS
  'Shared Android/Web roles. middleman=web trader; customer=Android end buyer.';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('farmer', 'trader', 'middleman', 'industrialist', 'customer', 'admin'));

COMMENT ON CONSTRAINT users_role_check ON public.users IS
  'Legacy wallet store. trader=middleman in profiles. Use _role_for_users_table() on INSERT.';

-- ===========================================================================
-- 3. Identity resolution + wallet provisioning (replaces 009 / 011)
-- ===========================================================================

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
  v_raw_role TEXT;
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
    resolved_role := public._role_for_profiles_table(COALESCE(NULLIF(resolved_role, ''), 'farmer'));
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
  v_raw_role := COALESCE(v_meta->>'role', 'farmer');
  IF NOT public._is_valid_profile_role(v_raw_role)
     AND NOT public._is_valid_users_role(v_raw_role) THEN
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_profile_role TEXT;
  v_users_role TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_bank TEXT;
BEGIN
  IF p_uid IS NULL OR p_uid = '' THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

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
  VALUES (
    p_uid, v_name, v_users_role, v_phone, v_address, v_bank,
    0, true, now()
  )
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_users_row(TEXT, TEXT, TEXT) FROM PUBLIC;

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
  v_raw_role TEXT;
  v_profile_role TEXT;
  v_users_role TEXT;
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
  v_raw_role := COALESCE(v_meta->>'role', 'farmer');
  IF NOT public._is_valid_profile_role(v_raw_role)
     AND NOT public._is_valid_users_role(v_raw_role) THEN
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
  VALUES (
    v_uid::text, v_name, v_users_role, v_phone, v_address, v_bank,
    0, true, now()
  )
  ON CONFLICT (uid) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_from_auth() TO authenticated;

-- Backfill: profiles → users (idempotent, preserves customer + maps middleman→trader)
INSERT INTO public.users (
  uid, name, role, "phoneNumber", address, "bankUPI",
  "walletBalance", approved, "createdAt"
)
SELECT
  p.id::text,
  p.name,
  public._role_for_users_table(p.role),
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

-- ===========================================================================
-- 4. Commerce schema (from 010 — additive columns only)
-- ===========================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "royaltyAmount" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "royaltyPercent" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "ownershipChain" JSONB;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "sellerId" TEXT;

-- ===========================================================================
-- 5. Commerce helpers (from 010 — unchanged)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._parse_product_commerce_meta(p_description TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_meta JSONB;
  v_pct NUMERIC;
BEGIN
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    v_meta := p_description::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;

  v_pct := COALESCE(
    NULLIF(v_meta->>'royalty_percent', '')::numeric,
    NULLIF(v_meta->>'royaltyPercent', '')::numeric,
    12.5
  );
  IF v_pct < 10 THEN v_pct := 10; END IF;
  IF v_pct > 12.5 THEN v_pct := 12.5; END IF;

  RETURN jsonb_build_object(
    'original_farmer_id', COALESCE(v_meta->>'original_farmer_id', v_meta->>'originalFarmerId'),
    'current_owner_id', COALESCE(v_meta->>'current_owner_id', v_meta->>'currentOwnerId'),
    'ownership_chain', COALESCE(v_meta->'ownership_chain', v_meta->'ownershipChain', '[]'::jsonb),
    'royalty_percent', v_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public._parse_product_commerce_meta(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._build_ownership_chain(
  p_existing JSONB,
  p_seller_id TEXT,
  p_seller_role TEXT,
  p_buyer_id TEXT,
  p_buyer_role TEXT,
  p_acquired_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_existing, '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object(
        'user_id', p_seller_id,
        'role', p_seller_role,
        'acquired_at', to_jsonb(p_acquired_at)
      ),
      jsonb_build_object(
        'user_id', p_buyer_id,
        'role', p_buyer_role,
        'acquired_at', to_jsonb(p_acquired_at)
      )
    );
$$;

REVOKE ALL ON FUNCTION public._build_ownership_chain(JSONB, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    PERFORM public._wallet_ledger_entry(
      p_buyer_id, 'purchase', -p_item_total, p_order_id,
      'Purchase: ' || p_product_name
    );
    PERFORM public._wallet_ledger_entry(
      p_seller_id, 'sale_income', v_seller_net, p_order_id,
      'Sale proceeds: ' || p_product_name
    );
    PERFORM public._wallet_ledger_entry(
      p_original_farmer_id, 'royalty_income', v_royalty, p_order_id,
      'Royalty (' || COALESCE(p_royalty_percent, 12.5) || '%): ' || p_product_name
    );
    PERFORM public._wallet_ledger_entry(
      p_seller_id, 'royalty_paid', -v_royalty, p_order_id,
      'Royalty remittance for ' || p_product_name
    );
  ELSE
    v_seller_net := p_item_total;
    PERFORM public._wallet_ledger_entry(
      p_buyer_id, 'purchase', -p_item_total, p_order_id,
      'Purchase: ' || p_product_name
    );
    PERFORM public._wallet_ledger_entry(
      p_seller_id, 'sale_income', v_seller_net, p_order_id,
      'Sale proceeds: ' || p_product_name
    );
  END IF;

  royalty_amount := v_royalty;
  seller_net := v_seller_net;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._commerce_settle_sale(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, UUID, TEXT) FROM PUBLIC;

-- ===========================================================================
-- 6. checkout_order — customer-safe royalty model (replaces 010)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.checkout_order(cart JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id TEXT := auth.uid()::text;
  v_buyer_name TEXT;
  v_buyer_role TEXT;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_item_total NUMERIC;
  v_meta JSONB;
  v_balance NUMERIC;
  v_order_id UUID;
  v_item_count INTEGER := 0;
  v_original_farmer_id TEXT;
  v_royalty_farmer_id TEXT;
  v_royalty_percent NUMERIC;
  v_ownership_chain JSONB;
  v_qty NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_settlement RECORD;
  v_seller_role TEXT;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF cart IS NULL OR jsonb_typeof(cart) <> 'array' OR jsonb_array_length(cart) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT name, role INTO v_buyer_name, v_buyer_role
  FROM public.profiles WHERE id = auth.uid();

  v_buyer_name := COALESCE(v_buyer_name, 'Buyer');
  v_buyer_role := public._role_for_profiles_table(COALESCE(v_buyer_role, 'customer'));

  PERFORM public._ensure_users_row(v_buyer_id, v_buyer_name, v_buyer_role);

  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'id';
    END IF;

    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'id')::UUID FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', v_item->>'id'; END IF;
    IF v_product.quantity < v_qty THEN RAISE EXCEPTION 'Insufficient stock for %', v_product.name; END IF;
    IF v_product.seller_id::text = v_buyer_id THEN RAISE EXCEPTION 'Cannot purchase your own listing'; END IF;

    v_total := v_total + (v_product.price_per_unit * v_qty);
  END LOOP;

  v_balance := public._get_user_wallet_balance(v_buyer_id);
  IF v_balance < v_total THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  INSERT INTO public.orders (
    "buyerId", "buyerName", "buyerRole", "totalAmount", status,
    "shippingAddress", "createdAt", "updatedAt"
  ) VALUES (
    v_buyer_id, v_buyer_name, v_buyer_role, v_total, 'completed',
    NULL, v_now, v_now
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::NUMERIC;
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'id')::UUID FOR UPDATE;

    v_item_total := v_product.price_per_unit * v_qty;
    v_meta := public._parse_product_commerce_meta(v_product.description);

    v_original_farmer_id := NULLIF(v_meta->>'original_farmer_id', '');
    v_royalty_percent := COALESCE((v_meta->>'royalty_percent')::numeric, 12.5);

    IF v_original_farmer_id IS NULL THEN
      v_original_farmer_id := v_product.seller_id::text;
    END IF;

    SELECT role INTO v_seller_role FROM public.profiles WHERE id = v_product.seller_id;
    v_seller_role := public._role_for_profiles_table(COALESCE(v_seller_role, 'farmer'));

    -- Customer purchases: no royalty chain, full payment to seller
    IF public._buyer_participates_in_royalty_chain(v_buyer_role)
       AND v_original_farmer_id IS DISTINCT FROM v_product.seller_id::text THEN
      v_royalty_farmer_id := v_original_farmer_id;
      v_ownership_chain := public._build_ownership_chain(
        v_meta->'ownership_chain',
        v_product.seller_id::text,
        v_seller_role,
        v_buyer_id,
        v_buyer_role,
        v_now
      );
    ELSE
      v_royalty_farmer_id := NULL;
      v_ownership_chain := NULL;
    END IF;

    SELECT * INTO v_settlement FROM public._commerce_settle_sale(
      v_buyer_id,
      v_product.seller_id::text,
      v_royalty_farmer_id,
      v_royalty_percent,
      v_item_total,
      v_order_id,
      v_product.name
    );

    UPDATE public.products SET quantity = quantity - v_qty::bigint WHERE id = v_product.id;

    INSERT INTO public.order_items (
      "orderId", "cropId", "farmerId", "sellerId", "cropName",
      quantity, unit, "pricePerUnit", "totalPrice",
      "originalFarmerId", "royaltyAmount", "royaltyPercent", "ownershipChain"
    ) VALUES (
      v_order_id,
      v_product.id,
      v_product.seller_id::text,
      v_product.seller_id::text,
      v_product.name,
      v_qty,
      COALESCE(v_product.unit, 'kg'),
      v_product.price_per_unit,
      v_item_total,
      v_original_farmer_id,
      COALESCE(v_settlement.royalty_amount, 0),
      CASE WHEN COALESCE(v_settlement.royalty_amount, 0) > 0 THEN v_royalty_percent ELSE 0 END,
      v_ownership_chain
    );

    INSERT INTO public.transactions ("userId", type, amount, "orderId", description, "createdAt")
    VALUES (v_buyer_id, 'purchase', -v_item_total, v_order_id, 'Purchase: ' || v_product.name, v_now);

    v_item_count := v_item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total_amount', v_total,
    'item_count', v_item_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_order(JSONB) TO authenticated;

-- ===========================================================================
-- 7. Optional: expand AI table role CHECKs (only if migration 005 applied)
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_crop_recommendations'
  ) THEN
    ALTER TABLE public.ai_crop_recommendations
      DROP CONSTRAINT IF EXISTS ai_crop_recommendations_role_check;
    ALTER TABLE public.ai_crop_recommendations
      ADD CONSTRAINT ai_crop_recommendations_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_income_forecasts'
  ) THEN
    ALTER TABLE public.ai_income_forecasts
      DROP CONSTRAINT IF EXISTS ai_income_forecasts_role_check;
    ALTER TABLE public.ai_income_forecasts
      ADD CONSTRAINT ai_income_forecasts_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_user_insights'
  ) THEN
    ALTER TABLE public.ai_user_insights
      DROP CONSTRAINT IF EXISTS ai_user_insights_role_check;
    ALTER TABLE public.ai_user_insights
      ADD CONSTRAINT ai_user_insights_role_check
      CHECK (role IN ('farmer', 'middleman', 'industrialist', 'customer', 'admin'));
  END IF;
END $$;
