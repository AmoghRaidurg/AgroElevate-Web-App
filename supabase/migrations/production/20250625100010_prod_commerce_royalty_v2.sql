-- PRODUCTION Phase F2 — 010: Commerce royalty model v2
-- Semantic wallet_history types + ownership chain on order_items
-- Apply after 20250625100009_prod_users_wallet_provision_fix.sql

-- ---------------------------------------------------------------------------
-- Additive order_items columns (preserve existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "royaltyAmount" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "royaltyPercent" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "ownershipChain" JSONB;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "sellerId" TEXT;

COMMENT ON COLUMN public.order_items."royaltyAmount" IS 'Royalty paid to original farmer on this line (₹)';
COMMENT ON COLUMN public.order_items."royaltyPercent" IS 'Royalty rate applied (10–12.5%)';
COMMENT ON COLUMN public.order_items."ownershipChain" IS 'JSON array of {user_id, role, acquired_at}';
COMMENT ON COLUMN public.order_items."sellerId" IS 'Seller at time of sale (profiles.id as text)';

-- ---------------------------------------------------------------------------
-- Parse product.description JSON for commerce metadata
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Build ownership chain entry for order line
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Settle one line item: purchase + sale_income + optional royalty_income
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

-- ---------------------------------------------------------------------------
-- checkout_order — AgroElevate royalty model
-- ---------------------------------------------------------------------------
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
  v_buyer_role := COALESCE(v_buyer_role, 'middleman');

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
    v_seller_role := COALESCE(v_seller_role, 'farmer');

    v_ownership_chain := public._build_ownership_chain(
      v_meta->'ownership_chain',
      v_product.seller_id::text,
      v_seller_role,
      v_buyer_id,
      v_buyer_role,
      v_now
    );

    SELECT * INTO v_settlement FROM public._commerce_settle_sale(
      v_buyer_id,
      v_product.seller_id::text,
      CASE
        WHEN v_original_farmer_id <> v_product.seller_id::text THEN v_original_farmer_id
        ELSE NULL
      END,
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
