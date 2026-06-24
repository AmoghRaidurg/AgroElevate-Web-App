-- PRODUCTION Phase F0 — 007: Commerce RLS fixes
-- Sellers/farmers could not read order_items or parent orders (buyer-only policies).
-- Apply after 20250625100006_prod_auth_profiles.sql

-- ---------------------------------------------------------------------------
-- order_items: allow sellers (farmerId) and royalty recipients to read sales lines
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS order_items_select_as_seller ON public.order_items;
CREATE POLICY order_items_select_as_seller ON public.order_items
  FOR SELECT
  USING (
    "farmerId" = auth.uid()::text
    OR "originalFarmerId" = auth.uid()::text
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- orders: allow read when user is buyer OR sold items on the order
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_select_as_seller ON public.orders;
CREATE POLICY orders_select_as_seller ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi."orderId" = orders.id
        AND (
          oi."farmerId" = auth.uid()::text
          OR oi."originalFarmerId" = auth.uid()::text
        )
    )
    OR public.is_admin()
  );
