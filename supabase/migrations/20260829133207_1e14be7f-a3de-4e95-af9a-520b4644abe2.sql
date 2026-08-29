-- 1. super_admin role value (cannot be referenced as a literal in this same migration)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. catalogue-manager helper (text comparison avoids using the new enum label in this tx)
CREATE OR REPLACE FUNCTION public.is_catalogue_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'super_admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_catalogue_admin(uuid) FROM anon;

-- 3. components: lifecycle + internal/client content separation
ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS detailed_explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upsell_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS has_one_time boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_recurring boolean NOT NULL DEFAULT false;

ALTER TABLE public.components
  DROP CONSTRAINT IF EXISTS components_status_check;
ALTER TABLE public.components
  ADD CONSTRAINT components_status_check CHECK (status IN ('draft', 'active', 'archived'));
ALTER TABLE public.components
  DROP CONSTRAINT IF EXISTS components_pillar_check;
ALTER TABLE public.components
  ADD CONSTRAINT components_pillar_check CHECK (pillar IN ('look', 'attract', 'convert', 'run'));
ALTER TABLE public.components
  DROP CONSTRAINT IF EXISTS components_pricing_model_check;
ALTER TABLE public.components
  ADD CONSTRAINT components_pricing_model_check CHECK (pricing_model IN ('fixed', 'from', 'quote'));

UPDATE public.components SET status = CASE WHEN is_active THEN 'active' ELSE 'archived' END;

CREATE OR REPLACE FUNCTION public.sync_component_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS components_sync_active ON public.components;
CREATE TRIGGER components_sync_active
  BEFORE INSERT OR UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.sync_component_active();

-- 4. markets
CREATE TABLE IF NOT EXISTS public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  currency_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.markets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.markets TO authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Markets are publicly readable" ON public.markets;
CREATE POLICY "Markets are publicly readable" ON public.markets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage markets" ON public.markets;
CREATE POLICY "Admins manage markets" ON public.markets FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
DROP TRIGGER IF EXISTS markets_set_updated_at ON public.markets;
CREATE TRIGGER markets_set_updated_at BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.markets (name, code, currency_code, display_order) VALUES
  ('United States / International', 'US', 'USD', 1),
  ('United Kingdom', 'UK', 'GBP', 2),
  ('Nigeria', 'NG', 'NGN', 3),
  ('Eurozone', 'EU', 'EUR', 4)
ON CONFLICT (code) DO NOTHING;

-- 5. component_prices: market link + active flag + validation
ALTER TABLE public.component_prices
  ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES public.markets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.component_prices p
  SET market_id = m.id
  FROM public.markets m
  WHERE m.currency_code = p.currency AND p.market_id IS NULL;

ALTER TABLE public.component_prices
  DROP CONSTRAINT IF EXISTS component_prices_non_negative;
ALTER TABLE public.component_prices
  ADD CONSTRAINT component_prices_non_negative
  CHECK (one_time >= 0 AND setup_fee >= 0 AND recurring_monthly >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS component_prices_active_unique
  ON public.component_prices (component_id, currency) WHERE active;

DROP TRIGGER IF EXISTS component_prices_set_updated_at ON public.component_prices;
CREATE TRIGGER component_prices_set_updated_at BEFORE UPDATE ON public.component_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. component dependencies
CREATE TABLE IF NOT EXISTS public.component_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  related_component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('requires', 'conflicts', 'related')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT component_dependencies_not_self CHECK (component_id <> related_component_id),
  UNIQUE (component_id, related_component_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_dependencies TO authenticated;
GRANT ALL ON public.component_dependencies TO service_role;
ALTER TABLE public.component_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage component dependencies" ON public.component_dependencies;
CREATE POLICY "Admins manage component dependencies" ON public.component_dependencies FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));

-- 7. industries
CREATE TABLE IF NOT EXISTS public.industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.industries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.industries TO authenticated;
GRANT ALL ON public.industries TO service_role;
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Industries are publicly readable" ON public.industries;
CREATE POLICY "Industries are publicly readable" ON public.industries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage industries" ON public.industries;
CREATE POLICY "Admins manage industries" ON public.industries FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.component_industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  industry_id uuid NOT NULL REFERENCES public.industries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (component_id, industry_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_industries TO authenticated;
GRANT ALL ON public.component_industries TO service_role;
ALTER TABLE public.component_industries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage component industries" ON public.component_industries;
CREATE POLICY "Admins manage component industries" ON public.component_industries FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));

-- import existing industry tags as relationships
INSERT INTO public.industries (name, slug)
SELECT DISTINCT initcap(replace(tag, '-', ' ')), tag
FROM public.components c, unnest(c.industry_tags) AS tag
WHERE tag <> ''
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.component_industries (component_id, industry_id)
SELECT c.id, i.id
FROM public.components c
JOIN LATERAL unnest(c.industry_tags) AS tag ON true
JOIN public.industries i ON i.slug = tag
ON CONFLICT DO NOTHING;

-- 8. pricing change log
CREATE TABLE IF NOT EXISTS public.pricing_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  currency text NOT NULL,
  field text NOT NULL,
  previous_value numeric,
  new_value numeric,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_change_log TO authenticated;
GRANT ALL ON public.pricing_change_log TO service_role;
ALTER TABLE public.pricing_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read pricing change log" ON public.pricing_change_log;
CREATE POLICY "Admins read pricing change log" ON public.pricing_change_log FOR SELECT TO authenticated
  USING (public.is_catalogue_admin(auth.uid()));

-- 9. admin write access to the catalogue itself
DROP POLICY IF EXISTS "Admins manage components" ON public.components;
CREATE POLICY "Admins manage components" ON public.components FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components TO authenticated;

DROP POLICY IF EXISTS "Admins manage component prices" ON public.component_prices;
CREATE POLICY "Admins manage component prices" ON public.component_prices FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_prices TO authenticated;

-- 10. indexes
CREATE INDEX IF NOT EXISTS components_slug_idx ON public.components (slug);
CREATE INDEX IF NOT EXISTS components_pillar_idx ON public.components (pillar);
CREATE INDEX IF NOT EXISTS components_status_idx ON public.components (status);
CREATE INDEX IF NOT EXISTS component_prices_component_idx ON public.component_prices (component_id);
CREATE INDEX IF NOT EXISTS component_prices_market_idx ON public.component_prices (market_id);
CREATE INDEX IF NOT EXISTS component_prices_component_market_idx ON public.component_prices (component_id, market_id);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS pricing_change_log_component_idx ON public.pricing_change_log (component_id, created_at DESC);
CREATE INDEX IF NOT EXISTS component_dependencies_component_idx ON public.component_dependencies (component_id);
CREATE INDEX IF NOT EXISTS component_industries_component_idx ON public.component_industries (component_id);