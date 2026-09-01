import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Questions" },
      { name: "description", content: "Questions management for the Satphonix Business Builder admin control centre." },
      { property: "og:title", content: "Satphonix admin — Questions" },
      { property: "og:description", content: "Questions management, arriving in a later phase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ComingSoon title="Questions" />,
});
