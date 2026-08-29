/**
 * Server-only admin catalogue and pricing logic.
 * Every exported function assumes the caller has already been authorised by
 * `requireAdmin` — the server functions in admin.functions.ts do that first.
 */
import type { ComponentInput, PriceInput } from "./admin-schemas";

export type AdminRole = "super_admin" | "admin" | "staff" | "client";

const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin"];
const RANK: Record<AdminRole, number> = { super_admin: 4, admin: 3, staff: 2, client: 1 };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Highest role held by this user, or null when they hold none. */
export async function highestRole(userId: string): Promise<AdminRole | null> {
  const supabase = await admin();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AdminRole).filter((r) => r in RANK);
  if (!roles.length) return null;
  return roles.sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
}

export async function requireAdmin(userId: string): Promise<AdminRole> {
  const role = await highestRole(userId);
  if (!role || !ADMIN_ROLES.includes(role)) throw new Error("Forbidden");
  return role;
}

/* ------------------------------------------------------------------ dashboard */

export type AdminStats = {
  activeComponents: number;
  draftComponents: number;
  archivedComponents: number;
  markets: number;
  activeQuotes: number;
  paidOrders: number;
  activeProjects: number;
  recentLeads: { id: string; business: string | null; email: string | null; createdAt: string; step: string }[];
};

export async function adminStats(): Promise<AdminStats> {
  const supabase = await admin();
  const count = async (table: string, apply: (q: any) => any) => {
    const { count: n } = await apply(supabase.from(table as never).select("id", { count: "exact", head: true }));
    return n ?? 0;
  };

  const [activeComponents, draftComponents, archivedComponents, markets, activeQuotes, paidOrders, activeProjects] =
    await Promise.all([
      count("components", (q) => q.eq("status", "active")),
      count("components", (q) => q.eq("status", "draft")),
      count("components", (q) => q.eq("status", "archived")),
      count("markets", (q) => q.eq("active", true)),
      count("quotes", (q) => q.in("status", ["draft", "sent", "accepted"])),
      count("orders", (q) => q.in("status", ["paid", "partially_paid"])),
      count("projects", (q) => q.not("status", "in", "(completed,cancelled)")),
    ]);

  const { data: leads } = await supabase
    .from("diagnostic_sessions")
    .select("id,business_name,email,created_at,step")
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    activeComponents,
    draftComponents,
    archivedComponents,
    markets,
    activeQuotes,
    paidOrders,
    activeProjects,
    recentLeads: (leads ?? []).map((l) => ({
      id: l.id,
      business: l.business_name,
      email: l.email,
      createdAt: l.created_at,
      step: l.step,
    })),
  };
}

/* ------------------------------------------------------------------ catalogue */

export type AdminComponentRow = {
  id: string;
  slug: string;
  name: string;
  pillar: string;
  status: string;
  featured: boolean;
  display_order: number;
  updated_at: string;
  hasOneTime: boolean;
  hasRecurring: boolean;
  inUse: boolean;
};

export async function listComponents(): Promise<AdminComponentRow[]> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("components")
    .select("id,slug,name,pillar,status,featured,display_order,updated_at,component_prices(one_time,recurring_monthly,active)")
    .order("pillar")
    .order("display_order");
  if (error) throw new Error(error.message);

  const used = await usedSlugs();
  return (data ?? []).map((row) => {
    const prices = (row.component_prices ?? []) as { one_time: number; recurring_monthly: number; active: boolean }[];
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      pillar: row.pillar,
      status: row.status,
      featured: row.featured,
      display_order: row.display_order,
      updated_at: row.updated_at,
      hasOneTime: prices.some((p) => p.active && Number(p.one_time) > 0),
      hasRecurring: prices.some((p) => p.active && Number(p.recurring_monthly) > 0),
      inUse: used.has(row.slug),
    };
  });
}

/** Slugs that already appear in commercial history and must never be hard-deleted. */
async function usedSlugs(): Promise<Set<string>> {
  const supabase = await admin();
  const { data } = await supabase.from("order_items").select("component_slug");
  return new Set((data ?? []).map((r) => r.component_slug));
}

export type AdminComponentDetail = {
  component: Record<string, unknown>;
  prices: { currency: string; one_time: number; recurring_monthly: number; setup_fee: number; active: boolean }[];
  dependencies: { related_component_id: string; kind: string }[];
  industryIds: string[];
  inUse: boolean;
};

export async function getComponent(id: string): Promise<AdminComponentDetail | null> {
  const supabase = await admin();
  const { data: component } = await supabase.from("components").select("*").eq("id", id).maybeSingle();
  if (!component) return null;
  const [{ data: prices }, { data: deps }, { data: inds }, used] = await Promise.all([
    supabase.from("component_prices").select("currency,one_time,recurring_monthly,setup_fee,active").eq("component_id", id),
    supabase.from("component_dependencies").select("related_component_id,kind").eq("component_id", id),
    supabase.from("component_industries").select("industry_id").eq("component_id", id),
    usedSlugs(),
  ]);

  return {
    component: component as unknown as Record<string, unknown>,
    prices: (prices ?? []).map((p) => ({
      currency: p.currency,
      one_time: Number(p.one_time),
      recurring_monthly: Number(p.recurring_monthly),
      setup_fee: Number(p.setup_fee),
      active: p.active,
    })),
    dependencies: deps ?? [],
    industryIds: (inds ?? []).map((i) => i.industry_id),
    inUse: used.has(component.slug),
  };
}

