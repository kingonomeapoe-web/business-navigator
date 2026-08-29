import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assetIdSchema,
  notificationIdSchema,
  projectIdSchema,
  registerAssetSchema,
  saveResponsesSchema,
} from "./portal-schemas";
import type { AdminProjectView, PortalData } from "./portal.server";

/** Links the signed-in user to the customer their payment created. */
export const activateAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ linked: boolean }> => {
    const { activateAccount } = await import("./portal.server");
    const email = String(context.claims["email"] ?? "");
    if (!email) return { linked: false };
    return activateAccount(context.userId, email);
  });

export const getPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalData | null> => {
    const { activateAccount, getPortalData } = await import("./portal.server");
    const email = String(context.claims["email"] ?? "");
    if (email) await activateAccount(context.userId, email);
    return getPortalData(context.userId, email);
  });

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveResponsesSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; readiness: number }> => {
    const { saveResponses } = await import("./portal.server");
    return saveResponses({ userId: context.userId, projectId: data.projectId, entries: data.entries });
  });

export const registerProjectAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => registerAssetSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    const { registerAsset } = await import("./portal.server");
    return registerAsset({ userId: context.userId, ...data });
  });

export const removeProjectAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assetIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { deleteAsset } = await import("./portal.server");
    return deleteAsset(context.userId, data.assetId);
  });

export const getAssetUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assetIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { signedAssetUrl, isAdmin } = await import("./portal.server");
    const admin = await isAdmin(context.userId);
    const url = await signedAssetUrl(data.assetId, { userId: context.userId, isAdmin: admin });
    return { url };
  });

export const finishOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string; outstanding?: string[] }> => {
    const { completeOnboarding } = await import("./portal.server");
    return completeOnboarding(context.userId, data.projectId);
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => notificationIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertProjectOwner } = await import("./portal.server");
    const { data: row } = await supabaseAdmin
      .from("client_notifications")
      .select("id,project_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false };
    const owner = await assertProjectOwner(context.userId, row.project_id);
    if (!owner) return { ok: false };
    await supabaseAdmin
      .from("client_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminListProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminProjectList, isAdmin } = await import("./portal.server");
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden");
    return adminProjectList();
  });

export const adminGetProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminProjectView | null> => {
    const { adminProjectView, isAdmin } = await import("./portal.server");
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden");
    return adminProjectView(data.projectId);
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ admin: boolean }> => {
    const { isAdmin } = await import("./portal.server");
    return { admin: await isAdmin(context.userId) };
  });
