import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/industries")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Industries" },
      { name: "description", content: "Industries management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Industries" },
      { property: "og:description", content: "Industries management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Industries" />,
});
