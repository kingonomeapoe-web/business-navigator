import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { listAdminComponents } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/components/")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — components" },
      { name: "description", content: "Manage the Satphonix component catalogue: pillars, copy, lifecycle and pricing availability." },
      { property: "og:title", content: "Satphonix admin — components" },
      { property: "og:description", content: "Component catalogue management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminComponents,
});

const PILLARS = ["look", "attract", "convert", "run"] as const;

function AdminComponents() {
  const load = useServerFn(listAdminComponents);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-components"], queryFn: () => load(), retry: false });
  const [pillar, setPillar] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter(
      (c) =>
        (pillar === "all" || c.pillar === pillar) &&
        (status === "all" || c.status === status) &&
        (!term || c.name.toLowerCase().includes(term) || c.slug.includes(term)),
    );
  }, [data, pillar, status, search]);

  return (
    <AdminShell breadcrumbs={[{ label: "Components" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="display mt-2 text-3xl">Components</h1>
        </div>
        <Link to="/admin/components/$id" params={{ id: "new" }} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
          New component
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select value={pillar} onChange={(e) => setPillar(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="all">All pillars</option>
          {PILLARS.map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Pillar</th>
              <th className="p-3">Status</th>
              <th className="p-3">One-time</th>
              <th className="p-3">Recurring</th>
              <th className="p-3">Updated</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.slug}</span>
                </td>
                <td className="p-3 uppercase text-xs tracking-wider text-muted-foreground">{c.pillar}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.status === "active"
                        ? "bg-primary/10 text-foreground"
                        : c.status === "draft"
                          ? "bg-accent/15 text-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{c.hasOneTime ? "Yes" : "—"}</td>
                <td className="p-3 text-muted-foreground">{c.hasRecurring ? "Yes" : "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <Link to="/admin/components/$id" params={{ id: c.id }} className="text-sm underline underline-offset-4">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!isPending && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-5 text-sm text-muted-foreground">
                  No components match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
