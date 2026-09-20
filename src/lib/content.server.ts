/**
 * Server-only content (CMS) logic.
 * Every exported admin function assumes the caller was already authorised with
 * `requireAdmin` from admin.server.ts — the server functions do that first.
 */
import type {
  ContentBlockInput,
  FaqInput,
  LegalDocInput,
  SeoPageInput,
  TestimonialInput,
} from "./content-schemas";
import { CONTENT_DEFAULTS } from "./content-defaults";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Entity = "content_blocks" | "faqs" | "testimonials" | "seo_pages" | "legal_documents";

/* ------------------------------------------------------------------ audit */

type LogEntry = { field: string; previous: string | null; next: string | null };

function diff(before: Record<string, unknown> | null, after: Record<string, unknown>): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const [field, value] of Object.entries(after)) {
    const prev = before ? before[field] : undefined;
    const a = prev === undefined || prev === null ? null : String(prev);
    const b = value === undefined || value === null ? null : String(value);
    if (a !== b) entries.push({ field, previous: a, next: b });
  }
  return entries;
}

async function writeLog(entity: Entity, entityId: string, label: string, entries: LogEntry[], changedBy: string) {
  if (!entries.length) return;
  const supabase = await admin();
  await supabase.from("content_change_log").insert(
    entries.map((e) => ({
      entity,
      entity_id: entityId,
      label,
      field: e.field,
      previous_value: e.previous === null ? null : e.previous.slice(0, 2000),
      new_value: e.next === null ? null : e.next.slice(0, 2000),
      changed_by: changedBy,
    })),
  );
}

async function emailsFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map();
  const supabase = await admin();
  const { data } = await supabase.from("profiles").select("id,email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.email]));
}

/* ------------------------------------------------------------------ types */

export type ContentBlockRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  group: string;
  content: string;
  content_type: string;
  status: string;
  display_order: number;
  updated_at: string;
  updated_by_email: string | null;
};

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
  status: string;
  updated_at: string;
  updated_by_email: string | null;
};

export type TestimonialRow = {
  id: string;
  client_name: string;
  company: string;
  role_title: string;
  quote: string;
  avatar_url: string;
  rating: number;
  display_order: number;
  featured: boolean;
  status: string;
  updated_at: string;
  updated_by_email: string | null;
};

export type SeoPageRow = {
  id: string;
  route: string;
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  canonical_url: string;
  no_index: boolean;
  status: string;
  updated_at: string;
  updated_by_email: string | null;
};

export type LegalDocRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: string;
  published_at: string | null;
  updated_at: string;
  updated_by_email: string | null;
};

export type ContentLogEntry = {
  id: string;
  entity: string;
  label: string;
  field: string;
  previous: string | null;
  next: string | null;
  changedByEmail: string | null;
  createdAt: string;
};

export type ContentOverview = {
  publishedBlocks: number;
  draftBlocks: number;
  publishedFaqs: number;
  draftFaqs: number;
  publishedTestimonials: number;
  draftTestimonials: number;
  seoPages: number;
  publishedLegal: number;
  recent: { id: string; name: string; type: string; updatedByEmail: string | null; updatedAt: string }[];
};

export type ContentWorkspace = {
  blocks: ContentBlockRow[];
  faqs: FaqRow[];
  testimonials: TestimonialRow[];
  seoPages: SeoPageRow[];
  legalDocs: LegalDocRow[];
  overview: ContentOverview;
  log: ContentLogEntry[];
};

/* ------------------------------------------------------------------ read */

