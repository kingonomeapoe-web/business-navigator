import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Compass, FileText, MessageSquareText, Sparkles, Star } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { PILLARS } from "@/lib/diagnostic-content";
import { CONTENT_FALLBACKS, contentValue } from "@/lib/content-defaults";
import { getPublicContent, type PublicContent } from "@/lib/content.functions";

export const Route = createFileRoute("/")({
  loader: async (): Promise<PublicContent> => {
    try {
      return await getPublicContent();
    } catch {
      return { values: {}, faqs: [], testimonials: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Satphonix Business Builder — What should your website do for your business?" },
      {
        name: "description",
        content:
          "Tell us about your business and Satphonix will show you what your website needs to attract customers, generate enquiries and help you grow. Takes 3–5 minutes.",
      },
      { property: "og:title", content: "What should your website do for your business?" },
      {
        property: "og:description",
        content: "A personalised digital business diagnostic from Satphonix. No technical knowledge required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const content = Route.useLoaderData();
  const t = (key: string) => contentValue(content?.values, key);
  const faqs = content?.faqs ?? [];
  const testimonials = [...(content?.testimonials ?? [])].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
          <p className="eyebrow">{t("homepage.hero.eyebrow")}</p>
          <h1 className="display mt-5 max-w-4xl text-[2.6rem] sm:text-6xl lg:text-7xl">{t("homepage.hero.headline")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("homepage.hero.description")}</p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to="/build"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              {t("homepage.hero.primary_cta_label")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-muted-foreground">{t("homepage.hero.trust_statement")}</p>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.key} className="bg-card p-7">
                <p className="eyebrow text-accent">{pillar.name}</p>
                <p className="mt-3 text-[17px] leading-snug">{pillar.promise}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {contentValue(content?.values, `homepage.pillar.${pillar.key}.description`, pillar.detail)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <h2 className="display max-w-2xl text-3xl sm:text-4xl">{t("homepage.value.heading")}</h2>
            <p className="mt-5 max-w-2xl text-muted-foreground">{t("homepage.value.description")}</p>
            <Link
              to="/build"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("homepage.hero.secondary_cta_label")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="eyebrow">{t("homepage.how_it_works.heading")}</p>
          {t("homepage.how_it_works.description") && (
            <p className="mt-3 max-w-2xl text-muted-foreground">{t("homepage.how_it_works.description")}</p>
          )}
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageSquareText, title: "Describe your business", body: "In your own words. No jargon, no forms full of technical questions." },
              { icon: Compass, title: "Answer a short interview", body: "We ask about customers, goals and what happens after someone contacts you." },
              { icon: Sparkles, title: "See your business system", body: "A personalised map of what your business actually needs — and what it doesn't." },
              { icon: FileText, title: "See a real price", body: "An understandable investment in your currency, with nothing hidden." },
            ].map((step, index) => (
              <div key={step.title}>
                <step.icon className="h-5 w-5 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">0{index + 1}</p>
                <h3 className="mt-1 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {testimonials.length > 0 && (
          <section className="border-t border-border bg-secondary/40">
            <div className="mx-auto w-full max-w-6xl px-5 py-20">
              <h2 className="display text-3xl">{t("homepage.testimonials.heading")}</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((item) => (
                  <figure key={item.id} className="surface p-6">
                    <div className="flex gap-0.5" aria-label={`${item.rating} out of 5`}>
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <blockquote className="mt-4 text-sm leading-relaxed">“{item.quote}”</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      {item.avatar_url && (
                        <img src={item.avatar_url} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                      )}
                      <span className="text-sm">
                        <span className="block font-medium">{item.client_name}</span>
                        <span className="block text-muted-foreground">
                          {[item.role_title, item.company].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section className="mx-auto w-full max-w-3xl px-5 py-20">
            <h2 className="display text-3xl">{t("homepage.faq.heading")}</h2>
            <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((faq) => (
                <details key={faq.id} className="group p-5">
                  <summary className="cursor-pointer list-none text-[17px] leading-snug">{faq.question}</summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto w-full max-w-6xl px-5 pb-24">
          <div className="surface flex flex-col gap-6 p-9 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="display text-3xl">{t("homepage.final_cta.heading")}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{t("homepage.final_cta.description")}</p>
            </div>
            <Link
              to="/build"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground"
            >
              {t("homepage.final_cta.label") || CONTENT_FALLBACKS["homepage.final_cta.label"]}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
