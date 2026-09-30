import { z } from "zod";

import { actionSchema, conditionSchema } from "./rules-engine";

export const RULE_STATUSES = ["draft", "active", "archived"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const ruleInputSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,79}$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  internal_notes: z.string().trim().max(4000).default(""),
  priority: z.number().int().min(-1000).max(1000),
  conditions: conditionSchema,
  actions: z.array(actionSchema).max(20),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;

export const ruleIdSchema = z.object({ id: z.string().uuid() });
export const ruleStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(RULE_STATUSES) });
export const rulePrioritySchema = z.object({ id: z.string().uuid(), priority: z.number().int().min(-1000).max(1000) });