export async function contentWorkspace(): Promise<ContentWorkspace> {
  const supabase = await admin();
  const [blocksRes, faqsRes, testimonialsRes, seoRes, legalRes, logRes] = await Promise.all([
    supabase.from("content_blocks").select("*").order("group").order("display_order"),
    supabase.from("faqs").select("*").order("category").order("display_order"),
    supabase.from("testimonials").select("*").order("display_order"),
    supabase.from("seo_pages").select("*").order("route"),
    supabase.from("legal_documents").select("*").order("slug"),
    supabase.from("content_change_log").select("*").order("created_at", { ascending: false }).limit(60),
  ]);

  const rows = <T,>(res: { data: T[] | null }) => res.data ?? [];
  const blocks = rows<Record<string, any>>(blocksRes);
  const faqs = rows<Record<string, any>>(faqsRes);
  const testimonials = rows<Record<string, any>>(testimonialsRes);
  const seoPages = rows<Record<string, any>>(seoRes);
  const legalDocs = rows<Record<string, any>>(legalRes);
  const log = rows<Record<string, any>>(logRes);

  const emails = await emailsFor([
    ...blocks.map((r) => r["updated_by"] ?? null),
    ...faqs.map((r) => r["updated_by"] ?? null),
    ...testimonials.map((r) => r["updated_by"] ?? null),
    ...seoPages.map((r) => r["updated_by"] ?? null),
    ...legalDocs.map((r) => r["updated_by"] ?? null),
    ...log.map((r) => r["changed_by"] ?? null),
  ]);
  const email = (id: string | null | undefined) => (id ? (emails.get(id) ?? null) : null);

  const blockRows: ContentBlockRow[] = blocks.map((r) => ({
    id: r["id"],
    key: r["key"],
    name: r["name"],
    description: r["description"] ?? "",
    group: r["group"],
    content: r["content"] ?? "",
    content_type: r["content_type"],
    status: r["status"],
    display_order: r["display_order"],
    updated_at: r["updated_at"],
    updated_by_email: email(r["updated_by"]),
  }));

  const faqRows: FaqRow[] = faqs.map((r) => ({
    id: r["id"],
    question: r["question"],
    answer: r["answer"],
    category: r["category"],
    display_order: r["display_order"],
    status: r["status"],
    updated_at: r["updated_at"],
    updated_by_email: email(r["updated_by"]),
  }));

  const testimonialRows: TestimonialRow[] = testimonials.map((r) => ({
    id: r["id"],
    client_name: r["client_name"],
    company: r["company"] ?? "",
    role_title: r["role_title"] ?? "",
    quote: r["quote"],
    avatar_url: r["avatar_url"] ?? "",
    rating: r["rating"],
    display_order: r["display_order"],
    featured: r["featured"],
    status: r["status"],
    updated_at: r["updated_at"],
    updated_by_email: email(r["updated_by"]),
  }));

  const seoRows: SeoPageRow[] = seoPages.map((r) => ({
    id: r["id"],
    route: r["route"],
    meta_title: r["meta_title"] ?? "",
    meta_description: r["meta_description"] ?? "",
    og_title: r["og_title"] ?? "",
    og_description: r["og_description"] ?? "",
    canonical_url: r["canonical_url"] ?? "",
    no_index: r["no_index"],
    status: r["status"],
    updated_at: r["updated_at"],
    updated_by_email: email(r["updated_by"]),
  }));

  const legalRows: LegalDocRow[] = legalDocs.map((r) => ({
    id: r["id"],
    slug: r["slug"],
    title: r["title"],
    body: r["body"] ?? "",
    status: r["status"],
    published_at: r["published_at"],
    updated_at: r["updated_at"],
    updated_by_email: email(r["updated_by"]),
  }));

  const recentSource = [
    ...blockRows.map((b) => ({ id: b.id, name: b.name, type: "Content block", updatedByEmail: b.updated_by_email, updatedAt: b.updated_at })),
    ...faqRows.map((f) => ({ id: f.id, name: f.question, type: "FAQ", updatedByEmail: f.updated_by_email, updatedAt: f.updated_at })),
    ...testimonialRows.map((t) => ({ id: t.id, name: t.client_name, type: "Testimonial", updatedByEmail: t.updated_by_email, updatedAt: t.updated_at })),
    ...seoRows.map((s) => ({ id: s.id, name: s.route, type: "SEO page", updatedByEmail: s.updated_by_email, updatedAt: s.updated_at })),
    ...legalRows.map((l) => ({ id: l.id, name: l.title, type: "Legal", updatedByEmail: l.updated_by_email, updatedAt: l.updated_at })),
  ]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 8);

  return {
    blocks: blockRows,
    faqs: faqRows,
    testimonials: testimonialRows,
    seoPages: seoRows,
    legalDocs: legalRows,
    overview: {
      publishedBlocks: blockRows.filter((b) => b.status === "published").length,
      draftBlocks: blockRows.filter((b) => b.status === "draft").length,
      publishedFaqs: faqRows.filter((f) => f.status === "published").length,
      draftFaqs: faqRows.filter((f) => f.status === "draft").length,
      publishedTestimonials: testimonialRows.filter((t) => t.status === "published").length,
      draftTestimonials: testimonialRows.filter((t) => t.status === "draft").length,
      seoPages: seoRows.length,
      publishedLegal: legalRows.filter((l) => l.status === "published").length,
      recent: recentSource,
    },
    log: log.map((r) => ({
      id: r["id"],
      entity: r["entity"],
      label: r["label"] ?? "",
      field: r["field"],
      previous: r["previous_value"],
      next: r["new_value"],
      changedByEmail: email(r["changed_by"]),
      createdAt: r["created_at"],
    })),
  };
}

/* ------------------------------------------------------------------ write */

async function upsert(entity: Entity, id: string | undefined, record: Record<string, unknown>, label: string, userId: string) {
  const supabase = await admin();
  let before: Record<string, unknown> | null = null;
  if (id) {
    const { data } = await supabase.from(entity).select("*").eq("id", id).maybeSingle();
    before = (data as Record<string, unknown>) ?? null;
    if (!before) throw new Error("That record no longer exists.");
  }

  const payload = { ...record, updated_by: userId, ...(id ? {} : { created_by: userId }) } as never;
  let recordId = id;
  if (id) {
    const { error } = await supabase.from(entity).update(payload).eq("id", id);
    if (error) throw new Error(friendly(error.message));
  } else {
    const { data, error } = await supabase.from(entity).insert(payload).select("id").single();
    if (error) throw new Error(friendly(error.message));
    recordId = (data as { id: string }).id;
  }

  await writeLog(entity, recordId!, label, diff(before, record), userId);
  return { id: recordId! };
}

