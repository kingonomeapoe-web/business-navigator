import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ruleIdSchema, ruleInputSchema, rulePrioritySchema, ruleStatusSchema } from "./rules-schemas";
import type { RulesWorkspace } from "./rules.server";

async function guard(userId: string) {
  const { requireAdmin } = await import("./admin.server");
  await requireAdmin(userId);
  return import("./rules.server");
}

export const getRulesWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RulesWorkspace> => (await guard(context.userId)).workspace() as never);

export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleInputSchema.parse(input))
  .handler(async ({ data, context }) => (await guard(context.userId)).saveRule(data, context.userId));

export const setRuleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleStatusSchema.parse(input))
  .handler(async ({ data, context }) => (await guard(context.userId)).setStatus(data.id, data.status, context.userId));

export const setRulePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rulePrioritySchema.parse(input))
  .handler(async ({ data, context }) => (await guard(context.userId)).setPriority(data.id, data.priority, context.userId));

export const duplicateRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleIdSchema.parse(input))
  .handler(async ({ data, context }) => (await guard(context.userId)).duplicateRule(data.id, context.userId));

export const removeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleIdSchema.parse(input))
  .handler(async ({ data, context }) => (await guard(context.userId)).removeRule(data.id, context.userId));
