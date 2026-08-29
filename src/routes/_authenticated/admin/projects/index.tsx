import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/portal-shell";
import { adminListProjects } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/admin/projects/")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — projects" },
      { name: "description", content: "Internal view of client projects, onboarding readiness and order status." },
      { property: "og:title", content: "Satphonix admin — projects" },
      { property: "og:description", content: "Internal project and onboarding overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProjects,
});

function AdminProjects() {
  const load = useServerFn(adminListProjects);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-projects"], queryFn: () => load() });

  return (
    <PortalShell>
      <p className="eyebrow">Internal</p>
      <h1 className="display mt-2 text-3xl">Projects</h1>
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}
      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      <div className="mt-6 space-y-3">
        {(data ?? []).map((project) => (
          <Link
            key={project.id}
            to="/admin/projects/$projectId"
            params={{ projectId: project.id }}
            className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{project.business ?? project.name}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{project.status}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.email} · {project.readiness}% ready
            </p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
