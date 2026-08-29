/**
 * Phase 2 onboarding definition.
 *
 * Pure data: which questions exist, which purchased components make them
 * relevant, and which are required before a project is production-ready.
 * Client-safe — imported by both the portal UI and the server brief builder.
 */

export type OnboardingCategory = "business" | "brand" | "content" | "media" | "access" | "features";

export type OnboardingItemType = "text" | "textarea" | "url" | "select" | "files" | "confirm";

export type OnboardingItem = {
  key: string;
  section: OnboardingCategory;
  label: string;
  type: OnboardingItemType;
  required: boolean;
  /** Any-of component slugs. Absent = always relevant. */
  requires?: string[];
  help?: string;
  placeholder?: string;
  options?: string[];
  /** For `files` items: the asset category the uploads are filed under. */
  assetCategory?: string;
};

export type OnboardingSection = {
  key: OnboardingCategory;
  title: string;
  blurb: string;
};

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    key: "business",
    title: "Business identity",
    blurb: "Confirm what you already told us, and how customers reach you.",
  },
  { key: "brand", title: "Brand", blurb: "How your business should look and sound." },
  { key: "content", title: "Content", blurb: "The words. In your own language — we'll shape them." },
  { key: "media", title: "Media", blurb: "Photos and documents we can use on your site." },
  { key: "access", title: "Digital access", blurb: "Your domain, listings and existing accounts." },
  { key: "features", title: "Feature setup", blurb: "Details only needed for what you bought." },
];

const SEO_SLUGS = [
  "seo-foundation",
  "service-pages",
  "location-pages",
  "search-growth-engine",
  "programmatic-seo",
  "content-engine",
  "local-search",
];

