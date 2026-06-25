-- Industrialist procurement batches for farmer AND trader sellers + historical backfill
-- Apply after 20250625100015_prod_commerce_e2e_fix_v2.sql

-- Replace 8-arg overload (signature change: add p_original_farmer_id)
DROP FUNCTION IF EXISTS public._create_deferred_royalty_from_procurement(
  UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, UUID, NUMERIC
);

CREATE OR REPLACE FUNCTION public._create_deferred_royalty_from_procurement(
  p_order_id UUID,
  p_order_item_id UUID,
  p_buyer_id TEXT,
  p_seller_id TEXT,
  p_crop_name TEXT,
  p_qty NUMERIC,
  p_unit TEXT,
  p_product_id UUID,
  p_royalty_percent NUMERIC,
  p_original_farmer_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch_id UUID;
  v_obligation_id UUID;
  v_buyer_uuid UUID;
  v_seller_uuid UUID;
  v_seller_role TEXT;
  v_original_farmer_uuid UUID;
  v_original_farmer_text TEXT;
BEGIN
  v_buyer_uuid := p_buyer_id::uuid;
  v_seller_uuid := p_seller_id::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_buyer_uuid AND role = 'industrialist'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_seller_role FROM public.profiles WHERE id = v_seller_uuid;
  v_seller_role := COALESCE(v_seller_role, 'farmer');

  IF v_seller_role NOT IN ('farmer', 'middleman') THEN
    RETURN NULL;
  END IF;

  IF v_seller_role = 'farmer' THEN
    v_original_farmer_uuid := v_seller_uuid;
  ELSE
    v_original_farmer_text := NULLIF(TRIM(p_original_farmer_id), '');
    IF v_original_farmer_text IS NULL THEN
      SELECT NULLIF(TRIM(oi."originalFarmerId"), '') INTO v_original_farmer_text
      FROM public.order_items oi WHERE oi.id = p_order_item_id;
    END IF;
    IF v_original_farmer_text IS NULL THEN
      RETURN NULL;
    END IF;
    BEGIN
      v_original_farmer_uuid := v_original_farmer_text::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN NULL;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_original_farmer_uuid) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.manufacturing_batches WHERE source_order_item_id = p_order_item_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.manufacturing_batches (
    industrialist_id, original_farmer_id, source_order_id, source_order_item_id,
    source_product_id, input_crop_name, input_qty, input_unit, status, royalty_percent
  ) VALUES (
    v_buyer_uuid, v_original_farmer_uuid, p_order_id, p_order_item_id,
    p_product_id, p_crop_name, p_qty, COALESCE(p_unit, 'kg'), 'draft', p_royalty_percent
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.royalty_obligations (
    obligation_type, status, beneficiary_farmer_id, obligor_id,
    royalty_percent, source_order_item_id, manufacturing_batch_id, pending_amount
  ) VALUES (
    'deferred', 'pending', v_original_farmer_uuid::text, p_buyer_id,
    p_royalty_percent, p_order_item_id, v_batch_id, 0
  ) RETURNING id INTO v_obligation_id;

  RETURN v_obligation_id;
END;
$$;

-- Backfill manufacturing batches for all historical industrialist procurement without a batch
CREATE OR REPLACE FUNCTION public.sync_industrialist_procurement_batches()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_created INT := 0;
  v_row RECORD;
  v_product_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid::uuid AND role = 'industrialist') THEN
    RETURN jsonb_build_object('created', 0, 'message', 'Not an industrialist');
  END IF;

  FOR v_row IN
    SELECT
      oi.id AS order_item_id,
      oi."orderId" AS order_id,
      oi."cropName" AS crop_name,
      oi.quantity,
      COALESCE(oi.unit, 'kg') AS unit,
      oi."farmerId" AS seller_id,
      oi."originalFarmerId" AS original_farmer_id,
      o."buyerId" AS buyer_id,
      COALESCE(oi."royaltyPercent", 12.5) AS royalty_percent
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi."orderId"
    WHERE o."buyerId" = v_uid
      AND o.status = 'completed'
      AND o."buyerRole" = 'industrialist'
      AND NOT EXISTS (
        SELECT 1 FROM public.manufacturing_batches mb
        WHERE mb.source_order_item_id = oi.id
      )
  LOOP
  BEGIN
    SELECT p.id INTO v_product_id
    FROM public.products p
    WHERE p.seller_id::text = v_row.seller_id
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;

    PERFORM public._create_deferred_royalty_from_procurement(
      v_row.order_id,
      v_row.order_item_id,
      v_row.buyer_id,
      v_row.seller_id,
      v_row.crop_name,
      v_row.quantity,
      v_row.unit,
      v_product_id,
      v_row.royalty_percent,
      v_row.original_farmer_id
    );
    v_created := v_created + 1;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  END LOOP;

  RETURN jsonb_build_object('created', v_created);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_industrialist_procurement_batches() TO authenticated;

-- checkout_order — v2 body preserved; extend procurement batch for industrialist + farmer OR trader
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
    v_crop_id := public._resolve_crop_id_for_product(v_product.id);

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

    -- Migration 019: procurement batch for industrialist buying from farmer OR trader
    IF v_buyer_role = 'industrialist' AND v_seller_role IN ('farmer', 'middleman') THEN
      PERFORM public._create_deferred_royalty_from_procurement(
        v_order_id, v_order_item_id, v_buyer_id, v_product.seller_id::text,
        v_product.name, v_qty, COALESCE(v_product.unit, 'kg'),
        v_product.id, v_royalty_percent, v_original_farmer_id
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
