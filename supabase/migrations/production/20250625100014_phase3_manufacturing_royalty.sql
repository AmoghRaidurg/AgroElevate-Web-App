-- Option B Phase 3 — Manufacturing + deferred downstream royalty (rules 4–5)
-- Apply after 20250625100013_phase2_trader_royalty.sql

-- ---------------------------------------------------------------------------
-- 1. manufacturing_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manufacturing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industrialist_id UUID NOT NULL REFERENCES public.profiles(id),
  original_farmer_id UUID NOT NULL REFERENCES public.profiles(id),
  source_order_id UUID REFERENCES public.orders(id),
  source_order_item_id UUID NOT NULL,
  source_product_id UUID REFERENCES public.products(id),
  input_crop_name TEXT NOT NULL,
  input_qty NUMERIC NOT NULL CHECK (input_qty > 0),
  input_unit TEXT NOT NULL DEFAULT 'kg',
  output_qty NUMERIC,
  output_unit TEXT,
  waste_qty NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  royalty_percent NUMERIC NOT NULL DEFAULT 12.5
    CHECK (royalty_percent >= 10 AND royalty_percent <= 12.5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT manufacturing_batches_source_item_unique UNIQUE (source_order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_mfg_batches_industrialist ON public.manufacturing_batches (industrialist_id, status);
CREATE INDEX IF NOT EXISTS idx_mfg_batches_farmer ON public.manufacturing_batches (original_farmer_id);

-- ---------------------------------------------------------------------------
-- 2. royalty_obligations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.royalty_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_type TEXT NOT NULL CHECK (obligation_type IN ('immediate', 'deferred')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_settled', 'settled', 'cancelled')),
  beneficiary_farmer_id TEXT NOT NULL,
  obligor_id TEXT NOT NULL,
  royalty_percent NUMERIC NOT NULL DEFAULT 12.5
    CHECK (royalty_percent >= 10 AND royalty_percent <= 12.5),
  basis_type TEXT NOT NULL DEFAULT 'sale_price',
  source_order_item_id UUID,
  manufacturing_batch_id UUID REFERENCES public.manufacturing_batches(id),
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  settled_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_royalty_oblig_beneficiary ON public.royalty_obligations (beneficiary_farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_royalty_oblig_obligor ON public.royalty_obligations (obligor_id, status);
CREATE INDEX IF NOT EXISTS idx_royalty_oblig_batch ON public.royalty_obligations (manufacturing_batch_id);

-- ---------------------------------------------------------------------------
-- 3. processed_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processed_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturing_batch_id UUID NOT NULL REFERENCES public.manufacturing_batches(id),
  royalty_obligation_id UUID NOT NULL REFERENCES public.royalty_obligations(id),
  industrialist_id UUID NOT NULL REFERENCES public.profiles(id),
  original_farmer_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  qty_produced NUMERIC NOT NULL CHECK (qty_produced > 0),
  qty_listed NUMERIC NOT NULL DEFAULT 0,
  qty_sold NUMERIC NOT NULL DEFAULT 0,
  royalty_percent NUMERIC NOT NULL DEFAULT 12.5,
  product_id UUID REFERENCES public.products(id),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'listed', 'depleted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  listed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processed_industrialist ON public.processed_products (industrialist_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_product_id ON public.processed_products (product_id) WHERE product_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. wallet_history + order_items linkage (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_history
  ADD COLUMN IF NOT EXISTS "royaltyObligationId" UUID REFERENCES public.royalty_obligations(id);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "royaltyObligationId" UUID REFERENCES public.royalty_obligations(id);

-- ---------------------------------------------------------------------------
-- 5. Internal: create batch + deferred obligation from procurement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._create_deferred_royalty_from_procurement(
  p_order_id UUID,
  p_order_item_id UUID,
  p_buyer_id TEXT,
  p_seller_id TEXT,
  p_crop_name TEXT,
  p_qty NUMERIC,
  p_unit TEXT,
  p_product_id UUID,
  p_royalty_percent NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch_id UUID;
  v_obligation_id UUID;
  v_buyer_uuid UUID;
  v_seller_uuid UUID;
BEGIN
  v_buyer_uuid := p_buyer_id::uuid;
  v_seller_uuid := p_seller_id::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_buyer_uuid AND role = 'industrialist'
  ) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_seller_uuid AND role = 'farmer'
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.manufacturing_batches WHERE source_order_item_id = p_order_item_id) THEN
    SELECT royalty_obligation_id INTO v_obligation_id
    FROM public.processed_products pp
    JOIN public.manufacturing_batches mb ON mb.id = pp.manufacturing_batch_id
    WHERE mb.source_order_item_id = p_order_item_id
    LIMIT 1;
    RETURN v_obligation_id;
  END IF;

  INSERT INTO public.manufacturing_batches (
    industrialist_id, original_farmer_id, source_order_id, source_order_item_id,
    source_product_id, input_crop_name, input_qty, input_unit, status, royalty_percent
  ) VALUES (
    v_buyer_uuid, v_seller_uuid, p_order_id, p_order_item_id,
    p_product_id, p_crop_name, p_qty, COALESCE(p_unit, 'kg'), 'draft', p_royalty_percent
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.royalty_obligations (
    obligation_type, status, beneficiary_farmer_id, obligor_id,
    royalty_percent, source_order_item_id, manufacturing_batch_id, pending_amount
  ) VALUES (
    'deferred', 'pending', p_seller_id, p_buyer_id,
    p_royalty_percent, p_order_item_id, v_batch_id, 0
  ) RETURNING id INTO v_obligation_id;

  RETURN v_obligation_id;
END;
$$;

REVOKE ALL ON FUNCTION public._create_deferred_royalty_from_procurement(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, UUID, NUMERIC) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 6. Internal: settle deferred obligation on processed sale
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._record_obligation_settlement(
  p_obligation_id UUID,
  p_order_item_id UUID,
  p_royalty_amount NUMERIC,
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.royalty_obligations
  SET settled_amount = settled_amount + p_royalty_amount,
      status = CASE
        WHEN settled_amount + p_royalty_amount > 0 THEN 'settled'
        ELSE status
      END,
      settled_at = COALESCE(settled_at, now())
  WHERE id = p_obligation_id;

  UPDATE public.wallet_history
  SET "royaltyObligationId" = p_obligation_id
  WHERE "orderId" = p_order_id
    AND type IN ('royalty_income', 'royalty_paid')
    AND "royaltyObligationId" IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._record_obligation_settlement(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 7. RPC: complete manufacturing batch + create processed product
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_manufacturing_batch(
  p_batch_id UUID,
  p_output_qty NUMERIC,
  p_name TEXT,
  p_unit TEXT DEFAULT 'kg'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch public.manufacturing_batches%ROWTYPE;
  v_obligation_id UUID;
  v_processed_id UUID;
BEGIN
  SELECT * INTO v_batch FROM public.manufacturing_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF v_batch.industrialist_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_batch.status NOT IN ('draft', 'in_progress') THEN RAISE EXCEPTION 'Batch not editable'; END IF;
  IF p_output_qty IS NULL OR p_output_qty <= 0 THEN RAISE EXCEPTION 'Invalid output quantity'; END IF;

  SELECT id INTO v_obligation_id FROM public.royalty_obligations
  WHERE manufacturing_batch_id = p_batch_id LIMIT 1;

  IF v_obligation_id IS NULL THEN
    RAISE EXCEPTION 'No royalty obligation for batch';
  END IF;

  UPDATE public.manufacturing_batches
  SET status = 'completed', output_qty = p_output_qty, output_unit = COALESCE(p_unit, 'kg'),
      completed_at = now(), updated_at = now()
  WHERE id = p_batch_id;

  INSERT INTO public.processed_products (
    manufacturing_batch_id, royalty_obligation_id, industrialist_id, original_farmer_id,
    name, unit, qty_produced, royalty_percent, status
  ) VALUES (
    p_batch_id, v_obligation_id, v_batch.industrialist_id, v_batch.original_farmer_id,
    p_name, COALESCE(p_unit, 'kg'), p_output_qty, v_batch.royalty_percent, 'created'
  ) RETURNING id INTO v_processed_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'processed_product_id', v_processed_id,
    'royalty_obligation_id', v_obligation_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_manufacturing_batch(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC: list processed product on marketplace
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_processed_product(
  p_processed_product_id UUID,
  p_price_per_unit NUMERIC,
  p_qty NUMERIC,
  p_crop_type TEXT DEFAULT 'Processed'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pp public.processed_products%ROWTYPE;
  v_batch public.manufacturing_batches%ROWTYPE;
  v_product_id UUID;
  v_meta JSONB;
  v_chain JSONB;
BEGIN
  SELECT * INTO v_pp FROM public.processed_products WHERE id = p_processed_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processed product not found'; END IF;
  IF v_pp.industrialist_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_pp.status NOT IN ('created', 'listed') THEN RAISE EXCEPTION 'Cannot list this product'; END IF;
  IF p_qty <= 0 OR p_qty > v_pp.qty_produced - v_pp.qty_sold THEN
    RAISE EXCEPTION 'Invalid list quantity';
  END IF;
  IF p_price_per_unit <= 0 THEN RAISE EXCEPTION 'Invalid price'; END IF;

  SELECT * INTO v_batch FROM public.manufacturing_batches WHERE id = v_pp.manufacturing_batch_id;

  v_chain := jsonb_build_array(
    jsonb_build_object('user_id', v_pp.original_farmer_id::text, 'role', 'farmer', 'acquired_at', to_jsonb(v_batch.created_at)),
    jsonb_build_object('user_id', v_pp.industrialist_id::text, 'role', 'industrialist', 'acquired_at', to_jsonb(now()))
  );

  v_meta := jsonb_build_object(
    'product_kind', 'processed',
    'original_farmer_id', v_pp.original_farmer_id::text,
    'current_owner_id', v_pp.industrialist_id::text,
    'ownership_chain', v_chain,
    'royalty_percent', v_pp.royalty_percent,
    'processed_product_id', v_pp.id::text,
    'royalty_obligation_id', v_pp.royalty_obligation_id::text,
    'source_batch_id', v_pp.manufacturing_batch_id::text
  );

  INSERT INTO public.products (
    seller_id, name, crop_type, price_per_unit, quantity, unit, description
  ) VALUES (
    v_pp.industrialist_id, v_pp.name, p_crop_type, p_price_per_unit, p_qty::bigint,
    v_pp.unit, v_meta::text
  ) RETURNING id INTO v_product_id;

  UPDATE public.processed_products
  SET product_id = v_product_id, qty_listed = qty_listed + p_qty,
      status = 'listed', listed_at = COALESCE(listed_at, now())
  WHERE id = p_processed_product_id;

  RETURN jsonb_build_object('product_id', v_product_id, 'processed_product_id', p_processed_product_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_processed_product(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. checkout_order — extend for farmer→industrialist + processed sales
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
      v_order_id, v_product.id, v_product.seller_id::text, v_product.seller_id::text,
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

-- ---------------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.manufacturing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_obligations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batches_industrialist ON public.manufacturing_batches;
CREATE POLICY batches_industrialist ON public.manufacturing_batches
  FOR ALL USING (industrialist_id = auth.uid()) WITH CHECK (industrialist_id = auth.uid());

DROP POLICY IF EXISTS batches_farmer_select ON public.manufacturing_batches;
CREATE POLICY batches_farmer_select ON public.manufacturing_batches
  FOR SELECT USING (original_farmer_id = auth.uid());

DROP POLICY IF EXISTS batches_admin ON public.manufacturing_batches;
CREATE POLICY batches_admin ON public.manufacturing_batches
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS processed_industrialist ON public.processed_products;
CREATE POLICY processed_industrialist ON public.processed_products
  FOR ALL USING (industrialist_id = auth.uid()) WITH CHECK (industrialist_id = auth.uid());

DROP POLICY IF EXISTS processed_farmer_select ON public.processed_products;
CREATE POLICY processed_farmer_select ON public.processed_products
  FOR SELECT USING (original_farmer_id = auth.uid());

DROP POLICY IF EXISTS processed_admin ON public.processed_products;
CREATE POLICY processed_admin ON public.processed_products
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS obligations_beneficiary ON public.royalty_obligations;
CREATE POLICY obligations_beneficiary ON public.royalty_obligations
  FOR SELECT USING (beneficiary_farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS obligations_obligor ON public.royalty_obligations;
CREATE POLICY obligations_obligor ON public.royalty_obligations
  FOR SELECT USING (obligor_id = auth.uid()::text);

DROP POLICY IF EXISTS obligations_admin ON public.royalty_obligations;
CREATE POLICY obligations_admin ON public.royalty_obligations
  FOR ALL USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 11. Read RPCs for dashboards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_manufacturing_batches()
RETURNS SETOF public.manufacturing_batches
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.manufacturing_batches
  WHERE industrialist_id = auth.uid()
     OR original_farmer_id = auth.uid()
     OR public.is_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_manufacturing_batches() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_royalty_obligations()
RETURNS SETOF public.royalty_obligations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.royalty_obligations
  WHERE beneficiary_farmer_id = auth.uid()::text
     OR obligor_id = auth.uid()::text
     OR public.is_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_royalty_obligations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_processed_products()
RETURNS SETOF public.processed_products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.processed_products
  WHERE industrialist_id = auth.uid()
     OR original_farmer_id = auth.uid()
     OR public.is_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_processed_products() TO authenticated;
