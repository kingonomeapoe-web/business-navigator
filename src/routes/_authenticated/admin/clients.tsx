import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Clients" },
      { name: "description", content: "Clients management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Clients" },
      { property: "og:description", content: "Clients management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Clients" />,
});
