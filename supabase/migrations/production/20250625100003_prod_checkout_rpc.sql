-- PRODUCTION Phase A — 003: checkout_order RPC
-- Uses: orders + order_items (camelCase) + products (snake_case)
-- Maps products.id → order_items."cropId"
-- Wallet: wallet_history + users (via _wallet_transfer)
-- DO NOT APPLY until approved.

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
  v_metadata JSONB;
  v_royalty NUMERIC;
  v_trader_share NUMERIC;
  v_balance NUMERIC;
  v_order_id UUID;
  v_item_count INTEGER := 0;
  v_original_farmer_id TEXT;
  v_qty NUMERIC;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF cart IS NULL OR jsonb_typeof(cart) <> 'array' OR jsonb_array_length(cart) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT name, role INTO v_buyer_name, v_buyer_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_buyer_name IS NULL THEN
    v_buyer_name := 'Buyer';
  END IF;

  IF v_buyer_role IS NULL THEN
    v_buyer_role := 'middleman';
  END IF;

  PERFORM public._ensure_users_row(v_buyer_id, v_buyer_name, v_buyer_role);

  -- Validate cart and compute total
  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::NUMERIC;

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

    IF v_product.seller_id::text = v_buyer_id THEN
      RAISE EXCEPTION 'Cannot purchase your own listing';
    END IF;

    v_total := v_total + (v_product.price_per_unit * v_qty);
  END LOOP;

  v_balance := public._get_user_wallet_balance(v_buyer_id);

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Create order header (production camelCase columns)
  INSERT INTO public.orders (
    "buyerId",
    "buyerName",
    "buyerRole",
    "totalAmount",
    status,
    "shippingAddress",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    v_buyer_id,
    v_buyer_name,
    v_buyer_role,
    v_total,
    'completed',
    NULL,
    v_now,
    v_now
  )
  RETURNING id INTO v_order_id;

  -- Process each line item
  FOR v_item IN SELECT value FROM jsonb_array_elements(cart)
  LOOP
    v_qty := (v_item->>'qty')::NUMERIC;

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
          v_original_farmer_id := v_metadata->>'original_farmer_id';
        ELSIF v_metadata ? 'originalFarmerId' AND v_metadata->>'originalFarmerId' IS NOT NULL THEN
          v_original_farmer_id := v_metadata->>'originalFarmerId';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          v_original_farmer_id := NULL;
      END;
    END IF;

    -- Wallet payments
    IF v_original_farmer_id IS NOT NULL AND v_original_farmer_id <> '' THEN
      v_royalty := round(v_item_total * 0.125, 2);
      v_trader_share := v_item_total - v_royalty;
      PERFORM public._wallet_transfer(
        v_buyer_id, v_product.seller_id::text, v_trader_share, v_order_id,
        'Payment to seller for ' || v_product.name
      );
      PERFORM public._wallet_transfer(
        v_buyer_id, v_original_farmer_id, v_royalty, v_order_id,
        '12.5% royalty to original farmer for ' || v_product.name
      );
    ELSE
      PERFORM public._wallet_transfer(
        v_buyer_id, v_product.seller_id::text, v_item_total, v_order_id,
        'Payment for ' || v_product.name
      );
    END IF;

    -- Decrement stock
    UPDATE public.products
    SET quantity = quantity - v_qty::bigint
    WHERE id = v_product.id;

    -- Insert order line item (production camelCase)
    INSERT INTO public.order_items (
      "orderId",
      "cropId",
      "farmerId",
      "cropName",
      quantity,
      unit,
      "pricePerUnit",
      "totalPrice",
      "originalFarmerId"
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.seller_id::text,
      v_product.name,
      v_qty,
      COALESCE(v_product.unit, 'kg'),
      v_product.price_per_unit,
      v_item_total,
      v_original_farmer_id
    );

    -- Optional audit row in transactions
    INSERT INTO public.transactions ("userId", type, amount, "orderId", description, "createdAt")
    VALUES (
      v_buyer_id,
      'purchase',
      -v_item_total,
      v_order_id,
      'Purchase: ' || v_product.name,
      v_now
    );

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