function friendly(message: string) {
  if (message.includes("content_blocks_key_unique")) return "Another content block already uses that key.";
  if (message.includes("seo_pages_route_unique")) return "That page already has an SEO record.";
  if (message.includes("legal_documents_slug_unique")) return "A legal document with that address already exists.";
  if (message.includes("content_blocks_key_format")) return "Use lowercase words separated by dots, dashes or underscores.";
  return message;
}

export function saveBlock(input: ContentBlockInput, userId: string) {
  return upsert(
    "content_blocks",
    input.id,
    {
      key: input.key,
      name: input.name,
      description: input.description,
      group: input.group,
      content: input.content,
      content_type: input.content_type,
      status: input.status,
      display_order: input.display_order,
    },
    input.name,
    userId,
  );
}

export function saveFaq(input: FaqInput, userId: string) {
  return upsert(
    "faqs",
    input.id,
    {
      question: input.question,
      answer: input.answer,
      category: input.category,
      display_order: input.display_order,
      status: input.status,
    },
    input.question,
    userId,
  );
}

export function saveTestimonial(input: TestimonialInput, userId: string) {
  return upsert(
    "testimonials",
    input.id,
    {
      client_name: input.client_name,
      company: input.company,
      role_title: input.role_title,
      quote: input.quote,
      avatar_url: input.avatar_url || null,
      rating: input.rating,
      display_order: input.display_order,
      featured: input.featured,
      status: input.status,
    },
    input.client_name,
    userId,
  );
}

export function saveSeoPage(input: SeoPageInput, userId: string) {
  return upsert(
    "seo_pages",
    input.id,
    {
      route: input.route,
      meta_title: input.meta_title,
      meta_description: input.meta_description,
      og_title: input.og_title,
      og_description: input.og_description,
      canonical_url: input.canonical_url || null,
      no_index: input.no_index,
      status: input.status,
    },
    input.route,
    userId,
  );
}

export function saveLegalDoc(input: LegalDocInput, userId: string) {
  return upsert(
    "legal_documents",
    input.id,
    {
      slug: input.slug,
      title: input.title,
      body: input.body,
      status: input.status,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    },
    input.title,
    userId,
  );
}

export async function setContentStatus(entity: Entity, id: string, status: "draft" | "published", userId: string) {
  const supabase = await admin();
  const { data: before } = await supabase.from(entity).select("*").eq("id", id).maybeSingle();
  if (!before) throw new Error("That record no longer exists.");
  const patch: Record<string, unknown> = { status, updated_by: userId };
  if (entity === "legal_documents") patch["published_at"] = status === "published" ? new Date().toISOString() : null;
  const { error } = await supabase.from(entity).update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
  await writeLog(entity, id, String((before as Record<string, unknown>)["name"] ?? ""), [
    { field: "status", previous: String((before as Record<string, unknown>)["status"]), next: status },
  ], userId);
  return { ok: true as const };
}

export async function deleteContent(entity: Entity, id: string, userId: string) {
  const supabase = await admin();
  const { data: before } = await supabase.from(entity).select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from(entity).delete().eq("id", id);
  if (error) throw new Error(error.message);
  await writeLog(entity, id, String((before as Record<string, unknown> | null)?.["name"] ?? ""), [
    { field: "deleted", previous: "false", next: "true" },
  ], userId);
  return { deleted: true as const };
}

export async function reorderContent(entity: "content_blocks" | "faqs" | "testimonials", ids: string[], userId: string) {
  const supabase = await admin();
  for (let index = 0; index < ids.length; index += 1) {
    await supabase.from(entity).update({ display_order: index * 10, updated_by: userId } as never).eq("id", ids[index]!);
  }
  return { ok: true as const };
}

/** Insert any default content block that does not exist yet, published, with the app's own copy. */
export async function seedDefaults(userId: string): Promise<{ inserted: number }> {
  const supabase = await admin();
  const { data: existing } = await supabase.from("content_blocks").select("key");
  const have = new Set((existing ?? []).map((r) => r.key));
  const missing = CONTENT_DEFAULTS.filter((d) => !have.has(d.key));
  if (!missing.length) return { inserted: 0 };
  const { error } = await supabase.from("content_blocks").insert(
    missing.map((d) => ({
      key: d.key,
      name: d.name,
      description: d.description,
      group: d.group,
      content: d.content,
      content_type: d.content_type,
      status: "published" as const,
      display_order: d.display_order,
      created_by: userId,
      updated_by: userId,
    })),
  );
  if (error) throw new Error(error.message);
  return { inserted: missing.length };
}
