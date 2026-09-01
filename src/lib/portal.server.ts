/**
 * Phase 2 portal core: account activation, project ownership, onboarding
 * persistence, readiness, assets and the internal project brief.
 * Server-only.
 */
import {
  computeProgress,
  itemsForComponents,
  type ProgressModel,
  type ResponseMap,
} from "./onboarding-content";

export type PortalAsset = {
  id: string;
  category: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: string;
};

export type PortalData = {
  profile: { email: string; fullName: string | null };
  customer: {
    id: string;
    firstName: string | null;
    businessName: string | null;
    email: string;
    country: string | null;
    currency: string;
  };
  project: {
    id: string;
    name: string;
    status: string;
    readiness: number;
    onboardingCompletedAt: string | null;
    readyForBuildAt: string | null;
  };
  order: {
    orderNumber: string;
    currency: string;
    oneTimeTotal: number;
    recurringTotal: number;
    amountDue: number;
    amountPaid: number;
    status: string;
    quoteAccessToken: string | null;
  } | null;
  components: { slug: string; name: string; pillar: string; recurring: number; oneTime: number }[];
  session: {
    firstName: string | null;
    businessName: string | null;
    businessDescription: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    serviceArea: string | null;
    email: string | null;
    industry: string | null;
    specialisation: string | null;
    goals: string[];
  } | null;
  responses: ResponseMap;
  assets: PortalAsset[];
  progress: ProgressModel;
  notifications: { id: string; kind: string; title: string; body: string; readAt: string | null; createdAt: string }[];
  statusHistory: { toStatus: string; note: string | null; createdAt: string }[];
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Link a freshly signed-in user to the customer record their payment created. */
export async function activateAccount(userId: string, email: string): Promise<{ linked: boolean }> {
  const supabase = await admin();
  const normalised = email.trim().toLowerCase();

  await supabase.from("profiles").upsert({ id: userId, email: normalised }, { onConflict: "id" });

  const { data: customers } = await supabase
    .from("customers")
    .select("id,user_id")
    .ilike("email", normalised);

  let linked = false;
  for (const customer of customers ?? []) {
    if (customer.user_id === userId) {
      linked = true;
      continue;
    }
    if (customer.user_id) continue;
    await supabase.from("customers").update({ user_id: userId }).eq("id", customer.id);
    linked = true;
  }
  return { linked };
}

async function resolveProject(userId: string, projectId?: string) {
  const supabase = await admin();
  const { data: customers } = await supabase.from("customers").select("*").eq("user_id", userId);
  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length === 0) return null;

  let query = supabase.from("projects").select("*").in("customer_id", customerIds);
  if (projectId) query = query.eq("id", projectId);
  const { data: projects } = await query.order("created_at", { ascending: false }).limit(1);
  const project = projects?.[0];
  if (!project) return null;
  const customer = (customers ?? []).find((c) => c.id === project.customer_id)!;
  return { project, customer };
}

