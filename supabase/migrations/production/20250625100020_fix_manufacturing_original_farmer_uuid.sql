-- Hotfix: UUID type for manufacturing_batches.original_farmer_id
-- Root cause: migration 019 declared v_original_farmer TEXT and inserted into UUID column.
-- Apply after 20250625100019_industrialist_trader_procurement_batches.sql

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
    -- Farmer seller: beneficiary is the seller profile (UUID-native, same as migration 014)
    v_original_farmer_uuid := v_seller_uuid;
  ELSE
    -- Trader seller: original farmer comes from relist metadata or order_items (stored as TEXT UUID strings)
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
