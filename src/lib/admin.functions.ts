import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  componentIdSchema,
  componentInputSchema,
  priceBatchSchema,
  pricingLogQuerySchema,
} from "./admin-schemas";
import type {
  AdminComponentDetail,
  AdminComponentRow,
  AdminRole,
  AdminStats,
  Market,
  PricingLogEntry,
  PricingRow,
} from "./admin.server";
import { z } from "zod";

/** Who am I, as far as the admin application is concerned. */
export const whoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: AdminRole | null; email: string; isAdmin: boolean }> => {
    const { highestRole } = await import("./admin.server");
    const role = await highestRole(context.userId);
    return {
      role,
      email: String(context.claims["email"] ?? ""),
      isAdmin: role === "admin" || role === "super_admin",
    };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { requireAdmin, adminStats } = await import("./admin.server");
    await requireAdmin(context.userId);
    return adminStats();
  });

export const listAdminComponents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminComponentRow[]> => {
    const { requireAdmin, listComponents } = await import("./admin.server");
    await requireAdmin(context.userId);
    return listComponents();
  });

export const getAdminComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => componentIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminComponentDetail | null> => {
    const { requireAdmin, getComponent } = await import("./admin.server");
    await requireAdmin(context.userId);
    return getComponent(data.id);
  });

export const saveAdminComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => componentInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin, saveComponent } = await import("./admin.server");
    await requireAdmin(context.userId);
    return saveComponent(data);
  });

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(["draft", "active", "archived"]) });

export const setAdminComponentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireAdmin, setComponentStatus } = await import("./admin.server");
    await requireAdmin(context.userId);
    return setComponentStatus(data.id, data.status);
  });

export const adminOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      markets: Market[];
      industries: { id: string; name: string; slug: string }[];
      components: { id: string; name: string; slug: string; pillar: string }[];
    }> => {
      const { requireAdmin, listMarkets, listIndustries, listComponents } = await import("./admin.server");
      await requireAdmin(context.userId);
      const [markets, industries, components] = await Promise.all([listMarkets(), listIndustries(), listComponents()]);
      return {
        markets,
        industries,
        components: components.map((c) => ({ id: c.id, name: c.name, slug: c.slug, pillar: c.pillar })),
      };
    },
  );

export const getPricingMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ markets: Market[]; rows: PricingRow[] }> => {
    const { requireAdmin, pricingMatrix } = await import("./admin.server");
    await requireAdmin(context.userId);
    return pricingMatrix();
  });

export const saveComponentPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => priceBatchSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ saved: number }> => {
    const { requireAdmin, savePrices } = await import("./admin.server");
    await requireAdmin(context.userId);
    return savePrices(data.prices, context.userId);
  });

export const getPricingLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pricingLogQuerySchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<PricingLogEntry[]> => {
    const { requireAdmin, pricingLog } = await import("./admin.server");
    await requireAdmin(context.userId);
    return pricingLog(data.componentId, data.limit);
  });
