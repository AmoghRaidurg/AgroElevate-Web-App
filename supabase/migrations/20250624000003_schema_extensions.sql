-- DB-008: Product and order schema extensions for future AI + checkout metadata

-- products extensions (nullable — crop_id FK added in Phase B)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS crop_id UUID,
  ADD COLUMN IF NOT EXISTS district_id UUID,
  ADD COLUMN IF NOT EXISTS quality_grade TEXT,
  ADD COLUMN IF NOT EXISTS harvest_date DATE,
  ADD COLUMN IF NOT EXISTS ai_suggested_price NUMERIC(12, 2);

-- orders extensions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_recommendation_id UUID,
  ADD COLUMN IF NOT EXISTS forecast_price_at_purchase NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS landed_cost_breakdown JSONB;
