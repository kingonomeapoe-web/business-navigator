import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Settings" },
      { name: "description", content: "Settings management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Settings" },
      { property: "og:description", content: "Settings management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Settings" />,
});