async function assetCounts(projectId: string): Promise<Record<string, number>> {
  const supabase = await admin();
  const { data } = await supabase.from("project_assets").select("category").eq("project_id", projectId);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

async function componentSlugs(orderId: string) {
  const supabase = await admin();
  const { data } = await supabase
    .from("order_items")
    .select("component_slug,name,pillar,recurring_monthly,one_time")
    .eq("order_id", orderId);
  return (data ?? []).map((i) => ({
    slug: i.component_slug,
    name: i.name,
    pillar: i.pillar,
    recurring: Number(i.recurring_monthly),
    oneTime: Number(i.one_time),
  }));
}

async function responseMap(projectId: string): Promise<ResponseMap> {
  const supabase = await admin();
  const { data } = await supabase
    .from("onboarding_responses")
    .select("item_key,value")
    .eq("project_id", projectId);
  const map: ResponseMap = {};
  for (const row of data ?? []) {
    const value = row.value as { value?: unknown } | null;
    map[row.item_key] = typeof value?.value === "string" ? value.value : "";
  }
  return map;
}

export async function notifyClient(options: {
  projectId: string;
  customerId: string;
  kind: string;
  title: string;
  body?: string;
  idempotencyKey: string;
}): Promise<void> {
  const supabase = await admin();
  await supabase.from("client_notifications").insert({
    project_id: options.projectId,
    customer_id: options.customerId,
    kind: options.kind,
    title: options.title,
    body: options.body ?? "",
    idempotency_key: options.idempotencyKey,
  });
}

export async function setProjectStatus(options: {
  projectId: string;
  status: string;
  note?: string;
  changedBy?: string;
}): Promise<void> {
  const supabase = await admin();
  const { data: project } = await supabase
    .from("projects")
    .select("status,customer_id")
    .eq("id", options.projectId)
    .maybeSingle();
  if (!project || project.status === options.status) return;

  await supabase.from("projects").update({ status: options.status }).eq("id", options.projectId);
  await supabase.from("project_status_history").insert({
    project_id: options.projectId,
    from_status: project.status,
    to_status: options.status,
    note: options.note ?? null,
    changed_by: options.changedBy ?? null,
  });
  await notifyClient({
    projectId: options.projectId,
    customerId: project.customer_id,
    kind: "status_changed",
    title: `Project status: ${options.status.replace(/_/g, " ")}`,
    body: options.note ?? "",
    idempotencyKey: `status:${options.projectId}:${options.status}`,
  });
}

export async function getPortalData(userId: string, userEmail: string): Promise<PortalData | null> {
  const supabase = await admin();
  const resolved = await resolveProject(userId);
  if (!resolved) return null;
  const { project, customer } = resolved;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", project.order_id)
    .maybeSingle();

  const components = order ? await componentSlugs(order.id) : [];
  const responses = await responseMap(project.id);
  const counts = await assetCounts(project.id);
  const items = itemsForComponents(components.map((c) => c.slug));
  const progress = computeProgress(items, responses, counts);

  let quoteAccessToken: string | null = null;
  let session: PortalData["session"] = null;
  if (order) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("access_token,session_id")
      .eq("id", order.quote_id)
      .maybeSingle();
    quoteAccessToken = quote ? String(quote.access_token) : null;
    if (quote?.session_id) {
      const { data: sessionRow } = await supabase
        .from("diagnostic_sessions")
        .select(
          "first_name,business_name,business_description,city,region,country,service_area,email,classification,goals",
        )
        .eq("id", quote.session_id)
        .maybeSingle();
      if (sessionRow) {
        const classification = (sessionRow.classification ?? {}) as Record<string, unknown>;
        session = {
          firstName: sessionRow.first_name,
          businessName: sessionRow.business_name,
          businessDescription: sessionRow.business_description,
          city: sessionRow.city,
          region: sessionRow.region,
          country: sessionRow.country,
          serviceArea: sessionRow.service_area,
          email: sessionRow.email,
          industry: (classification["industry"] as string) ?? null,
          specialisation: (classification["specialisation"] as string) ?? null,
          goals: (sessionRow.goals as string[]) ?? [],
        };
      }
    }
  }

  const { data: assets } = await supabase
    .from("project_assets")
    .select("*")
    .eq("project_id", project.id)
    .order("uploaded_at", { ascending: false });

  const { data: notifications } = await supabase
    .from("client_notifications")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: history } = await supabase
    .from("project_status_history")
    .select("to_status,note,created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", userId)
    .maybeSingle();

  if (project.readiness !== progress.readiness) {
    await supabase.from("projects").update({ readiness: progress.readiness }).eq("id", project.id);
  }

  return {
    profile: { email: profile?.email ?? userEmail, fullName: profile?.full_name ?? null },
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      businessName: customer.business_name,
      email: customer.email,
      country: customer.country,
      currency: customer.currency,
    },
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      readiness: progress.readiness,
      onboardingCompletedAt: project.onboarding_completed_at,
      readyForBuildAt: (project as { ready_for_build_at?: string | null }).ready_for_build_at ?? null,
    },
    order: order
      ? {
          orderNumber: order.order_number,
          currency: order.currency,
          oneTimeTotal: Number(order.one_time_total),
          recurringTotal: Number(order.recurring_total),
          amountDue: Number(order.amount_due),
          amountPaid: Number(order.amount_paid),
          status: order.status,
          quoteAccessToken,
        }
      : null,
    components,
    session,
    responses,
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      category: a.category,
      filename: a.filename,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      storagePath: a.storage_path,
      uploadedAt: a.uploaded_at,
    })),
    progress,
    notifications: (notifications ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
    statusHistory: (history ?? []).map((h) => ({
      toStatus: h.to_status,
      note: h.note,
      createdAt: h.created_at,
    })),
  };
}

