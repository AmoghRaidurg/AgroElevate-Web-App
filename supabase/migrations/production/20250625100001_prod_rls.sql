-- PRODUCTION Phase A — 001: Row Level Security (additive)
-- Source of truth: exported production schema (camelCase on orders, order_items, wallet_history, users)
-- DO NOT APPLY until approved. Does not create or drop tables.

-- ---------------------------------------------------------------------------
-- is_admin() — uses profiles (Supabase auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- profiles (snake_case — matches app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Allow admin role in check (additive)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin'));

-- ---------------------------------------------------------------------------
-- products (snake_case — matches app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_all ON public.products;
CREATE POLICY products_select_all ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS products_insert_seller ON public.products;
CREATE POLICY products_insert_seller ON public.products
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS products_update_seller ON public.products;
CREATE POLICY products_update_seller ON public.products
  FOR UPDATE USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS products_delete_seller ON public.products;
CREATE POLICY products_delete_seller ON public.products
  FOR DELETE USING (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders (camelCase columns — quoted identifiers)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT
  USING ("buyerId" = auth.uid()::text OR public.is_admin());

-- Inserts/updates via SECURITY DEFINER RPC only

-- ---------------------------------------------------------------------------
-- order_items (camelCase)
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select_via_order ON public.order_items;
CREATE POLICY order_items_select_via_order ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items."orderId"
        AND (o."buyerId" = auth.uid()::text OR public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- wallet_history (camelCase)
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_history_select_own ON public.wallet_history;
CREATE POLICY wallet_history_select_own ON public.wallet_history
  FOR SELECT
  USING ("userId" = auth.uid()::text OR public.is_admin());

-- ---------------------------------------------------------------------------
-- users (camelCase — read own balance row)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (uid = auth.uid()::text OR public.is_admin());

-- walletBalance updates via SECURITY DEFINER RPC only

-- ---------------------------------------------------------------------------
-- crops, transactions, notifications: RLS enabled, read own where applicable
-- (preserve tables; minimal policies — expand in later phases)
-- ---------------------------------------------------------------------------
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crops_select_all ON public.crops;
CREATE POLICY crops_select_all ON public.crops
  FOR SELECT USING (true);

DROP POLICY IF EXISTS crops_insert_farmer ON public.crops;
CREATE POLICY crops_insert_farmer ON public.crops
  FOR INSERT WITH CHECK ("farmerId" = auth.uid()::text);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT
  USING ("userId" = auth.uid()::text OR public.is_admin());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  USING ("userId" = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- indexes (additive, IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders ("buyerId");
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items ("orderId");
CREATE INDEX IF NOT EXISTS idx_wallet_history_user_id ON public.wallet_history ("userId");
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions ("userId");
