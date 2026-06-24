-- BE-003: Atomic marketplace checkout RPC

CREATE OR REPLACE FUNCTION public.checkout_order(cart JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_item_total NUMERIC;
  v_metadata JSONB;
  v_royalty NUMERIC;
  v_trader_share NUMERIC;
  v_balance NUMERIC;
  v_order_id UUID;
  v_enriched_items JSONB := '[]'::JSONB;
  v_original_farmer_id UUID;
  v_qty INTEGER;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF cart IS NULL OR jsonb_typeof(cart) <> 'array' OR jsonb_array_length(cart) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Validate cart and compute total
  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::INTEGER;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'id';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'id';
    END IF;

    IF v_product.quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;

    IF v_product.seller_id = v_buyer_id THEN
      RAISE EXCEPTION 'Cannot purchase your own listing';
    END IF;

    v_total := v_total + (v_product.price_per_unit * v_qty);
  END LOOP;

  SELECT public.get_wallet_balance() INTO v_balance;

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Process payments and inventory
  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::INTEGER;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'id')::UUID
    FOR UPDATE;

    v_item_total := v_product.price_per_unit * v_qty;
    v_original_farmer_id := NULL;

    IF v_product.description IS NOT NULL AND btrim(v_product.description) <> '' THEN
      BEGIN
        v_metadata := v_product.description::JSONB;
        IF v_metadata ? 'original_farmer_id' AND v_metadata->>'original_farmer_id' IS NOT NULL THEN
          v_original_farmer_id := (v_metadata->>'original_farmer_id')::UUID;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          v_original_farmer_id := NULL;
      END;
    END IF;

    IF v_original_farmer_id IS NOT NULL THEN
      v_royalty := round(v_item_total * 0.125, 2);
      v_trader_share := v_item_total - v_royalty;
      PERFORM public._wallet_transfer(v_buyer_id, v_product.seller_id, v_trader_share);
      PERFORM public._wallet_transfer(v_buyer_id, v_original_farmer_id, v_royalty);
    ELSE
      PERFORM public._wallet_transfer(v_buyer_id, v_product.seller_id, v_item_total);
    END IF;

    UPDATE public.products
    SET quantity = quantity - v_qty
    WHERE id = v_product.id;

    v_enriched_items := v_enriched_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_item->>'id',
        'qty', v_qty,
        'name', v_product.name,
        'crop_type', v_product.crop_type,
        'price_per_unit', v_product.price_per_unit,
        'seller_id', v_product.seller_id,
        'original_farmer_id', COALESCE(v_original_farmer_id::TEXT, v_product.seller_id::TEXT)
      )
    );
  END LOOP;

  INSERT INTO public.orders (buyer_id, total_amount, items, status)
  VALUES (v_buyer_id, v_total, v_enriched_items, 'completed')
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total_amount', v_total,
    'item_count', jsonb_array_length(v_enriched_items)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_order(JSONB) TO authenticated;
