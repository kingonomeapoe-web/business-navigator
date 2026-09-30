CREATE TABLE public.recommendation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN -1000 AND 1000),
  conditions jsonb NOT NULL DEFAULT '{"kind":"group","mode":"all","children":[]}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 0,
  internal_notes text NOT NULL DEFAULT '',
  created_by uuid, updated_by uuid,
  activated_at timestamptz, activated_by uuid,
  archived_at timestamptz, archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_rules TO authenticated;
GRANT ALL ON public.recommendation_rules TO service_role;
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rules" ON public.recommendation_rules FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX recommendation_rules_status_priority_idx ON public.recommendation_rules (status, priority DESC, key);
CREATE TRIGGER recommendation_rules_set_updated_at BEFORE UPDATE ON public.recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.recommendation_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.recommendation_rules(id) ON DELETE CASCADE,
  version integer NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  priority integer NOT NULL,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  activated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);
GRANT SELECT ON public.recommendation_rule_versions TO authenticated;
GRANT ALL ON public.recommendation_rule_versions TO service_role;
ALTER TABLE public.recommendation_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read rule versions" ON public.recommendation_rule_versions FOR SELECT TO authenticated
  USING (public.is_catalogue_admin(auth.uid()));

CREATE TABLE public.rule_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  rule_key text NOT NULL,
  action text NOT NULL,
  detail text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rule_change_log TO authenticated;
GRANT ALL ON public.rule_change_log TO service_role;
ALTER TABLE public.rule_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read rule log" ON public.rule_change_log FOR SELECT TO authenticated
  USING (public.is_catalogue_admin(auth.uid()));
CREATE INDEX rule_change_log_rule_idx ON public.rule_change_log (rule_id, created_at DESC);

ALTER TABLE public.diagnostic_sessions ADD COLUMN IF NOT EXISTS recommendation_trace jsonb;
COMMENT ON COLUMN public.diagnostic_sessions.recommendation_trace IS 'Structured recommendation result (decisions, sources, rule ids/versions) at last evaluation.';