export const ONBOARDING_ITEMS: OnboardingItem[] = [
  // Business identity
  {
    key: "business_confirmed",
    section: "business",
    label: "Confirm your business details",
    type: "confirm",
    required: true,
    help: "We captured these during your diagnostic. Correct anything that isn't right.",
  },
  {
    key: "contact_phone",
    section: "business",
    label: "Public phone number",
    type: "text",
    required: true,
    placeholder: "+44 7700 900123",
  },
  {
    key: "contact_email",
    section: "business",
    label: "Public contact email",
    type: "text",
    required: true,
    placeholder: "hello@yourbusiness.com",
  },
  {
    key: "business_hours",
    section: "business",
    label: "Opening hours",
    type: "textarea",
    required: true,
    placeholder: "Mon–Fri 9am–6pm, Sat 10am–2pm, Sun closed",
  },
  {
    key: "business_address",
    section: "business",
    label: "Address customers can visit or write to",
    type: "textarea",
    required: false,
    help: "Leave blank if you don't want an address published.",
  },

  // Brand
  {
    key: "logo_files",
    section: "brand",
    label: "Your logo",
    type: "files",
    required: true,
    assetCategory: "logo",
    help: "PNG or SVG works best. If you have a light and a dark version, upload both.",
  },
  {
    key: "brand_colours",
    section: "brand",
    label: "Brand colours",
    type: "text",
    required: true,
    placeholder: "Deep green #14532d, warm cream #faf7f0",
    help: "Hex codes if you have them — plain descriptions are fine too.",
  },
  { key: "brand_fonts", section: "brand", label: "Fonts you use", type: "text", required: false },
  {
    key: "brand_guidelines",
    section: "brand",
    label: "Brand guidelines or other brand files",
    type: "files",
    required: false,
    assetCategory: "brand",
  },
  {
    key: "visual_style",
    section: "brand",
    label: "Preferred visual style",
    type: "select",
    required: true,
    options: [
      "Clean and minimal",
      "Bold and confident",
      "Warm and friendly",
      "Corporate and formal",
      "Luxury and premium",
    ],
  },
  {
    key: "tone_of_voice",
    section: "brand",
    label: "Tone of voice",
    type: "textarea",
    required: false,
    placeholder: "Straight-talking, no jargon, reassuring",
  },

  // Content
  {
    key: "about_text",
    section: "content",
    label: "About your business",
    type: "textarea",
    required: true,
    help: "Don't worry about getting this perfect. Tell us in your own words.",
  },
  {
    key: "services_text",
    section: "content",
    label: "Your services, and what each one involves",
    type: "textarea",
    required: true,
    help: "One per line is perfect.",
  },
  { key: "pricing_text", section: "content", label: "Pricing you're happy to publish", type: "textarea", required: false },
  {
    key: "differentiators",
    section: "content",
    label: "Why customers choose you over the alternative",
    type: "textarea",
    required: true,
  },
  { key: "faqs_text", section: "content", label: "Questions customers always ask", type: "textarea", required: false },
  { key: "testimonials_text", section: "content", label: "Testimonials or reviews", type: "textarea", required: false },
  { key: "team_text", section: "content", label: "Team members to feature", type: "textarea", required: false },
  {
    key: "primary_cta",
    section: "content",
    label: "What should visitors be pushed to do?",
    type: "text",
    required: false,
    placeholder: "Book a free consultation",
  },

  // Media
  {
    key: "photos",
    section: "media",
    label: "Photos of your work, team, premises or products",
    type: "files",
    required: false,
    assetCategory: "photos",
    help: "Real photos beat stock every time. Up to 25MB per file.",
  },
  {
    key: "documents",
    section: "media",
    label: "Documents, brochures or price lists",
    type: "files",
    required: false,
    assetCategory: "documents",
  },

  // Digital access
  {
    key: "domain_name",
    section: "access",
    label: "Domain you want to use",
    type: "text",
    required: true,
    placeholder: "yourbusiness.com — or tell us you'd like us to register one",
  },
  { key: "existing_website", section: "access", label: "Existing website", type: "url", required: false },
  {
    key: "google_business",
    section: "access",
    label: "Google Business Profile",
    type: "text",
    required: true,
    requires: ["local-search", "seo-foundation"],
    help: "Paste the link, or tell us you don't have one yet. Never send us passwords — we'll email you a manager-access request instead.",
  },
  {
    key: "social_links",
    section: "access",
    label: "Social profiles",
    type: "textarea",
    required: false,
    placeholder: "Instagram, Facebook, LinkedIn…",
  },
  {
    key: "analytics_access",
    section: "access",
    label: "Existing analytics",
    type: "textarea",
    required: false,
    requires: ["analytics", "analytics-dashboard"],
    help: "Tell us which tool you use. We'll send an access invitation — don't share credentials here.",
  },
  { key: "other_integrations", section: "access", label: "Other tools we should connect to", type: "textarea", required: false },

  // Feature setup — conditional on purchase
  {
    key: "whatsapp_number",
    section: "features",
    label: "WhatsApp number for enquiries",
    type: "text",
    required: true,
    requires: ["whatsapp"],
  },
  {
    key: "booking_services",
    section: "features",
    label: "What can be booked",
    type: "textarea",
    required: true,
    requires: ["booking"],
  },
  {
    key: "booking_durations",
    section: "features",
    label: "How long each appointment takes",
    type: "textarea",
    required: true,
    requires: ["booking"],
  },
  {
    key: "booking_hours",
    section: "features",
    label: "When you accept bookings",
    type: "textarea",
    required: true,
    requires: ["booking"],
  },
  {
    key: "booking_rules",
    section: "features",
    label: "Booking rules (notice, cancellations, deposits)",
    type: "textarea",
    required: false,
    requires: ["booking"],
  },
  {
    key: "seo_services",
    section: "features",
    label: "Services you want to be found for",
    type: "textarea",
    required: true,
    requires: SEO_SLUGS,
  },
  {
    key: "seo_locations",
    section: "features",
    label: "Towns and areas you want to be found in",
    type: "textarea",
    required: true,
    requires: SEO_SLUGS,
  },
  {
    key: "seo_priority",
    section: "features",
    label: "Your single most valuable market",
    type: "text",
    required: false,
    requires: ["search-growth-engine", "programmatic-seo"],
  },
  {
    key: "ai_knowledge",
    section: "features",
    label: "What your assistant must know about the business",
    type: "textarea",
    required: true,
    requires: ["ai-assistant"],
  },
  {
    key: "ai_policies",
    section: "features",
    label: "Policies the assistant must follow",
    type: "textarea",
    required: false,
    requires: ["ai-assistant"],
    help: "Refunds, availability, what it should never promise.",
  },
  {
    key: "shop_catalog",
    section: "features",
    label: "Products you'll sell",
    type: "textarea",
    required: true,
    requires: ["ecommerce"],
    help: "A list is fine. Upload a spreadsheet or catalogue in Media if you have one.",
  },
  {
    key: "shop_delivery",
    section: "features",
    label: "Delivery and collection",
    type: "textarea",
    required: true,
    requires: ["ecommerce"],
  },
  {
    key: "payment_preferences",
    section: "features",
    label: "How you want to be paid online",
    type: "textarea",
    required: true,
    requires: ["payments", "ecommerce"],
  },
  {
    key: "lead_categories",
    section: "features",
    label: "Types of enquiry you receive",
    type: "textarea",
    required: true,
    requires: ["crm", "lead-capture", "lead-qualification"],
  },
  {
    key: "notification_recipients",
    section: "features",
    label: "Who gets notified about new enquiries",
    type: "textarea",
    required: true,
    requires: ["crm", "notifications", "lead-capture"],
  },
  {
    key: "sales_process",
    section: "features",
    label: "What happens after an enquiry arrives",
    type: "textarea",
    required: false,
    requires: ["crm", "follow-up-automation"],
  },
  {
    key: "social_platforms",
    section: "features",
    label: "Platforms you want content for",
    type: "text",
    required: true,
    requires: ["social-content-engine"],
  },
  {
    key: "social_themes",
    section: "features",
    label: "Themes your content should cover",
    type: "textarea",
    required: true,
    requires: ["social-content-engine"],
  },
];

