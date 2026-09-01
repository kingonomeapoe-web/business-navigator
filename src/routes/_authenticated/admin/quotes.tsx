import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/quotes")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Quotes" },
      { name: "description", content: "Quotes management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Quotes" },
      { property: "og:description", content: "Quotes management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Quotes" />,
});
