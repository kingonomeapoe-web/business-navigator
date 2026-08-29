import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/portal-shell";
import { adminGetProject, getAssetUrl } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/admin/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — project brief" },
      { name: "description", content: "Internal project brief: client, system, onboarding responses and assets." },
      { property: "og:title", content: "Satphonix admin — project brief" },
      { property: "og:description", content: "Everything the client submitted, in one internal view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProject,
});

function AdminProject() {
  const { projectId } = useParams({ from: "/_authenticated/admin/projects/$projectId" });
  const load = useServerFn(adminGetProject);
  const sign = useServerFn(getAssetUrl);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-project", projectId],
    queryFn: () => load({ data: { projectId } }),
  });

  if (error) {
    return (
      <PortalShell>
        <p className="text-sm text-destructive">You don't have access to this view.</p>
      </PortalShell>
    );
  }
  if (isPending || !data) {
    return (
      <PortalShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PortalShell>
    );
  }

  const { brief } = data;

  return (
    <PortalShell>
      <Link to="/admin/projects" className="text-sm text-muted-foreground underline">
        ← All projects
      </Link>
      <h1 className="display mt-3 text-3xl">{data.customer.business ?? data.project.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {data.customer.email} · {data.project.status} · {data.project.readiness}% ready
      </p>

      {brief && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="eyebrow">Project brief</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Client", brief.client],
              ["Business", brief.business],
              ["Industry", brief.industry],
              ["Location", brief.location],
              ["Primary goal", brief.primaryGoal],
              ["Content status", brief.contentStatus],
              ["Asset status", brief.assetStatus],
              ["Payment status", brief.paymentStatus],
              ["Readiness", `${brief.readiness}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {brief.outstandingItems.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium">Outstanding</p>
              <ul className="mt-1 text-sm text-muted-foreground">
                {brief.outstandingItems.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Selected system</p>
        <ul className="mt-3 space-y-1 text-sm">
          {data.components.map((component) => (
            <li key={component.slug} className="flex justify-between gap-3">
              <span>{component.name}</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{component.pillar}</span>
            </li>
          ))}
        </ul>
        {data.order && (
          <p className="mt-4 text-sm text-muted-foreground">
            {data.order.orderNumber} · {data.order.status} · {data.order.currency} {data.order.amountPaid} paid of{" "}
            {data.order.amountDue}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Onboarding responses</p>
        <dl className="mt-3 space-y-3 text-sm">
          {data.responses
            .filter((response) => response.value.trim().length > 0)
            .map((response) => (
              <div key={response.key}>
                <dt className="text-muted-foreground">
                  {response.section} / {response.key}
                </dt>
                <dd className="whitespace-pre-wrap">{response.value}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Assets</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.assets.map((asset) => (
            <li key={asset.id} className="flex items-center justify-between gap-3">
              <span className="truncate">
                {asset.category} · {asset.filename}
              </span>
              <button
                type="button"
                className="underline text-muted-foreground"
                onClick={async () => {
                  const { url } = await sign({ data: { assetId: asset.id } });
                  if (url) window.open(url, "_blank", "noopener");
                }}
              >
                Open
              </button>
            </li>
          ))}
          {data.assets.length === 0 && <li className="text-muted-foreground">No assets uploaded yet.</li>}
        </ul>
      </section>
    </PortalShell>
  );
}
