-- UPGRADE 13: checkout_order RPC (production schema — writes order_items, NOT orders.items)
-- Prerequisite: 10 (metadata + order_items columns), 12 (wallet RPCs)

-- ---------------------------------------------------------------------------
-- Helper: detect quantity / price column names on order_items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._order_items_qty_column()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.column_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'order_items'
    AND c.column_name IN ('quantity', 'qty')
  ORDER BY CASE c.column_name WHEN 'quantity' THEN 1 ELSE 2 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._order_items_price_column()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.column_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'order_items'
    AND c.column_name IN ('unit_price', 'price_per_unit')
  ORDER BY CASE c.column_name WHEN 'unit_price' THEN 1 ELSE 2 END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._order_items_qty_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._order_items_price_column() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Helper: insert one order_items row (adapts to unit_price vs price_per_unit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._insert_order_item(
  p_order_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC,
  p_seller_id UUID,
  p_original_farmer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty_col TEXT;
  v_price_col TEXT;
  v_sql TEXT;
BEGIN
  v_qty_col := public._order_items_qty_column();
  v_price_col := public._order_items_price_column();

  IF v_qty_col IS NULL THEN
    RAISE EXCEPTION 'order_items table must have a quantity or qty column';
  END IF;

  IF v_price_col IS NULL THEN
    RAISE EXCEPTION 'order_items table must have unit_price or price_per_unit column';
  END IF;

  v_sql := format(
    'INSERT INTO public.order_items (order_id, product_id, %I, %I, seller_id, original_farmer_id)
     VALUES ($1, $2, $3, $4, $5, $6)',
    v_qty_col,
    v_price_col
  );

  EXECUTE v_sql
  USING p_order_id, p_product_id, p_quantity, p_unit_price, p_seller_id, p_original_farmer_id;
END;
$$;

REVOKE ALL ON FUNCTION public._insert_order_item(UUID, UUID, INTEGER, NUMERIC, UUID, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- checkout_order: atomic cart checkout
-- ---------------------------------------------------------------------------
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
  v_item_count INTEGER := 0;
  v_original_farmer_id UUID;
  v_qty INTEGER;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF cart IS NULL OR jsonb_typeof(cart) <> 'array' OR jsonb_array_length(cart) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

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

  INSERT INTO public.orders (buyer_id, total_amount, status, metadata)
  VALUES (v_buyer_id, v_total, 'completed', jsonb_build_object('source', 'marketplace_checkout'))
  RETURNING id INTO v_order_id;

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

    PERFORM public._insert_order_item(
      v_order_id,
      v_product.id,
      v_qty,
      v_product.price_per_unit,
      v_product.seller_id,
      COALESCE(v_original_farmer_id, v_product.seller_id)
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
