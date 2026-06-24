-- PRODUCTION Phase B — 005: AI Intelligence tables (additive)
-- Compatible with existing marketplace schema. Does not modify products/orders.
-- Apply after Phase A migrations 001–004.

-- ---------------------------------------------------------------------------
-- ai_crop_recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_crop_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin')),
  location TEXT,
  season TEXT,
  month INTEGER CHECK (month >= 1 AND month <= 12),
  crop_name TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 20),
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  expected_profitability NUMERIC(12,2),
  risk_score NUMERIC(5,4) CHECK (risk_score >= 0 AND risk_score <= 1),
  model_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_crop_rec_user ON public.ai_crop_recommendations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_crop_rec_crop ON public.ai_crop_recommendations (crop_name);

-- ---------------------------------------------------------------------------
-- ai_income_forecasts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_income_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin')),
  horizon_years INTEGER NOT NULL CHECK (horizon_years IN (1, 3, 5, 10)),
  forecast_year INTEGER NOT NULL,
  projected_revenue NUMERIC(14,2) NOT NULL,
  baseline_revenue NUMERIC(14,2),
  growth_rate NUMERIC(8,4),
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_income_user ON public.ai_income_forecasts (user_id, horizon_years, created_at DESC);

-- ---------------------------------------------------------------------------
-- ai_market_predictions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_market_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'India',
  demand_score NUMERIC(6,2) NOT NULL CHECK (demand_score >= 0 AND demand_score <= 100),
  trend TEXT NOT NULL CHECK (trend IN ('rising', 'stable', 'falling')),
  price_min NUMERIC(12,2),
  price_max NUMERIC(12,2),
  demand_confidence NUMERIC(5,4) NOT NULL CHECK (demand_confidence >= 0 AND demand_confidence <= 1),
  prediction_month DATE NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_market_crop ON public.ai_market_predictions (crop_name, prediction_month DESC);
CREATE INDEX IF NOT EXISTS idx_ai_market_region ON public.ai_market_predictions (region, prediction_month DESC);

-- ---------------------------------------------------------------------------
-- ai_user_insights
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin')),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  crop_name TEXT,
  confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  is_read BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  model_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON public.ai_user_insights (user_id, is_read, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_crop_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_income_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_market_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_crop_rec_select ON public.ai_crop_recommendations;
CREATE POLICY ai_crop_rec_select ON public.ai_crop_recommendations
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS ai_income_select ON public.ai_income_forecasts;
CREATE POLICY ai_income_select ON public.ai_income_forecasts
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS ai_market_select ON public.ai_market_predictions;
CREATE POLICY ai_market_select ON public.ai_market_predictions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ai_insights_select ON public.ai_user_insights;
CREATE POLICY ai_insights_select ON public.ai_user_insights
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS ai_insights_update ON public.ai_user_insights;
CREATE POLICY ai_insights_update ON public.ai_user_insights
  FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- Service role / backend inserts via service key (bypasses RLS) or add insert policies for authenticated if needed.
-- AI service uses SUPABASE_SERVICE_ROLE_KEY for writes.

COMMENT ON TABLE public.ai_crop_recommendations IS 'Phase B: ML crop recommendations per user';
COMMENT ON TABLE public.ai_income_forecasts IS 'Phase B: Revenue projections 1/3/5/10 year horizons';
COMMENT ON TABLE public.ai_market_predictions IS 'Phase B: Crop demand and price forecasts';
COMMENT ON TABLE public.ai_user_insights IS 'Phase B: Actionable AI insight feed per user';