export const ASSET_CATEGORIES = [
  "logo",
  "brand",
  "team",
  "products",
  "services",
  "office",
  "photos",
  "testimonials",
  "documents",
  "other",
] as const;

export function itemsForComponents(slugs: string[]): OnboardingItem[] {
  const owned = new Set(slugs);
  return ONBOARDING_ITEMS.filter((item) => !item.requires || item.requires.some((slug) => owned.has(slug)));
}

export type ResponseMap = Record<string, string>;

export function isItemComplete(
  item: OnboardingItem,
  responses: ResponseMap,
  assetCountsByCategory: Record<string, number>,
): boolean {
  if (item.type === "files") return (assetCountsByCategory[item.assetCategory ?? "other"] ?? 0) > 0;
  if (item.type === "confirm") return responses[item.key] === "confirmed";
  return (responses[item.key] ?? "").trim().length > 0;
}

export type SectionProgress = {
  key: OnboardingCategory;
  title: string;
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
};

export type ProgressModel = {
  sections: SectionProgress[];
  readiness: number;
  outstanding: { key: string; label: string; section: OnboardingCategory }[];
  complete: boolean;
};

export function computeProgress(
  items: OnboardingItem[],
  responses: ResponseMap,
  assetCountsByCategory: Record<string, number>,
): ProgressModel {
  const sections: SectionProgress[] = ONBOARDING_SECTIONS.map((section) => {
    const sectionItems = items.filter((i) => i.section === section.key);
    const required = sectionItems.filter((i) => i.required);
    return {
      key: section.key,
      title: section.title,
      total: sectionItems.length,
      completed: sectionItems.filter((i) => isItemComplete(i, responses, assetCountsByCategory)).length,
      requiredTotal: required.length,
      requiredCompleted: required.filter((i) => isItemComplete(i, responses, assetCountsByCategory)).length,
    };
  }).filter((s) => s.total > 0);

  const requiredItems = items.filter((i) => i.required);
  const outstanding = requiredItems
    .filter((i) => !isItemComplete(i, responses, assetCountsByCategory))
    .map((i) => ({ key: i.key, label: i.label, section: i.section }));

  const readiness =
    requiredItems.length === 0
      ? 100
      : Math.round(((requiredItems.length - outstanding.length) / requiredItems.length) * 100);

  return { sections, readiness, outstanding, complete: outstanding.length === 0 };
}

export const PROJECT_STAGES = [
  { key: "created", label: "Discovery" },
  { key: "onboarding", label: "Onboarding" },
  { key: "ready_for_build", label: "Brief ready" },
  { key: "design", label: "Design" },
  { key: "development", label: "Build" },
  { key: "review", label: "Review" },
  { key: "launch", label: "Launch" },
  { key: "completed", label: "Live" },
] as const;

export type ProjectStatus = (typeof PROJECT_STAGES)[number]["key"];