/** Verified ownership check used by every mutating portal call. */
export async function assertProjectOwner(userId: string, projectId: string): Promise<{ customerId: string } | null> {
  const supabase = await admin();
  const { data: project } = await supabase
    .from("projects")
    .select("id,customer_id,status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", project.customer_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!customer) return null;
  return { customerId: customer.id };
}

export async function saveResponses(options: {
  userId: string;
  projectId: string;
  entries: { key: string; section: string; value: string }[];
}): Promise<{ ok: boolean; readiness: number }> {
  const owner = await assertProjectOwner(options.userId, options.projectId);
  if (!owner) return { ok: false, readiness: 0 };
  const supabase = await admin();

  for (const entry of options.entries) {
    await supabase.from("onboarding_responses").upsert(
      {
        project_id: options.projectId,
        section_key: entry.section,
        item_key: entry.key,
        value: { value: entry.value } as never,
      },
      { onConflict: "project_id,item_key" },
    );
  }

  const readiness = await refreshReadiness(options.projectId);
  return { ok: true, readiness };
}

export async function refreshReadiness(projectId: string): Promise<number> {
  const supabase = await admin();
  const { data: project } = await supabase
    .from("projects")
    .select("id,order_id,customer_id,status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return 0;
  const components = await componentSlugs(project.order_id);
  const items = itemsForComponents(components.map((c) => c.slug));
  const progress = computeProgress(items, await responseMap(projectId), await assetCounts(projectId));
  await supabase.from("projects").update({ readiness: progress.readiness }).eq("id", projectId);

  if (progress.readiness > 0 && project.status === "created") {
    await setProjectStatus({ projectId, status: "onboarding", note: "Client started onboarding" });
  }
  return progress.readiness;
}

export async function completeOnboarding(
  userId: string,
  projectId: string,
): Promise<{ ok: boolean; reason?: string; outstanding?: string[] }> {
  const owner = await assertProjectOwner(userId, projectId);
  if (!owner) return { ok: false, reason: "forbidden" };
  const supabase = await admin();

  const { data: project } = await supabase
    .from("projects")
    .select("id,order_id,customer_id,status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, reason: "not_found" };

  const components = await componentSlugs(project.order_id);
  const items = itemsForComponents(components.map((c) => c.slug));
  const progress = computeProgress(items, await responseMap(projectId), await assetCounts(projectId));
  if (!progress.complete) {
    return { ok: false, reason: "incomplete", outstanding: progress.outstanding.map((o) => o.label) };
  }

  const now = new Date().toISOString();
  await supabase
    .from("projects")
    .update({ readiness: 100, onboarding_completed_at: now, ready_for_build_at: now })
    .eq("id", projectId);

  await setProjectStatus({
    projectId,
    status: "ready_for_build",
    note: "Onboarding complete — brief ready",
    changedBy: userId,
  });

  await notifyClient({
    projectId,
    customerId: project.customer_id,
    kind: "onboarding_complete",
    title: "Onboarding complete",
    body: "We've received everything we need to begin building your Satphonix project.",
    idempotencyKey: `onboarding_complete:${projectId}`,
  });

  const { notifyInternal } = await import("./commerce.server");
  await notifyInternal({
    kind: "project_ready_for_build",
    subject: `Project ready for build — ${projectId}`,
    body: `Onboarding complete. ${items.length} requirements captured across ${components.length} purchased components.`,
    payload: { project_id: projectId },
    idempotencyKey: `ready_for_build:${projectId}`,
  });

  return { ok: true };
}

// ---------------------------------------------------------------- assets ---

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "video/mp4",
  "video/quicktime",
]);

