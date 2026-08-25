CREATE TABLE public.components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('look','attract','convert','run')),
  short_description TEXT NOT NULL DEFAULT '',
  client_explanation TEXT NOT NULL DEFAULT '',
  recommendation_reason TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'sparkles',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_core BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 100,
  priority INTEGER NOT NULL DEFAULT 50,
  industry_tags TEXT[] NOT NULL DEFAULT '{}',
  depends_on TEXT[] NOT NULL DEFAULT '{}',
  conflicts_with TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.component_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  one_time NUMERIC(12,2) NOT NULL DEFAULT 0,
  setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  recurring_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (component_id, currency)
);

CREATE TABLE public.diagnostic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  first_name TEXT,
  business_name TEXT,
  business_description TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  service_area TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals TEXT[] NOT NULL DEFAULT '{}',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_components TEXT[] NOT NULL DEFAULT '{}',
  step TEXT NOT NULL DEFAULT 'first_name',
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  one_time_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  recurring_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.components TO anon, authenticated;
GRANT SELECT ON public.component_prices TO anon, authenticated;
GRANT ALL ON public.components TO service_role;
GRANT ALL ON public.component_prices TO service_role;
GRANT ALL ON public.diagnostic_sessions TO service_role;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active components" ON public.components
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Anyone can view component prices" ON public.component_prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER components_updated_at BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.diagnostic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.components (slug, name, pillar, short_description, client_explanation, recommendation_reason, icon, is_core, display_order, priority, industry_tags) VALUES
('business-website','Business Website','look','A professional, mobile-friendly website for your business.','The home of your business online — clear, fast and built to work perfectly on a phone.','Every business needs a credible place customers can be sent to.','globe',true,10,100,'{}'),
('premium-design','Premium Design','look','Higher-end visual design and custom layouts.','A more distinctive look, designed around your brand rather than a template.','Businesses selling trust or higher-value services benefit from a premium impression.','gem',false,20,60,'{legal,finance,real-estate,consulting,hospitality,beauty}'),
('domain','Domain','look','Your business web address.','We register and configure the web address people type to find you.','You need an address people can reach you at.','link',true,30,90,'{}'),
('hosting','Hosting','look','Keep your website online.','Fast, secure hosting so your website is always available.','Your website has to live somewhere reliable.','server',true,40,90,'{}'),
('security','Security','look','SSL and protection.','The padlock in the browser plus protection against common attacks.','Visitors and Google both expect a secure site.','shield',true,50,85,'{}'),
('analytics','Analytics','look','See what''s working.','Simple reporting on who visits, what they look at and what they do next.','You told us you want to grow — you need to see what is working.','activity',false,60,70,'{}'),
('seo-foundation','SEO Foundation','attract','Help Google understand your business.','The groundwork that lets search engines read, understand and rank your pages.','Being found on Google starts here.','search',false,70,85,'{}'),
('local-search','Local Search','attract','Be found by people nearby.','Optimisation so people searching in your area find you first.','You serve customers in a specific area, so local searches matter most.','map-pin',false,80,80,'{restaurants,trades,beauty,healthcare,legal,retail,construction,real-estate}'),
('service-pages','Service Pages','attract','A page for each thing you do.','Dedicated pages for your main services so each one can be found on its own.','People search for specific services, not for businesses.','layers',false,90,75,'{}'),
('location-pages','Location Pages','attract','A page for each area you serve.','Pages targeting the towns and areas you want customers from.','You serve more than one area, so each deserves its own page.','map',false,100,60,'{trades,construction,legal,healthcare,real-estate}'),
('content-engine','Content Engine','attract','Ongoing content that earns attention.','We turn your expertise into articles and posts that bring in search traffic month after month.','Search growth compounds when you publish consistently.','pen-line',false,110,55,'{}'),
('search-growth-engine','Search Growth Engine','attract','A complete system for growing Google traffic.','Keyword research, targeted pages, content and ongoing optimisation working together.','You told us getting found on Google is a priority.','trending-up',false,120,70,'{}'),
('programmatic-seo','Search Growth Pages','attract','Structured pages for high-value searches.','Large sets of targeted pages built where there is real demand for them.','Only recommended when your services and locations create genuine search demand.','grid-3x3',false,130,30,'{real-estate,trades,legal,education,e-commerce}'),
('social-content-engine','Social Content Engine','attract','Turn one idea into many posts.','Your knowledge repurposed into posts for the platforms your customers use.','Content you already create can work far harder.','share-2',false,140,40,'{beauty,restaurants,retail,hospitality,e-commerce,non-profit}'),
('whatsapp','WhatsApp','convert','One-tap WhatsApp enquiries.','Visitors message you directly from any page, with the context already filled in.','You told us people reach you on WhatsApp.','message-circle',false,150,80,'{}'),
('lead-capture','Never Lose an Enquiry','convert','Structured capture of every enquiry.','Every enquiry is captured and organised instead of disappearing into an inbox.','You told us generating enquiries matters — they need somewhere safe to land.','inbox',false,160,85,'{}'),
('booking','Booking','convert','Online appointments and scheduling.','Customers book a time that suits them without phoning you.','Consultations and appointments convert far better when they can be booked instantly.','calendar-check',false,170,70,'{healthcare,beauty,legal,consulting,education,restaurants}'),
('ecommerce','Online Shop','convert','Products, cart and checkout.','Sell your products online with a proper shop experience.','You told us you want to sell products.','shopping-bag',false,180,65,'{retail,e-commerce,restaurants}'),
('payments','Payments','convert','Take payment online.','Customers pay you securely from your website.','You told us you want to receive payments.','credit-card',false,190,65,'{}'),
('ai-assistant','AI Business Assistant','convert','Answer questions around the clock.','An assistant trained only on information you approve, answering visitors day and night.','Customers repeatedly ask the same questions — this answers them instantly.','bot',false,200,45,'{}'),
('lead-qualification','Lead Qualification','convert','Know who is worth calling back.','Collect the important details before you spend time on a conversation.','High-value enquiries deserve to be sorted before you follow up.','filter',false,210,50,'{legal,finance,real-estate,construction,consulting}'),
('crm','Manage Your Enquiries','run','Every customer and lead in one place.','A single organised view of everyone who has contacted your business.','You told us enquiries are handled manually — this stops things slipping.','users',false,220,70,'{}'),
('notifications','Notifications','run','Know the moment someone enquires.','Instant alerts by email or message when something needs your attention.','Speed of reply is the single biggest factor in winning an enquiry.','bell',false,230,60,'{}'),
('follow-up-automation','Automatic Follow-up','run','Let your website handle routine follow-up.','Polite, automatic follow-up for people who enquire but do not respond.','You told us follow-up does not always happen.','repeat',false,240,55,'{}'),
('analytics-dashboard','Business Dashboard','run','Your numbers in one view.','Enquiries, sources and performance reported in plain language.','You want to know where results actually come from.','bar-chart-3',false,250,50,'{}'),
('customer-database','Customer Database','run','Structured customer records.','A proper record of your customers, searchable and secure.','Your customer list is one of your most valuable assets.','database',false,260,45,'{}'),
('admin-dashboard','Manage Your Website','run','Update your own content.','Change text, images and pages yourself, without needing a developer.','You will want to keep things current without waiting on anyone.','settings',false,270,50,'{}');

INSERT INTO public.component_prices (component_id, currency, one_time, recurring_monthly)
SELECT c.id, p.currency, round(base.one_time * p.mult), round(base.recurring * p.mult)
FROM public.components c
JOIN (VALUES
  ('business-website',1000,0),('premium-design',600,0),('domain',40,0),('hosting',0,20),
  ('security',80,10),('analytics',120,0),('seo-foundation',400,0),('local-search',300,0),
  ('service-pages',350,0),('location-pages',400,0),('content-engine',0,250),
  ('search-growth-engine',450,350),('programmatic-seo',1200,150),('social-content-engine',0,200),
  ('whatsapp',120,0),('lead-capture',300,0),('booking',400,0),('ecommerce',900,0),
  ('payments',350,0),('ai-assistant',700,60),('lead-qualification',250,0),('crm',600,0),
  ('notifications',150,0),('follow-up-automation',450,25),('analytics-dashboard',400,0),
  ('customer-database',300,0),('admin-dashboard',500,0)
) AS base(slug, one_time, recurring) ON base.slug = c.slug
CROSS JOIN (VALUES ('USD',1.0),('GBP',0.8),('EUR',0.95),('NGN',1600.0)) AS p(currency, mult);