/** Reject a dependency graph that contains a `requires` cycle. */
async function assertNoCycles(componentId: string, deps: { related_component_id: string; kind: string }[]) {
  const supabase = await admin();
  const { data: all } = await supabase.from("component_dependencies").select("component_id,related_component_id,kind");
  const edges = new Map<string, string[]>();
  for (const row of all ?? []) {
    if (row.component_id === componentId) continue; // replaced below
    if (row.kind !== "requires") continue;
    edges.set(row.component_id, [...(edges.get(row.component_id) ?? []), row.related_component_id]);
  }
  edges.set(
    componentId,
    deps.filter((d) => d.kind === "requires").map((d) => d.related_component_id),
  );

  const state = new Map<string, number>();
  const visit = (node: string): boolean => {
    if (state.get(node) === 1) return true;
    if (state.get(node) === 2) return false;
    state.set(node, 1);
    for (const next of edges.get(node) ?? []) if (visit(next)) return true;
    state.set(node, 2);
    return false;
  };
  for (const node of edges.keys()) if (visit(node)) throw new Error("That would create a circular dependency.");
}

export async function saveComponent(input: ComponentInput): Promise<{ id: string }> {
  const supabase = await admin();

  // slug uniqueness
  const { data: clash } = await supabase.from("components").select("id").eq("slug", input.slug).maybeSingle();
  if (clash && clash.id !== input.id) throw new Error("Another component already uses that slug.");

  await assertNoCycles(input.id ?? "new", input.dependencies);

  // slugs of related components, mirrored into the arrays the recommendation engine reads
  const relatedIds = input.dependencies.map((d) => d.related_component_id);
  const { data: relatedRows } = relatedIds.length
    ? await supabase.from("components").select("id,slug").in("id", relatedIds)
    : { data: [] as { id: string; slug: string }[] };
  const slugById = new Map((relatedRows ?? []).map((r) => [r.id, r.slug]));
  const slugsFor = (kind: string) =>
    input.dependencies.filter((d) => d.kind === kind).map((d) => slugById.get(d.related_component_id) ?? "").filter(Boolean);

  const { data: industryRows } = input.industry_ids.length
    ? await supabase.from("industries").select("id,slug").in("id", input.industry_ids)
    : { data: [] as { id: string; slug: string }[] };

  const record = {
    name: input.name,
    slug: input.slug,
    pillar: input.pillar,
    status: input.status,
    short_description: input.short_description,
    client_explanation: input.client_explanation,
    detailed_explanation: input.detailed_explanation,
    internal_notes: input.internal_notes,
    icon: input.icon,
    image_url: input.image_url || null,
    display_order: input.display_order,
    featured: input.featured,
    is_core: input.is_core,
    recommendation_reason: input.recommendation_reason,
    upsell_message: input.upsell_message,
    priority: input.priority,
    pricing_model: input.pricing_model,
    has_one_time: input.has_one_time,
    has_recurring: input.has_recurring,
    industry_tags: (industryRows ?? []).map((r) => r.slug),
    depends_on: slugsFor("requires"),
    conflicts_with: slugsFor("conflicts"),
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("components").update(record).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("components").insert(record).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  await supabase.from("component_dependencies").delete().eq("component_id", id);
  if (input.dependencies.length) {
    const { error } = await supabase
      .from("component_dependencies")
      .insert(input.dependencies.map((d) => ({ component_id: id!, related_component_id: d.related_component_id, kind: d.kind })));
    if (error) throw new Error(error.message);
  }

  await supabase.from("component_industries").delete().eq("component_id", id);
  if (input.industry_ids.length) {
    await supabase
      .from("component_industries")
      .insert(input.industry_ids.map((industry_id) => ({ component_id: id!, industry_id })));
  }

  return { id: id! };
}

/** Archive rather than delete. Components with commercial history can never be deleted. */
export async function setComponentStatus(id: string, status: "draft" | "active" | "archived"): Promise<{ ok: true }> {
  const supabase = await admin();
  const { error } = await supabase.from("components").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteComponent(id: string): Promise<{ deleted: boolean }> {
  const supabase = await admin();
  const { data: component } = await supabase.from("components").select("slug").eq("id", id).maybeSingle();
  if (!component) return { deleted: false };
  const used = await usedSlugs();
  if (used.has(component.slug)) {
    await setComponentStatus(id, "archived");
    return { deleted: false };
  }
  const { error } = await supabase.from("components").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { deleted: true };
}

/* ------------------------------------------------------------------ markets & pricing */

export type Market = { id: string; name: string; code: string; currency_code: string; active: boolean };

export async function listMarkets(): Promise<Market[]> {
  const supabase = await admin();
  const { data } = await supabase.from("markets").select("id,name,code,currency_code,active").order("display_order");
  return (data ?? []) as Market[];
}

export async function listIndustries(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = await admin();
  const { data } = await supabase.from("industries").select("id,name,slug").eq("active", true).order("name");
  return data ?? [];
}

export type PricingRow = {
  componentId: string;
  slug: string;
  name: string;
  pillar: string;
  status: string;
  prices: Record<string, { one_time: number; recurring_monthly: number; setup_fee: number; active: boolean }>;
};

export async function pricingMatrix(): Promise<{ markets: Market[]; rows: PricingRow[] }> {
  const supabase = await admin();
  const markets = await listMarkets();
  const { data, error } = await supabase
    .from("components")
    .select("id,slug,name,pillar,status,display_order,component_prices(currency,one_time,recurring_monthly,setup_fee,active)")
    .neq("status", "archived")
    .order("pillar")
    .order("display_order");
  if (error) throw new Error(error.message);

  const rows: PricingRow[] = (data ?? []).map((row) => {
    const prices: PricingRow["prices"] = {};
    for (const p of (row.component_prices ?? []) as {
      currency: string;
      one_time: number;
      recurring_monthly: number;
      setup_fee: number;
      active: boolean;
    }[]) {
      prices[p.currency] = {
        one_time: Number(p.one_time),
        recurring_monthly: Number(p.recurring_monthly),
        setup_fee: Number(p.setup_fee),
        active: p.active,
      };
    }
    return { componentId: row.id, slug: row.slug, name: row.name, pillar: row.pillar, status: row.status, prices };
  });

  return { markets, rows };
}

/** Upsert one component/currency price and record every changed field in the audit log. */
export async function savePrices(prices: PriceInput[], changedBy: string): Promise<{ saved: number }> {
  const supabase = await admin();
  const markets = await listMarkets();

  for (const input of prices) {
    const market = markets.find((m) => m.currency_code === input.currency);
    if (!market) throw new Error(`No market configured for ${input.currency}`);

    const { data: existing } = await supabase
      .from("component_prices")
      .select("id,one_time,recurring_monthly,setup_fee,active")
      .eq("component_id", input.component_id)
      .eq("currency", input.currency)
      .maybeSingle();

    const next = {
      component_id: input.component_id,
      currency: input.currency,
      market_id: market.id,
      one_time: input.one_time,
      recurring_monthly: input.recurring_monthly,
      setup_fee: input.setup_fee,
      active: input.active,
    };

    if (existing) {
      const { error } = await supabase.from("component_prices").update(next).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("component_prices").insert(next);
      if (error) throw new Error(error.message);
    }

    const fields: [string, number | null, number][] = [
      ["one_time", existing ? Number(existing.one_time) : null, input.one_time],
      ["recurring_monthly", existing ? Number(existing.recurring_monthly) : null, input.recurring_monthly],
      ["setup_fee", existing ? Number(existing.setup_fee) : null, input.setup_fee],
    ];
    const entries = fields
      .filter(([, prev, now]) => prev === null || prev !== now)
      .map(([field, prev, now]) => ({
        component_id: input.component_id,
        market_id: market.id,
        currency: input.currency,
        field,
        previous_value: prev,
        new_value: now,
        changed_by: changedBy,
        note: input.note ?? null,
      }));
    if (existing && existing.active !== input.active) {
      entries.push({
        component_id: input.component_id,
        market_id: market.id,
        currency: input.currency,
        field: "active",
        previous_value: existing.active ? 1 : 0,
        new_value: input.active ? 1 : 0,
        changed_by: changedBy,
        note: input.note ?? null,
      });
    }
    if (entries.length) await supabase.from("pricing_change_log").insert(entries);
  }

  return { saved: prices.length };
}

export type PricingLogEntry = {
  id: string;
  component: string;
  currency: string;
  field: string;
  previous: number | null;
  next: number | null;
  changedBy: string | null;
  changedByEmail: string | null;
  note: string | null;
  createdAt: string;
};

export async function pricingLog(componentId: string | undefined, limit: number): Promise<PricingLogEntry[]> {
  const supabase = await admin();
  let query = supabase
    .from("pricing_change_log")
    .select("id,currency,field,previous_value,new_value,changed_by,note,created_at,components(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (componentId) query = query.eq("component_id", componentId);
  const { data } = await query;

  const ids = [...new Set((data ?? []).map((r) => r.changed_by).filter(Boolean))] as string[];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id,email").in("id", ids)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (data ?? []).map((r) => ({
    id: r.id,
    component: (r.components as { name: string } | null)?.name ?? "—",
    currency: r.currency,
    field: r.field,
    previous: r.previous_value === null ? null : Number(r.previous_value),
    next: r.new_value === null ? null : Number(r.new_value),
    changedBy: r.changed_by,
    changedByEmail: r.changed_by ? (emailById.get(r.changed_by) ?? null) : null,
    note: r.note,
    createdAt: r.created_at,
  }));
}
