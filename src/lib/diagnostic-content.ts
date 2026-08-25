export const PILLARS = [
  {
    key: "look",
    name: "Look",
    promise: "Make your business look credible.",
    detail: "Make your business look professional and trustworthy the moment someone arrives.",
  },
  {
    key: "attract",
    name: "Attract",
    promise: "Help the right people find you.",
    detail: "Help potential customers discover you when they are actually looking.",
  },
  {
    key: "convert",
    name: "Convert",
    promise: "Turn visitors into enquiries and customers.",
    detail: "Turn visitors into enquiries, bookings or sales instead of quiet page views.",
  },
  {
    key: "run",
    name: "Run",
    promise: "Organise and automate what happens next.",
    detail: "Help you manage what happens after someone contacts you.",
  },
] as const;

export type PillarKey = (typeof PILLARS)[number]["key"];

export const GOAL_OPTIONS = [
  { id: "more_customers", label: "Get more customers" },
  { id: "found_on_google", label: "Get found on Google" },
  { id: "more_enquiries", label: "Generate more enquiries" },
  { id: "bookings", label: "Take bookings" },
  { id: "sell_products", label: "Sell products" },
  { id: "payments", label: "Receive payments" },
  { id: "credibility", label: "Build credibility" },
  { id: "automate", label: "Automate parts of my business" },
  { id: "keep_informed", label: "Keep customers informed" },
  { id: "not_sure", label: "I'm not sure yet" },
];

export type DiagnosticQuestion = {
  id: string;
  question: string;
  help?: string;
  type: "single" | "multi";
  options: { id: string; label: string }[];
  /** Only ask when one of these goals was selected. Empty = always ask. */
  goals?: string[];
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "geography",
    question: "Where do your customers come from?",
    help: "This tells us how much of your visibility work should be local.",
    type: "single",
    options: [
      { id: "local", label: "Mostly my own town or city" },
      { id: "regional", label: "A wider region around me" },
      { id: "national", label: "The whole country" },
      { id: "international", label: "Anywhere in the world" },
    ],
  },
  {
    id: "acquisition",
    question: "How do people find you today?",
    help: "Choose everything that applies.",
    type: "multi",
    options: [
      { id: "google", label: "Google" },
      { id: "social", label: "Social media" },
      { id: "referrals", label: "Referrals and word of mouth" },
      { id: "advertising", label: "Advertising" },
      { id: "whatsapp", label: "WhatsApp" },
      { id: "walk_ins", label: "Walk-ins" },
      { id: "existing", label: "Existing customers" },
      { id: "unsure", label: "Honestly, I'm not sure" },
    ],
  },
  {
    id: "conversion",
    question: "When someone is interested, what should they do next?",
    help: "Choose the one or two actions that matter most.",
    type: "multi",
    options: [
      { id: "call", label: "Call us" },
      { id: "whatsapp", label: "Message on WhatsApp" },
      { id: "enquiry", label: "Send an enquiry" },
      { id: "book", label: "Book an appointment" },
      { id: "buy", label: "Buy something" },
      { id: "quote", label: "Request a quote" },
      { id: "visit", label: "Visit us in person" },
      { id: "apply", label: "Apply or register" },
    ],
  },
  {
    id: "follow_up",
    question: "What happens after someone contacts you?",
    type: "single",
    options: [
      { id: "manual", label: "I handle it myself" },
      { id: "team", label: "Someone on my team handles it" },
      { id: "crm", label: "We use a system to track it" },
      { id: "missed", label: "We sometimes miss enquiries" },
      { id: "informal", label: "We don't really have a process" },
      { id: "unsure", label: "I'm not sure" },
    ],
  },
  {
    id: "problems",
    question: "Which of these sound familiar?",
    help: "Nothing here is unusual. It just tells us where the pressure is.",
    type: "multi",
    options: [
      { id: "miss_enquiries", label: "We miss enquiries when we're busy" },
      { id: "same_questions", label: "Customers ask the same questions again and again" },
      { id: "unknown_source", label: "I don't know where enquiries come from" },
      { id: "no_follow_up", label: "We rarely follow up with people who don't buy" },
      { id: "no_content", label: "We don't create content for Google or social" },
      { id: "manual_admin", label: "Too much of my week is admin" },
      { id: "none", label: "None of these" },
    ],
  },
];

export const CONTENT_MULTIPLICATION = [
  "One business idea",
  "Blog article",
  "Search content",
  "LinkedIn post",
  "Instagram carousel",
  "Facebook post",
  "Short video script",
  "Email",
  "WhatsApp message",
];
