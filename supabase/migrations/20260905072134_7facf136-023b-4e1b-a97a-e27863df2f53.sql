-- content status enum
DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM ('draft','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_value_type AS ENUM ('text','textarea','markdown','url','boolean');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================ content_blocks
CREATE TABLE public.content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  "group" text NOT NULL DEFAULT 'general',
  content text NOT NULL DEFAULT '',
  draft_content text,
  content_type public.content_value_type NOT NULL DEFAULT 'text',
  status public.content_status NOT NULL DEFAULT 'draft',
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_blocks_key_unique UNIQUE (key),
  CONSTRAINT content_blocks_key_format CHECK (key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$')
);
GRANT SELECT ON public.content_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_blocks TO authenticated;
GRANT ALL ON public.content_blocks TO service_role;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published blocks are public" ON public.content_blocks FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all blocks" ON public.content_blocks FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write blocks" ON public.content_blocks FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX content_blocks_group_order_idx ON public.content_blocks ("group", display_order);
CREATE INDEX content_blocks_status_idx ON public.content_blocks (status);
CREATE TRIGGER content_blocks_set_updated_at BEFORE UPDATE ON public.content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ faqs
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  display_order integer NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published faqs are public" ON public.faqs FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all faqs" ON public.faqs FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write faqs" ON public.faqs FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX faqs_category_order_idx ON public.faqs (category, display_order);
CREATE TRIGGER faqs_set_updated_at BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ testimonials
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  company text NOT NULL DEFAULT '',
  role_title text NOT NULL DEFAULT '',
  quote text NOT NULL,
  avatar_url text,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  display_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published testimonials are public" ON public.testimonials FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all testimonials" ON public.testimonials FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write testimonials" ON public.testimonials FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX testimonials_order_idx ON public.testimonials (display_order);
CREATE TRIGGER testimonials_set_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ seo_pages
CREATE TABLE public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  og_title text NOT NULL DEFAULT '',
  og_description text NOT NULL DEFAULT '',
  canonical_url text,
  no_index boolean NOT NULL DEFAULT false,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_pages_route_unique UNIQUE (route)
);
GRANT SELECT ON public.seo_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_pages TO authenticated;
GRANT ALL ON public.seo_pages TO service_role;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published seo pages are public" ON public.seo_pages FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all seo pages" ON public.seo_pages FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write seo pages" ON public.seo_pages FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE TRIGGER seo_pages_set_updated_at BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ legal_documents
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status public.content_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_documents_slug_unique UNIQUE (slug)
);
GRANT SELECT ON public.legal_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published legal docs are public" ON public.legal_documents FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all legal docs" ON public.legal_documents FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write legal docs" ON public.legal_documents FOR ALL TO authenticated
  USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE TRIGGER legal_documents_set_updated_at BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ content_change_log
CREATE TABLE public.content_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  label text NOT NULL DEFAULT '',
  field text NOT NULL,
  previous_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_change_log TO authenticated;
GRANT ALL ON public.content_change_log TO service_role;
ALTER TABLE public.content_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read content log" ON public.content_change_log FOR SELECT TO authenticated
  USING (public.is_catalogue_admin(auth.uid()));
CREATE INDEX content_change_log_created_idx ON public.content_change_log (created_at DESC);
CREATE INDEX content_change_log_entity_idx ON public.content_change_log (entity, entity_id);