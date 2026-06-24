-- UPGRADE 10: Schema alterations for production compatibility
-- Source of truth: existing Supabase DB (orders + order_items, no orders.items)
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS patterns only
-- Does NOT create or drop profiles, products, orders, or order_items tables

-- ---------------------------------------------------------------------------
-- helper used by RLS policies (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- orders: wallet ledger metadata (replaces assumed orders.items JSONB)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Phase A extension columns (nullable, for future AI — no FK yet)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_recommendation_id UUID,
  ADD COLUMN IF NOT EXISTS forecast_price_at_purchase NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS landed_cost_breakdown JSONB;

-- ---------------------------------------------------------------------------
-- products: Phase A extension columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS crop_id UUID,
  ADD COLUMN IF NOT EXISTS district_id UUID,
  ADD COLUMN IF NOT EXISTS quality_grade TEXT,
  ADD COLUMN IF NOT EXISTS harvest_date DATE,
  ADD COLUMN IF NOT EXISTS ai_suggested_price NUMERIC(12, 2);

-- ---------------------------------------------------------------------------
-- order_items: royalty / seller snapshot columns (nullable on existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS original_farmer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- profiles: allow admin role in check constraint (upgrade only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin'));

-- ---------------------------------------------------------------------------
-- indexes (no-op if already present)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_wallet_tx ON public.orders(buyer_id) WHERE status = 'wallet_tx';
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- order_items RLS (read via parent order ownership)
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select_via_order ON public.order_items;
CREATE POLICY order_items_select_via_order ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.buyer_id = auth.uid() OR public.is_admin())
    )
  );

-- Writes only through SECURITY DEFINER checkout RPC
