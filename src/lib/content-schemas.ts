import { z } from "zod";

export const CONTENT_STATUSES = ["draft", "published"] as const;
export const CONTENT_TYPES = ["text", "textarea", "markdown", "url", "boolean"] as const;
export const CONTENT_GROUPS = ["site", "funnel", "seo", "general"] as const;

export const statusSchema = z.enum(CONTENT_STATUSES);

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Enter a full web address starting with http:// or https://");

export const contentBlockSchema = z
  .object({
    id: z.string().uuid().optional(),
    key: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Use lowercase words separated by dots, dashes or underscores"),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).default(""),
    group: z.enum(CONTENT_GROUPS).default("general"),
    content: z.string().max(20000).default(""),
    content_type: z.enum(CONTENT_TYPES).default("text"),
    status: statusSchema.default("draft"),
    display_order: z.number().int().min(0).max(9999).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.content_type === "url" && value.content.trim() !== "" && !/^(https?:\/\/\S+|\/\S*)$/.test(value.content.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Enter a valid web address or a path starting with /" });
    }
    if (value.content_type === "boolean" && !["true", "false", ""].includes(value.content.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Use true or false" });
    }
  });
export type ContentBlockInput = z.infer<typeof contentBlockSchema>;

export const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(8000),
  category: z.string().trim().min(2).max(60).default("General"),
  display_order: z.number().int().min(0).max(9999).default(0),
  status: statusSchema.default("draft"),
});
export type FaqInput = z.infer<typeof faqSchema>;

export const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  client_name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).default(""),
  role_title: z.string().trim().max(120).default(""),
  quote: z.string().trim().min(10).max(2000),
  avatar_url: optionalUrl.default(""),
  rating: z.number().int().min(1).max(5).default(5),
  display_order: z.number().int().min(0).max(9999).default(0),
  featured: z.boolean().default(false),
  status: statusSchema.default("draft"),
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const seoPageSchema = z.object({
  id: z.string().uuid().optional(),
  route: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^\/[a-zA-Z0-9\-/_$.]*$/, "Start the page address with /"),
  meta_title: z.string().trim().max(120).default(""),
  meta_description: z.string().trim().max(320).default(""),
  og_title: z.string().trim().max(120).default(""),
  og_description: z.string().trim().max(320).default(""),
  canonical_url: optionalUrl.default(""),
  no_index: z.boolean().default(false),
  status: statusSchema.default("draft"),
});
export type SeoPageInput = z.infer<typeof seoPageSchema>;

export const legalDocSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  title: z.string().trim().min(2).max(160),
  body: z.string().max(200000).default(""),
  status: statusSchema.default("draft"),
});
export type LegalDocInput = z.infer<typeof legalDocSchema>;

export const idSchema = z.object({ id: z.string().uuid() });
export const publishSchema = z.object({
  entity: z.enum(["content_blocks", "faqs", "testimonials", "seo_pages", "legal_documents"]),
  id: z.string().uuid(),
  status: statusSchema,
});
export const deleteSchema = z.object({
  entity: z.enum(["content_blocks", "faqs", "testimonials", "seo_pages", "legal_documents"]),
  id: z.string().uuid(),
});
export const reorderSchema = z.object({
  entity: z.enum(["content_blocks", "faqs", "testimonials"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});
