import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminShell } from "@/components/admin-shell";
import { getAdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — control centre" },
      { name: "description", content: "Internal control centre for the Satphonix Business Builder catalogue and commerce." },
      { property: "og:title", content: "Satphonix admin — control centre" },
      { property: "og:description", content: "Catalogue, pricing and commercial overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="display mt-2 text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminDashboard() {
  const load = useServerFn(getAdminStats);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-stats"], queryFn: () => load(), retry: false });

  return (
    <AdminShell>
      <p className="eyebrow">Internal</p>
      <h1 className="display mt-2 text-3xl">Control centre</h1>
      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              label="Active components"
              value={data.activeComponents}
              hint={`${data.draftComponents} draft · ${data.archivedComponents} archived`}
            />
            <Card label="Markets / currencies" value={data.markets} hint="USD, GBP, NGN, EUR" />
            <Card label="Active quotes" value={data.activeQuotes} hint="draft, sent or accepted" />
            <Card label="Paid orders" value={data.paidOrders} hint="paid or part-paid" />
            <Card label="Active projects" value={data.activeProjects} />
            <Card label="Recent leads" value={data.recentLeads.length} hint="latest diagnostic sessions" />
          </div>

          <h2 className="display mt-10 text-xl">Recent leads</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            {data.recentLeads.length === 0 && <p className="p-5 text-sm text-muted-foreground">No diagnostics yet.</p>}
            {data.recentLeads.map((lead) => (
              <div key={lead.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 p-4 last:border-0">
                <span className="text-sm font-medium">{lead.business ?? "Unnamed business"}</span>
                <span className="text-xs text-muted-foreground">
                  {lead.email ?? "no email"} · {lead.step} · {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/admin/components" className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
              Manage components
            </Link>
            <Link to="/admin/pricing" className="rounded-full border border-border px-5 py-2.5 text-sm">
              Manage pricing
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  );
}
