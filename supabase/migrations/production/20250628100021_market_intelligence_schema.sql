-- PRODUCTION Phase 2 — Market Intelligence schema (additive, isolated from commerce)
-- Does NOT modify existing commerce, wallet, royalty, or AI commerce tables.

-- ---------------------------------------------------------------------------
-- Reference masters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.state_master (
  id SERIAL PRIMARY KEY,
  state_code VARCHAR(4) NOT NULL UNIQUE,
  state_name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  is_union_territory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.district_master (
  id SERIAL PRIMARY KEY,
  district_code VARCHAR(8) NOT NULL UNIQUE,
  district_name TEXT NOT NULL,
  state_id INTEGER NOT NULL REFERENCES public.state_master(id),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_name, state_id)
);

CREATE TABLE IF NOT EXISTS public.crop_master (
  id SERIAL PRIMARY KEY,
  crop_code VARCHAR(16) NOT NULL UNIQUE,
  crop_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'kg',
  season TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_master (
  id SERIAL PRIMARY KEY,
  market_code VARCHAR(16) NOT NULL UNIQUE,
  market_name TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'mandi',
  district_id INTEGER NOT NULL REFERENCES public.district_master(id),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  source TEXT NOT NULL DEFAULT 'AGMARKNET',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Live & historical prices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_prices (
  id BIGSERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES public.market_master(id),
  crop_id INTEGER NOT NULL REFERENCES public.crop_master(id),
  price_date DATE NOT NULL,
  min_price NUMERIC(12,2) NOT NULL,
  max_price NUMERIC(12,2) NOT NULL,
  modal_price NUMERIC(12,2) NOT NULL,
  arrival_quantity NUMERIC(14,2),
  source TEXT NOT NULL DEFAULT 'AGMARKNET',
  agroelevate_avg_price NUMERIC(12,2),
  district_demand_score NUMERIC(5,2),
  market_volatility NUMERIC(6,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, crop_id, price_date, source)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_date ON public.market_prices (price_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON public.market_prices (crop_id, price_date DESC);

CREATE TABLE IF NOT EXISTS public.market_price_history (
  id BIGSERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES public.market_master(id),
  crop_id INTEGER NOT NULL REFERENCES public.crop_master(id),
  price_date DATE NOT NULL,
  min_price NUMERIC(12,2) NOT NULL,
  max_price NUMERIC(12,2) NOT NULL,
  modal_price NUMERIC(12,2) NOT NULL,
  arrival_quantity NUMERIC(14,2),
  source TEXT NOT NULL DEFAULT 'AGMARKNET',
  weekly_trend NUMERIC(8,4),
  monthly_trend NUMERIC(8,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_history_date ON public.market_price_history (price_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_history_crop ON public.market_price_history (crop_id, price_date DESC);

-- ---------------------------------------------------------------------------
-- MSP, predictions, weather, cache, sync
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msp_data (
  id SERIAL PRIMARY KEY,
  crop_id INTEGER NOT NULL REFERENCES public.crop_master(id),
  marketing_year TEXT NOT NULL,
  msp_price NUMERIC(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'Government of India',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crop_id, marketing_year)
);

CREATE TABLE IF NOT EXISTS public.market_prediction (
  id BIGSERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES public.market_master(id),
  crop_id INTEGER NOT NULL REFERENCES public.crop_master(id),
  district_id INTEGER REFERENCES public.district_master(id),
  prediction_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL DEFAULT 7,
  predicted_price NUMERIC(12,2) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  demand_score NUMERIC(5,2),
  supply_score NUMERIC(5,2),
  model_version TEXT NOT NULL DEFAULT 'mi-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weather_market (
  id BIGSERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES public.district_master(id),
  weather_date DATE NOT NULL,
  temperature_c NUMERIC(5,2),
  precipitation_mm NUMERIC(8,2),
  humidity_pct NUMERIC(5,2),
  impact_score NUMERIC(5,2),
  farming_note TEXT,
  source TEXT NOT NULL DEFAULT 'IMD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, weather_date)
);

CREATE TABLE IF NOT EXISTS public.market_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  dataset_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_sync_log (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'scheduled',
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  dataset_version TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS: read-only for authenticated users, write for service role only
ALTER TABLE public.state_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msp_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prediction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_market ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_sync_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY market_intel_read_states ON public.state_master FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_districts ON public.district_master FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_crops ON public.crop_master FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_markets ON public.market_master FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_prices ON public.market_prices FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_history ON public.market_price_history FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_msp ON public.msp_data FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_predictions ON public.market_prediction FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY market_intel_read_weather ON public.weather_market FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
