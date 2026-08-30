import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { adminOptions, getAdminComponent, saveAdminComponent, setAdminComponentStatus } from "@/lib/admin.functions";
import type { ComponentInput } from "@/lib/admin-schemas";

export const Route = createFileRoute("/_authenticated/admin/components/$id")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — component editor" },
      { name: "description", content: "Edit component identity, client-facing copy, internal notes, relationships and preview." },
      { property: "og:title", content: "Satphonix admin — component editor" },
      { property: "og:description", content: "Component editor and client preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ComponentEditor,
});

const empty: ComponentInput = {
  name: "",
  slug: "",
  pillar: "look",
  status: "draft",
  short_description: "",
  client_explanation: "",
  detailed_explanation: "",
  internal_notes: "",
  icon: "sparkles",
  image_url: "",
  display_order: 100,
  featured: false,
  is_core: false,
  recommendation_reason: "",
  upsell_message: "",
  priority: 50,
  pricing_model: "fixed",
  has_one_time: true,
  has_recurring: false,
  industry_ids: [],
  dependencies: [],
};

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
  </label>
);

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function ComponentEditor() {
  const { id } = useParams({ from: "/_authenticated/admin/components/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loadComponent = useServerFn(getAdminComponent);
  const loadOptions = useServerFn(adminOptions);
  const save = useServerFn(saveAdminComponent);
  const setStatus = useServerFn(setAdminComponentStatus);

  const { data: options } = useQuery({ queryKey: ["admin-options"], queryFn: () => loadOptions(), retry: false });
  const { data: detail } = useQuery({
    queryKey: ["admin-component", id],
    queryFn: () => loadComponent({ data: { id } }),
    enabled: !isNew,
    retry: false,
  });

  const [form, setForm] = useState<ComponentInput>(empty);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    const c = detail.component as Record<string, any>;
    setForm({
      id: c["id"],
      name: c["name"] ?? "",
      slug: c["slug"] ?? "",
      pillar: c["pillar"] ?? "look",
      status: c["status"] ?? "active",
      short_description: c["short_description"] ?? "",
      client_explanation: c["client_explanation"] ?? "",
      detailed_explanation: c["detailed_explanation"] ?? "",
      internal_notes: c["internal_notes"] ?? "",
      icon: c["icon"] ?? "sparkles",
      image_url: c["image_url"] ?? "",
      display_order: c["display_order"] ?? 100,
      featured: Boolean(c["featured"]),
      is_core: Boolean(c["is_core"]),
      recommendation_reason: c["recommendation_reason"] ?? "",
      upsell_message: c["upsell_message"] ?? "",
      priority: c["priority"] ?? 50,
      pricing_model: c["pricing_model"] ?? "fixed",
      has_one_time: Boolean(c["has_one_time"]),
      has_recurring: Boolean(c["has_recurring"]),
      industry_ids: detail.industryIds,
      dependencies: detail.dependencies.map((d) => ({ related_component_id: d.related_component_id, kind: d.kind as never })),
    });
  }, [detail]);

  const set = <K extends keyof ComponentInput>(key: K, value: ComponentInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => save({ data: form }),
    onSuccess: async (result) => {
      setMessage("Saved. New plans use this immediately; accepted quotes are unchanged.");
      await queryClient.invalidateQueries({ queryKey: ["admin-components"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-component"] });
      if (isNew) await navigate({ to: "/admin/components/$id", params: { id: result.id } });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const archive = useMutation({
    mutationFn: async () => setStatus({ data: { id, status: "archived" } }),
    onSuccess: async () => {
      setMessage("Component archived. Historical quotes and orders are untouched.");
      set("status", "archived");
      await queryClient.invalidateQueries({ queryKey: ["admin-components"] });
    },
  });

  const otherComponents = useMemo(() => (options?.components ?? []).filter((c) => c.id !== form.id), [options, form.id]);

  const previewPrice = useMemo(() => {
    const price = detail?.prices.find((p) => p.currency === "GBP" && p.active) ?? detail?.prices.find((p) => p.active);
    return price ?? null;
  }, [detail]);

  const toggleDependency = (componentId: string, kind: "requires" | "conflicts" | "related") => {
    setForm((f) => {
      const exists = f.dependencies.some((d) => d.related_component_id === componentId && d.kind === kind);
      return {
        ...f,
        dependencies: exists
          ? f.dependencies.filter((d) => !(d.related_component_id === componentId && d.kind === kind))
          : [...f.dependencies, { related_component_id: componentId, kind }],
      };
    });
  };

  return (
    <AdminShell breadcrumbs={[{ label: "Components", to: "/admin/components" }, { label: isNew ? "New" : form.name || "Edit" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="display mt-2 text-3xl">{isNew ? "New component" : form.name || "Component"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && detail?.inUse && (
            <span className="self-center text-xs text-muted-foreground">In commercial history — archive only</span>
          )}
          {!isNew && form.status !== "archived" && (
            <button type="button" onClick={() => archive.mutate()} className="rounded-full border border-border px-4 py-2 text-sm">
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">{message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">Identity</h2>
            <Field label="Name">
              <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Slug" hint="Used by the recommendation engine — changing it breaks existing rules.">
              <input className={input} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pillar">
                <select className={input} value={form.pillar} onChange={(e) => set("pillar", e.target.value as never)}>
                  <option value="look">LOOK</option>
                  <option value="attract">ATTRACT</option>
                  <option value="convert">CONVERT</option>
                  <option value="run">RUN</option>
                </select>
              </Field>
              <Field label="Lifecycle">
                <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as never)}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>
            <Field label="Short description (client)">
              <textarea className={input} rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} />
            </Field>
            <Field label="Client-facing explanation">
              <textarea className={input} rows={3} value={form.client_explanation} onChange={(e) => set("client_explanation", e.target.value)} />
            </Field>
            <Field label="Detailed explanation (client)">
              <textarea className={input} rows={4} value={form.detailed_explanation} onChange={(e) => set("detailed_explanation", e.target.value)} />
            </Field>
            <Field label="Internal notes" hint="Never shown to clients.">
              <textarea className={input} rows={3} value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">Presentation</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Icon">
                <input className={input} value={form.icon} onChange={(e) => set("icon", e.target.value)} />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={input}
                  value={form.display_order}
                  onChange={(e) => set("display_order", Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Image URL">
              <input className={input} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_core} onChange={(e) => set("is_core", e.target.checked)} /> Core
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">Recommendation</h2>
            <Field label="Recommendation reason (client)">
              <textarea
                className={input}
                rows={3}
                value={form.recommendation_reason}
                onChange={(e) => set("recommendation_reason", e.target.value)}
              />
            </Field>
            <Field label="Upsell message">
              <textarea className={input} rows={2} value={form.upsell_message} onChange={(e) => set("upsell_message", e.target.value)} />
            </Field>
            <Field label="Priority" hint="Higher priority items appear first among equals.">
              <input type="number" className={input} value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">Commercial</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.has_one_time} onChange={(e) => set("has_one_time", e.target.checked)} /> Has one-time
                price
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.has_recurring} onChange={(e) => set("has_recurring", e.target.checked)} /> Has recurring
                price
              </label>
            </div>
            <Field label="Pricing model">
              <select className={input} value={form.pricing_model} onChange={(e) => set("pricing_model", e.target.value as never)}>
                <option value="fixed">Fixed</option>
                <option value="from">From</option>
                <option value="quote">On quotation</option>
              </select>
            </Field>
            <p className="text-xs text-muted-foreground">Amounts and setup fees per market are edited on the pricing page.</p>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">Relationships</h2>
            <p className="text-xs text-muted-foreground">Circular “requires” chains are rejected on save.</p>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-2">Component</th>
                    <th className="p-2">Requires</th>
                    <th className="p-2">Conflicts</th>
                    <th className="p-2">Related</th>
                  </tr>
                </thead>
                <tbody>
                  {otherComponents.map((c) => (
                    <tr key={c.id} className="border-t border-border/50">
                      <td className="p-2">{c.name}</td>
                      {(["requires", "conflicts", "related"] as const).map((kind) => (
                        <td key={kind} className="p-2">
                          <input
                            type="checkbox"
                            checked={form.dependencies.some((d) => d.related_component_id === c.id && d.kind === kind)}
                            onChange={() => toggleDependency(c.id, kind)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Field label="Industry relevance">
              <div className="flex flex-wrap gap-2">
                {(options?.industries ?? []).map((industry) => {
                  const on = form.industry_ids.includes(industry.id);
                  return (
                    <button
                      key={industry.id}
                      type="button"
                      onClick={() =>
                        set(
                          "industry_ids",
                          on ? form.industry_ids.filter((i) => i !== industry.id) : [...form.industry_ids, industry.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}
                    >
                      {industry.name}
                    </button>
                  );
                })}
                {(options?.industries ?? []).length === 0 && <span className="text-xs text-muted-foreground">No industries yet.</span>}
              </div>
            </Field>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">Client preview</p>
            <div className="mt-4 rounded-xl border border-border/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{form.pillar}</p>
              <h3 className="display mt-1 text-lg">{form.name || "Component name"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{form.short_description || "Short description appears here."}</p>
              {form.client_explanation && <p className="mt-3 text-sm">{form.client_explanation}</p>}
              {form.recommendation_reason && (
                <p className="mt-3 rounded-lg bg-accent/10 p-3 text-sm">Why this: {form.recommendation_reason}</p>
              )}
              <p className="mt-4 text-sm font-medium">
                {previewPrice
                  ? `${formatMoney(previewPrice.one_time, (detail?.prices.find((p) => p.active)?.currency ?? "USD") as CurrencyCode)}${
                      previewPrice.recurring_monthly > 0
                        ? ` + ${formatMoney(previewPrice.recurring_monthly, (detail?.prices.find((p) => p.active)?.currency ?? "USD") as CurrencyCode)}/month`
                        : ""
                    }`
                  : "No price set yet"}
              </p>
              <button type="button" className="mt-4 w-full rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                Add to my system
              </button>
            </div>
            {form.upsell_message && <p className="mt-3 text-xs text-muted-foreground">Upsell: {form.upsell_message}</p>}
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