const MAX_BYTES = 25 * 1024 * 1024;

export async function registerAsset(options: {
  userId: string;
  projectId: string;
  category: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const owner = await assertProjectOwner(options.userId, options.projectId);
  if (!owner) return { ok: false, reason: "forbidden" };
  if (!ALLOWED_MIME.has(options.mimeType)) return { ok: false, reason: "unsupported_type" };
  if (options.sizeBytes <= 0 || options.sizeBytes > MAX_BYTES) return { ok: false, reason: "file_too_large" };
  if (!options.storagePath.startsWith(`${options.projectId}/`)) return { ok: false, reason: "bad_path" };

  const supabase = await admin();
  const { error } = await supabase.from("project_assets").insert({
    project_id: options.projectId,
    category: options.category,
    filename: options.filename.slice(0, 200),
    mime_type: options.mimeType,
    size_bytes: options.sizeBytes,
    storage_path: options.storagePath,
    uploaded_by: options.userId,
  });
  if (error) return { ok: false, reason: error.message };
  await refreshReadiness(options.projectId);
  return { ok: true };
}

export async function deleteAsset(userId: string, assetId: string): Promise<{ ok: boolean }> {
  const supabase = await admin();
  const { data: asset } = await supabase.from("project_assets").select("*").eq("id", assetId).maybeSingle();
  if (!asset) return { ok: false };
  const owner = await assertProjectOwner(userId, asset.project_id);
  if (!owner) return { ok: false };
  await supabase.storage.from("project-assets").remove([asset.storage_path]);
  await supabase.from("project_assets").delete().eq("id", assetId);
  await refreshReadiness(asset.project_id);
  return { ok: true };
}

export async function signedAssetUrl(
  assetId: string,
  opts: { userId?: string; isAdmin?: boolean },
): Promise<string | null> {
  const supabase = await admin();
  const { data: asset } = await supabase.from("project_assets").select("*").eq("id", assetId).maybeSingle();
  if (!asset) return null;
  if (!opts.isAdmin) {
    if (!opts.userId) return null;
    const owner = await assertProjectOwner(opts.userId, asset.project_id);
    if (!owner) return null;
  }
  const { data } = await supabase.storage.from("project-assets").createSignedUrl(asset.storage_path, 300);
  return data?.signedUrl ?? null;
}

// ----------------------------------------------------------------- brief ---

export type ProjectBrief = {
  client: string;
  business: string;
  industry: string;
  location: string;
  primaryGoal: string;
  selectedSystem: { slug: string; name: string; pillar: string }[];
  requiredFeatures: { key: string; label: string; answer: string }[];
  contentStatus: string;
  assetStatus: string;
  outstandingItems: string[];
  readiness: number;
  paymentStatus: string;
  generatedAt: string;
};

/** Deterministic: rebuilt from stored data on every read, never cached stale. */
export async function buildProjectBrief(projectId: string): Promise<ProjectBrief | null> {
  const supabase = await admin();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const { data: order } = await supabase.from("orders").select("*").eq("id", project.order_id).maybeSingle();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", project.customer_id)
    .maybeSingle();

  let session: Record<string, unknown> | null = null;
  if (order) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("session_id")
      .eq("id", order.quote_id)
      .maybeSingle();
    if (quote?.session_id) {
      const { data: row } = await supabase
        .from("diagnostic_sessions")
        .select("*")
        .eq("id", quote.session_id)
        .maybeSingle();
      session = (row as Record<string, unknown>) ?? null;
    }
  }

  const components = order ? await componentSlugs(order.id) : [];
  const items = itemsForComponents(components.map((c) => c.slug));
  const responses = await responseMap(projectId);
  const counts = await assetCounts(projectId);
  const progress = computeProgress(items, responses, counts);

  const classification = (session?.["classification"] ?? {}) as Record<string, unknown>;
  const goals = (session?.["goals"] as string[]) ?? [];
  const totalAssets = Object.values(counts).reduce((a, b) => a + b, 0);
  const contentItems = items.filter((i) => i.section === "content");
  const contentDone = contentItems.filter((i) => (responses[i.key] ?? "").trim().length > 0).length;

  return {
    client: customer?.first_name ?? session?.["first_name"] ?? "—",
    business: customer?.business_name ?? (session?.["business_name"] as string) ?? "—",
    industry:
      [classification["industry"], classification["specialisation"]].filter(Boolean).join(" — ") || "—",
    location:
      [session?.["city"], session?.["region"], session?.["country"]].filter(Boolean).join(", ") || "—",
    primaryGoal: goals[0] ?? "—",
    selectedSystem: components.map((c) => ({ slug: c.slug, name: c.name, pillar: c.pillar })),
    requiredFeatures: items
      .filter((i) => i.section === "features")
      .map((i) => ({ key: i.key, label: i.label, answer: responses[i.key] ?? "" })),
    contentStatus: `${contentDone}/${contentItems.length} content fields supplied`,
    assetStatus: `${totalAssets} file${totalAssets === 1 ? "" : "s"} uploaded across ${Object.keys(counts).length} categories`,
    outstandingItems: progress.outstanding.map((o) => o.label),
    readiness: progress.readiness,
    paymentStatus: order
      ? `${order.status} — ${Number(order.amount_paid)} of ${Number(order.amount_due)} ${order.currency}`
      : "no order",
    generatedAt: new Date().toISOString(),
  } as ProjectBrief;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await admin();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .limit(1);
  return Boolean(data && data.length > 0);
}

