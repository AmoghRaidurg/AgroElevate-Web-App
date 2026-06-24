-- DB-001: Baseline schema for AgroElevate
-- profiles, products, orders

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  bank_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin'));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  price_per_unit NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  quantity INTEGER NOT NULL DEFAULT 0,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_per_unit_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_per_unit_check CHECK (price_per_unit > 0);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_quantity_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_check CHECK (quantity >= 0);

-- ---------------------------------------------------------------------------
-- orders (marketplace orders + wallet ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_amount NUMERIC(12, 2) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN ('completed', 'wallet_tx'));

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_quantity ON public.products(quantity) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
