import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Content" },
      { name: "description", content: "Content management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Content" },
      { property: "og:description", content: "Content management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Content" />,
});
