import { z } from "zod";

export const PILLARS = ["look", "attract", "convert", "run"] as const;
export const COMPONENT_STATUSES = ["draft", "active", "archived"] as const;
export const PRICING_MODELS = ["fixed", "from", "quote"] as const;
export const DEPENDENCY_KINDS = ["requires", "conflicts", "related"] as const;

const money = z
  .number({ invalid_type_error: "Enter a number" })
  .finite("Enter a number")
  .min(0, "Prices cannot be negative")
  .max(1_000_000_000, "That price is unrealistically large");

export const componentInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  pillar: z.enum(PILLARS),
  status: z.enum(COMPONENT_STATUSES),
  short_description: z.string().trim().max(400).default(""),
  client_explanation: z.string().trim().max(4000).default(""),
  detailed_explanation: z.string().trim().max(8000).default(""),
  internal_notes: z.string().trim().max(8000).default(""),
  icon: z.string().trim().max(60).default("sparkles"),
  image_url: z.string().trim().max(500).url().or(z.literal("")).default(""),
  display_order: z.number().int().min(0).max(9999),
  featured: z.boolean(),
  is_core: z.boolean(),
  recommendation_reason: z.string().trim().max(2000).default(""),
  upsell_message: z.string().trim().max(1000).default(""),
  priority: z.number().int().min(0).max(1000),
  pricing_model: z.enum(PRICING_MODELS),
  has_one_time: z.boolean(),
  has_recurring: z.boolean(),
  industry_ids: z.array(z.string().uuid()).max(100).default([]),
  dependencies: z
    .array(
      z.object({
        related_component_id: z.string().uuid(),
        kind: z.enum(DEPENDENCY_KINDS),
      }),
    )
    .max(60)
    .default([]),
});

export type ComponentInput = z.infer<typeof componentInputSchema>;

export const componentIdSchema = z.object({ id: z.string().uuid() });

export const priceInputSchema = z.object({
  component_id: z.string().uuid(),
  currency: z.enum(["USD", "GBP", "NGN", "EUR"]),
  one_time: money,
  recurring_monthly: money,
  setup_fee: money,
  active: z.boolean().default(true),
  note: z.string().trim().max(300).optional(),
});

export type PriceInput = z.infer<typeof priceInputSchema>;

export const priceBatchSchema = z.object({ prices: z.array(priceInputSchema).min(1).max(50) });

export const pricingLogQuerySchema = z.object({
  componentId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
