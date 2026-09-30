CREATE TABLE public.diagnostic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{1,79}$'),
  question text NOT NULL,
  short_label text NOT NULL DEFAULT '',
  help_text text NOT NULL DEFAULT '',
  question_type text NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice','multi_choice','text','textarea','number','yes_no','url')),
  required boolean NOT NULL DEFAULT true,
  placeholder text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  goals text[] NOT NULL DEFAULT '{}',
  internal_notes text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.diagnostic_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.diagnostic_questions TO authenticated;
GRANT ALL ON public.diagnostic_questions TO service_role;
ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published questions are public" ON public.diagnostic_questions FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Admins read questions" ON public.diagnostic_questions FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE POLICY "Admins write questions" ON public.diagnostic_questions FOR ALL TO authenticated USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX diagnostic_questions_status_order_idx ON public.diagnostic_questions (status, display_order);
CREATE TRIGGER diagnostic_questions_set_updated_at BEFORE UPDATE ON public.diagnostic_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.diagnostic_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.diagnostic_questions(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,59}$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  internal_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, key)
);
GRANT SELECT ON public.diagnostic_question_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.diagnostic_question_options TO authenticated;
GRANT ALL ON public.diagnostic_question_options TO service_role;
ALTER TABLE public.diagnostic_question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Options of published questions are public" ON public.diagnostic_question_options FOR SELECT TO anon, authenticated
  USING (active AND EXISTS (SELECT 1 FROM public.diagnostic_questions q WHERE q.id = question_id AND q.status = 'published'));
CREATE POLICY "Admins manage options" ON public.diagnostic_question_options FOR ALL TO authenticated USING (public.is_catalogue_admin(auth.uid())) WITH CHECK (public.is_catalogue_admin(auth.uid()));
CREATE INDEX diagnostic_question_options_q_idx ON public.diagnostic_question_options (question_id, display_order);
CREATE TRIGGER diagnostic_question_options_set_updated_at BEFORE UPDATE ON public.diagnostic_question_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.question_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid,
  question_key text NOT NULL,
  action text NOT NULL,
  field text,
  previous_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.question_change_log TO authenticated;
GRANT ALL ON public.question_change_log TO service_role;
ALTER TABLE public.question_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read question log" ON public.question_change_log FOR SELECT TO authenticated USING (public.is_catalogue_admin(auth.uid()));
CREATE INDEX question_change_log_q_idx ON public.question_change_log (question_id, created_at DESC);

-- Migrate the existing hardcoded diagnostic questions (keys preserved; seeded as draft).
WITH q AS (
  INSERT INTO public.diagnostic_questions (key, question, short_label, help_text, question_type, required, display_order, status) VALUES
  ('geography','Where do your customers come from?','Customer geography','This tells us how much of your visibility work should be local.','single_choice',true,10,'draft'),
  ('acquisition','How do people find you today?','How customers find you','Choose everything that applies.','multi_choice',true,20,'draft'),
  ('conversion','When someone is interested, what should they do next?','Next action','Choose the one or two actions that matter most.','multi_choice',true,30,'draft'),
  ('follow_up','What happens after someone contacts you?','Follow-up process','','single_choice',true,40,'draft'),
  ('problems','Which of these sound familiar?','Pain points','Nothing here is unusual. It just tells us where the pressure is.','multi_choice',true,50,'draft')
  RETURNING id, key
)
INSERT INTO public.diagnostic_question_options (question_id, key, label, display_order)
SELECT q.id, o.key, o.label, o.ord FROM q JOIN (VALUES
  ('geography','local','Mostly my own town or city',10),('geography','regional','A wider region around me',20),('geography','national','The whole country',30),('geography','international','Anywhere in the world',40),
  ('acquisition','google','Google',10),('acquisition','social','Social media',20),('acquisition','referrals','Referrals and word of mouth',30),('acquisition','advertising','Advertising',40),('acquisition','whatsapp','WhatsApp',50),('acquisition','walk_ins','Walk-ins',60),('acquisition','existing','Existing customers',70),('acquisition','unsure','Honestly, I''m not sure',80),
  ('conversion','call','Call us',10),('conversion','whatsapp','Message on WhatsApp',20),('conversion','enquiry','Send an enquiry',30),('conversion','book','Book an appointment',40),('conversion','buy','Buy something',50),('conversion','quote','Request a quote',60),('conversion','visit','Visit us in person',70),('conversion','apply','Apply or register',80),
  ('follow_up','manual','I handle it myself',10),('follow_up','team','Someone on my team handles it',20),('follow_up','crm','We use a system to track it',30),('follow_up','missed','We sometimes miss enquiries',40),('follow_up','informal','We don''t really have a process',50),('follow_up','unsure','I''m not sure',60),
  ('problems','miss_enquiries','We miss enquiries when we''re busy',10),('problems','same_questions','Customers ask the same questions again and again',20),('problems','unknown_source','I don''t know where enquiries come from',30),('problems','no_follow_up','We rarely follow up with people who don''t buy',40),('problems','no_content','We don''t create content for Google or social',50),('problems','manual_admin','Too much of my week is admin',60),('problems','none','None of these',70)
) AS o(qkey, key, label, ord) ON o.qkey = q.key;