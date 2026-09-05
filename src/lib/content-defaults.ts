/**
 * The application's own copy. These values are the safe fallback used whenever a
 * CMS record is missing, unpublished, or the backend cannot be reached — a missing
 * content record must never break a public page.
 *
 * The same values seed the CMS so administrators start from the live wording.
 */
export type ContentValueType = "text" | "textarea" | "markdown" | "url" | "boolean";
export type ContentGroup = "site" | "funnel" | "seo" | "general";

export type ContentDefault = {
  key: string;
  name: string;
  description: string;
  group: ContentGroup;
  content_type: ContentValueType;
  content: string;
  display_order: number;
};

export const CONTENT_DEFAULTS: ContentDefault[] = [
  /* ------------------------------------------------------------------ site */
  { key: "homepage.hero.eyebrow", name: "Hero eyebrow", description: "Small label above the main headline.", group: "site", content_type: "text", content: "Satphonix Business Development", display_order: 10 },
  { key: "homepage.hero.headline", name: "Hero headline", description: "The first thing a visitor reads.", group: "site", content_type: "text", content: "What should your website do for your business?", display_order: 20 },
  { key: "homepage.hero.description", name: "Hero supporting text", description: "One short paragraph under the headline.", group: "site", content_type: "textarea", content: "Tell us about your business. We'll show you what your website needs to attract customers, generate enquiries and help you grow.", display_order: 30 },
  { key: "homepage.hero.primary_cta_label", name: "Primary button label", description: "Main call to action in the hero.", group: "site", content_type: "text", content: "Build my website", display_order: 40 },
  { key: "homepage.hero.primary_cta_href", name: "Primary button destination", description: "Where the main button goes, e.g. /build.", group: "site", content_type: "text", content: "/build", display_order: 50 },
  { key: "homepage.hero.secondary_cta_label", name: "Secondary button label", description: "Optional second call to action.", group: "site", content_type: "text", content: "Show me what mine could do", display_order: 60 },
  { key: "homepage.hero.secondary_cta_href", name: "Secondary button destination", description: "Where the second button goes.", group: "site", content_type: "text", content: "/build", display_order: 70 },
  { key: "homepage.hero.trust_statement", name: "Trust statement", description: "Reassurance line beside the main button.", group: "site", content_type: "text", content: "No technical knowledge required · Takes about 3–5 minutes", display_order: 80 },
  { key: "homepage.value.heading", name: "Value section heading", description: "Heading of the section below the hero.", group: "site", content_type: "text", content: "Most websites look fine. Far fewer actually do anything.", display_order: 90 },
  { key: "homepage.value.description", name: "Value section text", description: "Paragraph explaining the difference.", group: "site", content_type: "textarea", content: "Two businesses can have websites that look identical. One simply tells people who you are. The other becomes part of how your business attracts, converts and serves customers. The difference is never visible from the outside.", display_order: 100 },
  { key: "homepage.how_it_works.heading", name: "How it works heading", description: "Label above the four steps.", group: "site", content_type: "text", content: "How it works", display_order: 110 },
  { key: "homepage.how_it_works.description", name: "How it works supporting text", description: "Optional sentence under the heading.", group: "site", content_type: "textarea", content: "", display_order: 120 },
  { key: "homepage.pillar.look.heading", name: "LOOK heading", description: "Heading for the LOOK pillar card.", group: "site", content_type: "text", content: "Look", display_order: 130 },
  { key: "homepage.pillar.look.description", name: "LOOK description", description: "Short explanation of the LOOK pillar.", group: "site", content_type: "textarea", content: "", display_order: 140 },
  { key: "homepage.pillar.attract.heading", name: "ATTRACT heading", description: "Heading for the ATTRACT pillar card.", group: "site", content_type: "text", content: "Attract", display_order: 150 },
  { key: "homepage.pillar.attract.description", name: "ATTRACT description", description: "Short explanation of the ATTRACT pillar.", group: "site", content_type: "textarea", content: "", display_order: 160 },
  { key: "homepage.pillar.convert.heading", name: "CONVERT heading", description: "Heading for the CONVERT pillar card.", group: "site", content_type: "text", content: "Convert", display_order: 170 },
  { key: "homepage.pillar.convert.description", name: "CONVERT description", description: "Short explanation of the CONVERT pillar.", group: "site", content_type: "textarea", content: "", display_order: 180 },
  { key: "homepage.pillar.run.heading", name: "RUN heading", description: "Heading for the RUN pillar card.", group: "site", content_type: "text", content: "Run", display_order: 190 },
  { key: "homepage.pillar.run.description", name: "RUN description", description: "Short explanation of the RUN pillar.", group: "site", content_type: "textarea", content: "", display_order: 200 },
  { key: "homepage.final_cta.heading", name: "Final call-to-action heading", description: "Closing invitation at the bottom of the page.", group: "site", content_type: "text", content: "Let's see what your business could become.", display_order: 210 },
  { key: "homepage.final_cta.description", name: "Final call-to-action text", description: "Supporting sentence for the closing section.", group: "site", content_type: "textarea", content: "A professional consultation, not a sales funnel. Leave whenever you like — your answers are saved.", display_order: 220 },
  { key: "homepage.final_cta.label", name: "Final call-to-action button", description: "Button label in the closing section.", group: "site", content_type: "text", content: "Start", display_order: 230 },
  { key: "homepage.faq.heading", name: "FAQ section heading", description: "Heading above the published questions.", group: "site", content_type: "text", content: "Common questions", display_order: 240 },
  { key: "homepage.testimonials.heading", name: "Testimonials heading", description: "Heading above published testimonials.", group: "site", content_type: "text", content: "What clients say", display_order: 250 },

  /* ---------------------------------------------------------------- funnel */
  { key: "diagnostic.intro.eyebrow", name: "Diagnostic introduction label", description: "Small label at the start of the diagnostic.", group: "funnel", content_type: "text", content: "Step one", display_order: 10 },
  { key: "diagnostic.intro.heading", name: "Diagnostic heading", description: "First question heading in the diagnostic.", group: "funnel", content_type: "text", content: "Let's start with you. What should we call you?", display_order: 20 },
  { key: "diagnostic.intro.description", name: "Diagnostic supporting copy", description: "Reassuring sentence at the start.", group: "funnel", content_type: "textarea", content: "A professional consultation, not a form. Your answers are saved as you go.", display_order: 30 },
  { key: "diagnostic.progress.text", name: "Progress text", description: "Wording shown alongside the progress indicator.", group: "funnel", content_type: "text", content: "Your consultation", display_order: 40 },
  { key: "diagnostic.completion.message", name: "Completion message", description: "Shown when the interview is finished.", group: "funnel", content_type: "textarea", content: "That's everything we need. Building your plan now.", display_order: 50 },
  { key: "results.intro.heading", name: "Results introduction", description: "Heading of the results screen.", group: "funnel", content_type: "text", content: "Your business system", display_order: 60 },
  { key: "results.explanation", name: "Results explanation", description: "Explains how the recommendations were produced.", group: "funnel", content_type: "textarea", content: "Based on what you told us, here is what your website needs to do — and what it doesn't.", display_order: 70 },
  { key: "results.recommendation.intro", name: "Recommendation introduction", description: "Sentence above the recommended capabilities.", group: "funnel", content_type: "textarea", content: "Each capability below was chosen for a specific reason in your business.", display_order: 80 },
  { key: "quote.intro", name: "Quote introduction", description: "Sentence above the priced plan.", group: "funnel", content_type: "textarea", content: "Here is your investment, in your currency, with nothing hidden.", display_order: 90 },
  { key: "quote.cta_label", name: "Quote button label", description: "Button that accepts the plan.", group: "funnel", content_type: "text", content: "Accept this plan", display_order: 100 },
  { key: "payment.cta_label", name: "Payment button label", description: "Button that starts payment.", group: "funnel", content_type: "text", content: "Pay and start my build", display_order: 110 },
  { key: "onboarding.cta_label", name: "Onboarding button label", description: "Button that opens the client portal.", group: "funnel", content_type: "text", content: "Start onboarding", display_order: 120 },

  /* ------------------------------------------------------------------- seo */
  { key: "seo.site_title", name: "Site title", description: "Default browser tab title.", group: "seo", content_type: "text", content: "Satphonix Business Builder", display_order: 10 },
  { key: "seo.default_description", name: "Default description", description: "Used when a page has no description of its own.", group: "seo", content_type: "textarea", content: "Tell us about your business and Satphonix will show you what your website needs to attract customers, generate enquiries and help you grow.", display_order: 20 },
  { key: "seo.default_og_title", name: "Default share title", description: "Title used when a page is shared on social media.", group: "seo", content_type: "text", content: "What should your website do for your business?", display_order: 30 },
  { key: "seo.default_og_description", name: "Default share description", description: "Description used when a page is shared.", group: "seo", content_type: "textarea", content: "A personalised digital business diagnostic from Satphonix. No technical knowledge required.", display_order: 40 },
  { key: "seo.twitter_title", name: "Twitter title", description: "Title used on Twitter/X cards.", group: "seo", content_type: "text", content: "What should your website do for your business?", display_order: 50 },
  { key: "seo.twitter_description", name: "Twitter description", description: "Description used on Twitter/X cards.", group: "seo", content_type: "textarea", content: "A personalised digital business diagnostic from Satphonix.", display_order: 60 },
  { key: "seo.homepage_keywords", name: "Homepage keywords", description: "Comma-separated keywords for the homepage.", group: "seo", content_type: "text", content: "website design, business website, digital diagnostic, Satphonix", display_order: 70 },
  { key: "seo.organization_description", name: "Organisation description", description: "How Satphonix is described in search results.", group: "seo", content_type: "textarea", content: "Satphonix Business Development designs digital systems that help businesses attract, convert and serve customers.", display_order: 80 },
];

export const CONTENT_FALLBACKS: Record<string, string> = Object.fromEntries(
  CONTENT_DEFAULTS.map((d) => [d.key, d.content]),
);

/** Read a published value with a guaranteed safe fallback to the app's own copy. */
export function contentValue(published: Record<string, string> | undefined | null, key: string, fallback?: string): string {
  const value = published?.[key];
  if (typeof value === "string" && value.trim() !== "") return value;
  return fallback ?? CONTENT_FALLBACKS[key] ?? "";
}
