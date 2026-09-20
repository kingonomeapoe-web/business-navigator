import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getPublicLegalDocument } from "@/lib/content.functions";

export const Route = createFileRoute("/legal/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicLegalDocument({ data: { slug: params.slug } });
    } catch {
      return null;
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Satphonix — ${params.slug.replace(/-/g, " ")}` },
      { name: "description", content: "Satphonix Business Development policy and terms information." },
      { property: "og:title", content: "Satphonix policies" },
      { property: "og:description", content: "Terms, privacy and refund information for Satphonix Business Development." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalPage,
  errorComponent: () => <Missing />,
  notFoundComponent: () => <Missing />,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Missing() {
  return (
    <Shell>
      <h1 className="display text-3xl">This page isn't published yet</h1>
      <p className="mt-3 text-muted-foreground">
        Please get in touch and we'll send you the information you're looking for.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
        Back to the homepage
      </Link>
    </Shell>
  );
}

function LegalPage() {
  const doc = Route.useLoaderData();
  if (!doc) return <Missing />;
  return (
    <Shell>
      <h1 className="display text-3xl sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated {new Date(doc.updatedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}
      </p>
      <div className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{doc.body}</div>
    </Shell>
  );
}
