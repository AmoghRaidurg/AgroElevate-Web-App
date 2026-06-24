-- PRODUCTION Phase F0 — 015: Commerce E2E fixes
-- SUPERSEDED — DO NOT APPLY. Use 20250625100015_prod_commerce_e2e_fix_v2.sql instead.
-- v1 fails: PostgreSQL does not allow %ROWTYPE in function parameter definitions.
-- Apply after 20250625100014_phase3_manufacturing_royalty.sql
--
-- Fixes:
--   1. get_wallet_balance — read-only (no INSERT/UPDATE in STABLE RPC)
--   2. checkout_order — order_items.cropId FK targets crops.id (not products.id)
--   3. orders / order_items RLS — remove circular policy recursion
--   4. add_funds — reconcile after ledger write (provisioning stays on write paths)

-- ---------------------------------------------------------------------------
-- 1. Read-only wallet balance
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
  v_balance NUMERIC;
  v_ledger_sum NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  v_balance := public._get_user_wallet_balance(v_uid);

  -- Read-only fallback when users.walletBalance is stale but ledger has entries
  IF COALESCE(v_balance, 0) = 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_ledger_sum
    FROM public.wallet_history
    WHERE "userId" = v_uid;

    IF v_ledger_sum <> 0 THEN
      RETURN v_ledger_sum;
    END IF;
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. add_funds — provisioning + reconcile on write path only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_funds(p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_name TEXT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT name, role INTO v_name, v_role FROM public.profiles WHERE id = auth.uid();
  PERFORM public._ensure_users_row(v_uid, v_name, v_role);
  PERFORM public._wallet_ledger_entry(v_uid, 'deposit', p_amount, NULL, 'Mock wallet deposit');
  PERFORM public._reconcile_wallet_balance(v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS helpers — SECURITY DEFINER avoids recursive policy evaluation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_order_buyer(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o."buyerId" = auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_order_buyer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_order_buyer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_is_order_seller(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi."orderId" = p_order_id
      AND (
        oi."farmerId" = auth.uid()::text
        OR oi."originalFarmerId" = auth.uid()::text
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_order_seller(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_order_seller(UUID) TO authenticated;

-- orders: buyer OR seller OR admin (no subquery back into orders)
DROP POLICY IF EXISTS orders_select_own ON public.orders;
DROP POLICY IF EXISTS orders_select_as_seller ON public.orders;
CREATE POLICY orders_select_allowed ON public.orders
  FOR SELECT
  USING (
    "buyerId" = auth.uid()::text
    OR public.user_is_order_seller(id)
    OR public.is_admin()
  );

-- order_items: seller, royalty recipient, buyer via order, or admin
DROP POLICY IF EXISTS order_items_select_via_order ON public.order_items;
DROP POLICY IF EXISTS order_items_select_as_seller ON public.order_items;
CREATE POLICY order_items_select_allowed ON public.order_items
  FOR SELECT
  USING (
    "farmerId" = auth.uid()::text
    OR "originalFarmerId" = auth.uid()::text
    OR public.user_is_order_buyer("orderId")
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. Resolve crops.id for products.id (order_items.cropId FK bridge)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_crop_id_for_product(p_product public.products%ROWTYPE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB := '{}'::jsonb;
  v_crop_id UUID;
  v_source_item_id UUID;
  v_farmer_name TEXT;
  v_category TEXT;
BEGIN
  IF p_product.description IS NOT NULL AND btrim(p_product.description) <> '' THEN
    BEGIN
      v_meta := p_product.description::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_meta := '{}'::jsonb;
    END;

    IF v_meta ? 'crop_id' THEN
      v_crop_id := NULLIF(v_meta->>'crop_id', '')::uuid;
      IF v_crop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.crops c WHERE c.id = v_crop_id) THEN
        RETURN v_crop_id;
      END IF;
    END IF;

    IF v_meta ? 'source_order_item_id' THEN
      v_source_item_id := NULLIF(v_meta->>'source_order_item_id', '')::uuid;
      IF v_source_item_id IS NOT NULL THEN
        SELECT oi."cropId" INTO v_crop_id
        FROM public.order_items oi
        WHERE oi.id = v_source_item_id;

        IF v_crop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.crops c WHERE c.id = v_crop_id) THEN
          RETURN v_crop_id;
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT c.id INTO v_crop_id
  FROM public.crops c
  WHERE c."farmerId" = p_product.seller_id::text
    AND c.name = p_product.name
  ORDER BY c."createdAt" DESC NULLS LAST
  LIMIT 1;

  IF v_crop_id IS NOT NULL THEN
    RETURN v_crop_id;
  END IF;

  SELECT name INTO v_farmer_name FROM public.profiles WHERE id = p_product.seller_id;
  v_category := COALESCE(NULLIF(p_product.crop_type, ''), 'General');

  INSERT INTO public.crops (
    "farmerId", "farmerName", name, quantity, unit, "pricePerUnit",
    "harvestDate", description, category, location, status,
    "soldQuantity", rating, "createdAt"
  ) VALUES (
    p_product.seller_id::text,
    COALESCE(v_farmer_name, 'Farmer'),
    p_product.name,
    GREATEST(p_product.quantity::numeric, 0),
    COALESCE(p_product.unit, 'kg'),
    COALESCE(p_product.price_per_unit, 0),
    CURRENT_DATE::text,
    jsonb_build_object('product_id', p_product.id::text, 'source', 'checkout_bridge')::text,
    v_category,
    '',
    'available',
    0,
    0,
    now()
  )
  RETURNING id INTO v_crop_id;

  RETURN v_crop_id;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_crop_id_for_product(public.products) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. checkout_order — use crops.id for order_items.cropId
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_order(cart JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_order_item_id UUID;
  v_crop_id UUID;
  v_original_farmer_id TEXT;
  v_royalty_farmer_id TEXT;
  v_royalty_percent NUMERIC;
  v_ownership_chain JSONB;
  v_qty NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_settlement RECORD;
  v_seller_role TEXT;
  v_product_kind TEXT;
  v_royalty_mode TEXT;
  v_obligation_id UUID;
  v_processed_id UUID;
  v_deferred_royalty NUMERIC;
BEGIN
  IF v_buyer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF cart IS NULL OR jsonb_typeof(cart) <> 'array' OR jsonb_array_length(cart) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT name, role INTO v_buyer_name, v_buyer_role FROM public.profiles WHERE id = auth.uid();
  v_buyer_name := COALESCE(v_buyer_name, 'Buyer');
  v_buyer_role := public._role_for_profiles_table(COALESCE(v_buyer_role, 'customer'));
  PERFORM public._ensure_users_row(v_buyer_id, v_buyer_name, v_buyer_role);

  FOR v_item IN SELECT value FROM jsonb_array_elements(cart) LOOP
    v_qty := (v_item->>'qty')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'id'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::UUID FOR UPDATE;
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
    v_buyer_id, v_buyer_name, v_buyer_role, v_total, 'completed', NULL, v_now, v_now
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(cart) LOOP
    v_qty := (v_item->>'qty')::NUMERIC;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::UUID FOR UPDATE;

    v_item_total := v_product.price_per_unit * v_qty;
    v_meta := public._parse_product_commerce_meta(v_product.description);
    v_crop_id := public._resolve_crop_id_for_product(v_product);

    SELECT role INTO v_seller_role FROM public.profiles WHERE id = v_product.seller_id;
    v_seller_role := public._role_for_profiles_table(COALESCE(v_seller_role, 'farmer'));

    v_product_kind := public._infer_product_kind(v_product.description, v_seller_role);
    v_royalty_mode := public._resolve_sale_royalty_mode(v_buyer_role, v_seller_role, v_product_kind);

    v_original_farmer_id := NULLIF(v_meta->>'original_farmer_id', '');
    v_royalty_percent := COALESCE((v_meta->>'royalty_percent')::numeric, 12.5);
    IF v_original_farmer_id IS NULL THEN
      v_original_farmer_id := v_product.seller_id::text;
    END IF;

    v_obligation_id := NULL;
    v_royalty_farmer_id := NULL;
    v_ownership_chain := NULL;
    v_deferred_royalty := 0;

    IF v_royalty_mode = 'immediate' THEN
      v_royalty_farmer_id := v_original_farmer_id;
      v_ownership_chain := public._build_ownership_chain(
        v_meta->'ownership_chain', v_product.seller_id::text, v_seller_role,
        v_buyer_id, v_buyer_role, v_now
      );
      SELECT * INTO v_settlement FROM public._commerce_settle_sale(
        v_buyer_id, v_product.seller_id::text, v_royalty_farmer_id,
        v_royalty_percent, v_item_total, v_order_id, v_product.name
      );
      v_deferred_royalty := COALESCE(v_settlement.royalty_amount, 0);

    ELSIF v_royalty_mode = 'deferred_settle' THEN
      v_obligation_id := NULLIF(v_meta->>'royalty_obligation_id', '')::uuid;
      IF v_obligation_id IS NULL THEN
        RAISE EXCEPTION 'Processed product missing royalty obligation';
      END IF;
      v_royalty_farmer_id := v_original_farmer_id;
      SELECT * INTO v_settlement FROM public._commerce_settle_sale(
        v_buyer_id, v_product.seller_id::text, v_royalty_farmer_id,
        v_royalty_percent, v_item_total, v_order_id, v_product.name
      );
      v_deferred_royalty := COALESCE(v_settlement.royalty_amount, 0);
      PERFORM public._record_obligation_settlement(
        v_obligation_id, NULL, v_deferred_royalty, v_order_id
      );
      v_ownership_chain := v_meta->'ownership_chain';
      v_processed_id := NULLIF(v_meta->>'processed_product_id', '')::uuid;
      IF v_processed_id IS NOT NULL THEN
        UPDATE public.processed_products
        SET qty_sold = qty_sold + v_qty,
            status = CASE WHEN qty_sold + v_qty >= qty_produced THEN 'depleted' ELSE status END
        WHERE id = v_processed_id;
      END IF;

    ELSE
      SELECT * INTO v_settlement FROM public._commerce_settle_sale(
        v_buyer_id, v_product.seller_id::text, NULL,
        v_royalty_percent, v_item_total, v_order_id, v_product.name
      );
      v_deferred_royalty := 0;
    END IF;

    UPDATE public.products SET quantity = quantity - v_qty::bigint WHERE id = v_product.id;

    INSERT INTO public.order_items (
      "orderId", "cropId", "farmerId", "sellerId", "cropName",
      quantity, unit, "pricePerUnit", "totalPrice",
      "originalFarmerId", "royaltyAmount", "royaltyPercent", "ownershipChain", "royaltyObligationId"
    ) VALUES (
      v_order_id, v_crop_id, v_product.seller_id::text, v_product.seller_id::text,
      v_product.name, v_qty, COALESCE(v_product.unit, 'kg'),
      v_product.price_per_unit, v_item_total, v_original_farmer_id,
      v_deferred_royalty,
      CASE WHEN v_deferred_royalty > 0 THEN v_royalty_percent ELSE 0 END,
      v_ownership_chain, v_obligation_id
    ) RETURNING id INTO v_order_item_id;

    IF v_seller_role = 'farmer' AND v_buyer_role = 'industrialist' THEN
      PERFORM public._create_deferred_royalty_from_procurement(
        v_order_id, v_order_item_id, v_buyer_id, v_product.seller_id::text,
        v_product.name, v_qty, COALESCE(v_product.unit, 'kg'),
        v_product.id, v_royalty_percent
      );
    END IF;

    INSERT INTO public.transactions ("userId", type, amount, "orderId", description, "createdAt")
    VALUES (v_buyer_id, 'purchase', -v_item_total, v_order_id, 'Purchase: ' || v_product.name, v_now);

    v_item_count := v_item_count + 1;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'total_amount', v_total, 'item_count', v_item_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_order(JSONB) TO authenticated;
