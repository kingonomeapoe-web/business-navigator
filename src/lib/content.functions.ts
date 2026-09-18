import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  contentBlockSchema,
  deleteSchema,
  faqSchema,
  legalDocSchema,
  publishSchema,
  reorderSchema,
  seoPageSchema,
  testimonialSchema,
} from "./content-schemas";
import type { ContentWorkspace } from "./content.server";
import { z } from "zod";

/* ------------------------------------------------------------ admin side */

export const getContentWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContentWorkspace> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { contentWorkspace } = await import("./content.server");
    return contentWorkspace();
  });

export const saveContentBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => contentBlockSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { saveBlock } = await import("./content.server");
    return saveBlock(data, context.userId);
  });

export const saveFaqEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => faqSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { saveFaq } = await import("./content.server");
    return saveFaq(data, context.userId);
  });

export const saveTestimonialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testimonialSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { saveTestimonial } = await import("./content.server");
    return saveTestimonial(data, context.userId);
  });

export const saveSeoPageEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => seoPageSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { saveSeoPage } = await import("./content.server");
    return saveSeoPage(data, context.userId);
  });

export const saveLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => legalDocSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { saveLegalDoc } = await import("./content.server");
    return saveLegalDoc(data, context.userId);
  });

export const setContentPublishState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => publishSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { setContentStatus } = await import("./content.server");
    return setContentStatus(data.entity, data.id, data.status, context.userId);
  });

export const deleteContentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ deleted: true }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { deleteContent } = await import("./content.server");
    return deleteContent(data.entity, data.id, context.userId);
  });

export const reorderContentRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reorderSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { reorderContent } = await import("./content.server");
    return reorderContent(data.entity, data.ids, context.userId);
  });

export const seedContentDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ inserted: number }> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { seedDefaults } = await import("./content.server");
    return seedDefaults(context.userId);
  });

/* ----------------------------------------------------------- public side */

export type PublicFaq = { id: string; question: string; answer: string; category: string };
export type PublicTestimonial = {
  id: string;
  client_name: string;
  company: string;
  role_title: string;
  quote: string;
  avatar_url: string | null;
  rating: number;
  featured: boolean;
};
export type PublicContent = {
  values: Record<string, string>;
  faqs: PublicFaq[];
  testimonials: PublicTestimonial[];
};

const EMPTY: PublicContent = { values: {}, faqs: [], testimonials: [] };

/**
 * Published content for public pages. Never throws: a backend problem returns
 * empty content and callers fall back to the application's own copy.
 */
export const getPublicContent = createServerFn({ method: "GET" }).handler(async (): Promise<PublicContent> => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) return EMPTY;

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const [blocks, faqs, testimonials] = await Promise.all([
      supabase.from("content_blocks").select("key,content").eq("status", "published"),
      supabase.from("faqs").select("id,question,answer,category,display_order").eq("status", "published").order("display_order"),
      supabase
        .from("testimonials")
        .select("id,client_name,company,role_title,quote,avatar_url,rating,featured,display_order")
        .eq("status", "published")
        .order("display_order"),
    ]);

    return {
      values: Object.fromEntries(((blocks.data ?? []) as { key: string; content: string }[]).map((b) => [b.key, b.content])),
      faqs: ((faqs.data ?? []) as PublicFaq[]).map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category })),
      testimonials: ((testimonials.data ?? []) as PublicTestimonial[]).map((t) => ({
        id: t.id,
        client_name: t.client_name,
        company: t.company ?? "",
        role_title: t.role_title ?? "",
        quote: t.quote,
        avatar_url: t.avatar_url ?? null,
        rating: t.rating,
        featured: t.featured,
      })),
    };
  } catch {
    return EMPTY;
  }
});

const legalSlugSchema = z.object({ slug: z.string().trim().min(2).max(60) });

export const getPublicLegalDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => legalSlugSchema.parse(input))
  .handler(async ({ data }): Promise<{ title: string; body: string; updatedAt: string } | null> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      const url = process.env["SUPABASE_URL"];
      if (!key || !url) return null;
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        },
      });
      const { data: doc } = await supabase
        .from("legal_documents")
        .select("title,body,updated_at,published_at")
        .eq("slug", data.slug)
        .eq("status", "published")
        .maybeSingle();
      if (!doc) return null;
      const row = doc as { title: string; body: string; updated_at: string; published_at: string | null };
      return { title: row.title, body: row.body, updatedAt: row.published_at ?? row.updated_at };
    } catch {
      return null;
    }
  });
