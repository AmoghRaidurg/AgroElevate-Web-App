-- DB-002: Row Level Security policies

-- ---------------------------------------------------------------------------
-- helper: admin check
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
-- enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- products policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_select_all ON public.products;
CREATE POLICY products_select_all ON public.products
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS products_insert_seller ON public.products;
CREATE POLICY products_insert_seller ON public.products
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS products_update_seller ON public.products;
CREATE POLICY products_update_seller ON public.products
  FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS products_delete_seller ON public.products;
CREATE POLICY products_delete_seller ON public.products
  FOR DELETE
  USING (auth.uid() = seller_id);

-- ---------------------------------------------------------------------------
-- orders policies — reads only; writes via SECURITY DEFINER RPC functions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT
  USING (auth.uid() = buyer_id OR public.is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated users on orders.