export type AdminProjectView = {
  project: { id: string; name: string; status: string; readiness: number; createdAt: string };
  customer: { name: string | null; business: string | null; email: string };
  order: { orderNumber: string; status: string; currency: string; amountPaid: number; amountDue: number } | null;
  components: { slug: string; name: string; pillar: string }[];
  responses: { key: string; section: string; value: string }[];
  assets: PortalAsset[];
  outstanding: string[];
  brief: ProjectBrief | null;
};

export async function adminProjectView(projectId: string): Promise<AdminProjectView | null> {
  const supabase = await admin();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", project.customer_id)
    .maybeSingle();
  const { data: order } = await supabase.from("orders").select("*").eq("id", project.order_id).maybeSingle();
  const components = order ? await componentSlugs(order.id) : [];
  const { data: responseRows } = await supabase
    .from("onboarding_responses")
    .select("item_key,section_key,value")
    .eq("project_id", projectId);
  const { data: assets } = await supabase.from("project_assets").select("*").eq("project_id", projectId);
  const brief = await buildProjectBrief(projectId);

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      readiness: project.readiness ?? 0,
      createdAt: project.created_at,
    },
    customer: {
      name: customer?.first_name ?? null,
      business: customer?.business_name ?? null,
      email: customer?.email ?? "—",
    },
    order: order
      ? {
          orderNumber: order.order_number,
          status: order.status,
          currency: order.currency,
          amountPaid: Number(order.amount_paid),
          amountDue: Number(order.amount_due),
        }
      : null,
    components: components.map((c) => ({ slug: c.slug, name: c.name, pillar: c.pillar })),
    responses: (responseRows ?? []).map((r) => ({
      key: r.item_key,
      section: r.section_key,
      value: ((r.value as { value?: string })?.value ?? "") as string,
    })),
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      category: a.category,
      filename: a.filename,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      storagePath: a.storage_path,
      uploadedAt: a.uploaded_at,
    })),
    outstanding: brief?.outstandingItems ?? [],
    brief,
  };
}

export async function adminProjectList() {
  const supabase = await admin();
  const { data } = await supabase
    .from("projects")
    .select("id,name,status,readiness,created_at,customers(business_name,email)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((p) => {
    const c = (p as unknown as { customers?: { business_name?: string; email?: string } }).customers;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      readiness: (p as { readiness?: number }).readiness ?? 0,
      createdAt: p.created_at,
      business: c?.business_name ?? null,
      email: c?.email ?? "—",
    };
  });
}
