/**
 * Deterministic recommendation engine.
 * AI never decides what a client is sold or what it costs — these rules do.
 */

export type DiagnosticProfile = {
  goals: string[];
  answers: Record<string, string[]>;
  classification: {
    industry?: string;
    specialization?: string;
    business_model?: string;
    lead_value?: string;
    services?: string[];
  };
  serviceAreaWide?: boolean;
};

export type Verdict = "recommended" | "optional" | "excluded";

export type Decision = {
  slug: string;
  verdict: Verdict;
  reason: string;
};

const has = (list: string[] | undefined, value: string) => (list ?? []).includes(value);

export function decide(profile: DiagnosticProfile): Decision[] {
  const goals = profile.goals ?? [];
  const a = profile.answers ?? {};
  const geography = a["geography"]?.[0] ?? "local";
  const acquisition = a["acquisition"] ?? [];
  const conversion = a["conversion"] ?? [];
  const followUp = a["follow_up"]?.[0] ?? "manual";
  const problems = a["problems"] ?? [];
  const industry = (profile.classification.industry ?? "").toLowerCase();
  const highValue = (profile.classification.lead_value ?? "").toLowerCase() === "high";

  const out: Decision[] = [];
  const add = (slug: string, verdict: Verdict, reason: string) => out.push({ slug, verdict, reason });

  // LOOK — the foundation everyone gets.
  add("business-website", "recommended", "Everything else attaches to this. It is the home of your business online.");
  add("domain", "recommended", "Your own web address, so customers always know they are in the right place.");
  add("hosting", "recommended", "Keeps your website fast and online without you thinking about it.");
  add("security", "recommended", "Visitors and Google both expect a secure, padlocked site.");
  add(
    "premium-design",
    highValue || goals.includes("credibility") ? "recommended" : "optional",
    highValue
      ? "Your customers are making a high-trust decision, so first impressions carry real weight."
      : "A more distinctive look, if you want to stand apart from similar businesses.",
  );
  add(
    "analytics",
    goals.includes("more_customers") || problems.includes("unknown_source") ? "recommended" : "optional",
    problems.includes("unknown_source")
      ? "You told us you don't know where enquiries come from. This answers that."
      : "See which pages and services actually bring you business.",
  );

  // ATTRACT
  const wantsSearch = goals.includes("found_on_google") || acquisition.includes("google") || goals.includes("more_customers");
  add(
    "seo-foundation",
    wantsSearch ? "recommended" : "optional",
    wantsSearch
      ? "Getting found on Google starts with the groundwork that lets search engines understand you."
      : "Worth adding whenever you want search traffic to grow.",
  );
  add(
    "local-search",
    geography === "local" || geography === "regional" ? "recommended" : "optional",
    geography === "local"
      ? "Your customers are nearby, so local searches are where most of your demand sits."
      : "Useful if you later want to be visible in specific towns.",
  );
  add(
    "service-pages",
    wantsSearch || (profile.classification.services ?? []).length > 1 ? "recommended" : "optional",
    "People search for a specific service, not for a business name. Each service deserves its own page.",
  );
  add(
    "location-pages",
    geography === "regional" || geography === "national" ? "recommended" : "optional",
    geography === "national"
      ? "You serve a wide area, so each place you want customers from needs its own page."
      : "Add these when you want to be visible beyond your immediate area.",
  );
  add(
    "search-growth-engine",
    goals.includes("found_on_google") ? "recommended" : "optional",
    goals.includes("found_on_google")
      ? "You told us being found on Google matters most. This is the system that does it."
      : "The complete search programme, when you're ready to grow traffic seriously.",
  );
  add(
    "content-engine",
    problems.includes("no_content") && wantsSearch ? "recommended" : "optional",
    "One idea becomes an article, search content, social posts and an email. Consistency is what compounds.",
  );
  add(
    "social-content-engine",
    acquisition.includes("social") ? "optional" : "optional",
    "Turns the knowledge you already have into posts for the platforms your customers use.",
  );

  // Programmatic search pages — suitability, not a default upsell.
  const programmaticSuitable =
    (geography === "regional" || geography === "national") &&
    (profile.classification.services ?? []).length >= 2 &&
    ["real estate", "legal", "construction", "trades", "education", "e-commerce", "professional services"].some((i) =>
      industry.includes(i),
    );
  add(
    "programmatic-seo",
    programmaticSuitable ? "optional" : "excluded",
    programmaticSuitable
      ? "Your services and locations create enough genuine search demand to justify a larger set of pages."
      : "Not recommended for you right now — there isn't enough distinct search demand to justify it, and thin pages do more harm than good.",
  );

  // CONVERT
  add(
    "whatsapp",
    conversion.includes("whatsapp") || acquisition.includes("whatsapp") ? "recommended" : "optional",
    conversion.includes("whatsapp") || acquisition.includes("whatsapp")
      ? "You told us people reach you on WhatsApp, so it should be one tap from every page."
      : "A one-tap way for people who prefer messaging over forms.",
  );
  const wantsEnquiries = goals.includes("more_enquiries") || conversion.includes("enquiry") || conversion.includes("quote");
  add(
    "lead-capture",
    wantsEnquiries || problems.includes("miss_enquiries") ? "recommended" : "optional",
    problems.includes("miss_enquiries")
      ? "You told us enquiries get missed when you're busy. This makes sure none of them disappear."
      : "Enquiries from your website are collected and organised rather than lost in an inbox.",
  );
  add(
    "booking",
    goals.includes("bookings") || conversion.includes("book") ? "recommended" : "optional",
    goals.includes("bookings") || conversion.includes("book")
      ? "You want appointments, and people book far more readily than they call."
      : "Let customers choose a time without a phone call.",
  );
  add(
    "ecommerce",
    goals.includes("sell_products") || conversion.includes("buy") ? "recommended" : "excluded",
    goals.includes("sell_products") || conversion.includes("buy")
      ? "You told us you want to sell products online."
      : "Not recommended — you aren't selling products directly, so a shop would only add complexity.",
  );
  add(
    "payments",
    goals.includes("payments") || conversion.includes("buy") ? "recommended" : "optional",
    goals.includes("payments")
      ? "You told us you want to be paid online."
      : "Add this whenever you want deposits or invoices paid from the website.",
  );
  add(
    "ai-assistant",
    problems.includes("same_questions") ? "recommended" : "optional",
    problems.includes("same_questions")
      ? "The same questions come up again and again. This answers them instantly, using only information you approve."
      : "Answers common questions at any hour, using only information you approve.",
  );
  add(
    "lead-qualification",
    highValue && wantsEnquiries ? "recommended" : "optional",
    highValue
      ? "Your enquiries are worth real money, so it pays to know who is serious before you call back."
      : "Collect the important details before you spend time on a conversation.",
  );

  // RUN
  const messyFollowUp = followUp === "manual" || followUp === "missed" || followUp === "informal" || followUp === "unsure";
  add(
    "crm",
    messyFollowUp && wantsEnquiries ? "recommended" : "optional",
    messyFollowUp
      ? "Right now enquiries are handled by memory. One organised place stops things slipping."
      : "One place for every customer and lead as you grow.",
  );
  add(
    "notifications",
    wantsEnquiries || problems.includes("miss_enquiries") ? "recommended" : "optional",
    "How fast you reply is the single biggest factor in whether you win the enquiry.",
  );
  add(
    "follow-up-automation",
    problems.includes("no_follow_up") || goals.includes("automate") ? "recommended" : "optional",
    problems.includes("no_follow_up")
      ? "You told us follow-up doesn't always happen. Your website can handle the routine part."
      : "Polite, automatic follow-up for people who go quiet.",
  );
  add(
    "analytics-dashboard",
    goals.includes("automate") || problems.includes("unknown_source") ? "optional" : "optional",
    "Your enquiries, sources and performance in one plain-language view.",
  );
  add(
    "customer-database",
    goals.includes("keep_informed") ? "recommended" : "optional",
    goals.includes("keep_informed")
      ? "To keep customers informed you first need a proper record of who they are."
      : "A searchable, secure record of your customers.",
  );
  add(
    "admin-dashboard",
    goals.includes("credibility") || goals.includes("keep_informed") ? "recommended" : "optional",
    "Update your own text, images and pages without waiting on anyone.",
  );

  // Dependencies: never recommend something whose prerequisite is excluded.
  const byslug = new Map(out.map((d) => [d.slug, d]));
  if (byslug.get("ecommerce")?.verdict === "recommended") {
    const payments = byslug.get("payments");
    if (payments && payments.verdict !== "recommended") {
      payments.verdict = "recommended";
      payments.reason = "An online shop needs a way to take payment.";
    }
  }
  if (byslug.get("follow-up-automation")?.verdict === "recommended") {
    const crm = byslug.get("crm");
    if (crm && crm.verdict !== "recommended") {
      crm.verdict = "recommended";
      crm.reason = "Automatic follow-up needs an organised list of people to follow up with.";
    }
  }

  void has;
  return out;
}
