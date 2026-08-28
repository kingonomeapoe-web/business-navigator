import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Info, Loader2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { buildPlan, type PlanItem } from "@/lib/builder.functions";
import { getQuoteLink } from "@/lib/commerce.functions";
import { formatMoney } from "@/lib/currency";
import { CONTENT_MULTIPLICATION, PILLARS } from "@/lib/diagnostic-content";

export const Route = createFileRoute("/plan/$token")({
  head: () => ({
    meta: [
      { title: "Your Satphonix business system" },
      {
        name: "description",
        content:
          "The personalised digital business system Satphonix recommends for your business, with a clear investment and what each part is for.",
      },
      { property: "og:title", content: "Your Satphonix business system" },
      {
        property: "og:description",
        content: "A personalised recommendation and price, built from your own answers.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: PlanPage,
});

function PlanPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const plan = useServerFn(buildPlan);
  const persistSelection = useServerFn(buildPlan);
  const quoteLink = useServerFn(getQuoteLink);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean> | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["plan", token],
    queryFn: () => plan({ data: { token } }),
  });

  const items = useMemo(() => {
    if (!data) return [];
    return data.items.map((item) => ({
      ...item,
      selected: overrides?.[item.slug] ?? item.selected,
    }));
  }, [data, overrides]);

  const chosen = items.filter((item) => item.selected && item.verdict !== "excluded");
  const oneTime = chosen.reduce((sum, item) => sum + item.one_time, 0);
  const recurring = chosen.reduce((sum, item) => sum + item.recurring_monthly, 0);

  const toggle = (slug: string, next: boolean) =>
    setOverrides((current) => ({ ...(current ?? Object.fromEntries(items.map((i) => [i.slug, i.selected]))), [slug]: next }));

  const onAcceptAndContinue = async () => {
    setAcceptError(null);
    setAccepting(true);
    try {
      const selectedSlugs = items.filter((item) => item.selected && item.verdict !== "excluded").map((i) => i.slug);
      const saved = await persistSelection({ data: { token, selected: selectedSlugs, persistQuote: true } });
      const accessToken = saved.accessToken ?? (await quoteLink({ data: { token } })).accessToken;
      if (!accessToken) throw new Error("no quote");
      navigate({ to: "/q/$accessToken", params: { accessToken } });
    } catch {
      setAcceptError("We couldn't open your quote. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Building your recommendation…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="display text-3xl">We couldn't find that diagnostic.</h1>
        <Link to="/build" className="rounded-full bg-primary px-6 py-3 text-primary-foreground">
          Start again
        </Link>
      </div>
    );
  }

  const { session, currency } = data;
  const businessName = session.business_name ?? "Your business";
  const excluded = items.filter((item) => item.verdict === "excluded");
  const optional = items.filter((item) => item.verdict === "optional" && !item.selected);

  return (
    <div className="min-h-screen">
      <SiteHeader minimal />

      <main className="mx-auto w-full max-w-5xl px-5 py-14">
        <p className="eyebrow">{session.first_name ? `${session.first_name}, here it is` : "Your recommendation"}</p>
        <h1 className="display mt-4 text-4xl sm:text-5xl">The Satphonix system for {businessName}</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Built from your own answers. Everything here has a reason attached — and anything that isn't right for you is
          marked as such.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {PILLARS.map((pillar) => {
              const pillarItems = items.filter((item) => item.pillar === pillar.key && item.verdict !== "excluded");
              if (pillarItems.length === 0) return null;
              return (
                <section key={pillar.key}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-2xl">{pillar.name}</h2>
                    <p className="text-sm text-muted-foreground">{pillar.promise}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {pillarItems.map((item) => (
                      <ItemRow key={item.slug} item={item} currency={currency} onToggle={toggle} />
                    ))}
                  </div>
                </section>
              );
            })}

            {excluded.length > 0 && (
              <section>
                <h2 className="text-2xl">Not recommended for {businessName} right now</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We'd rather tell you what you don't need than sell it to you.
                </p>
                <div className="mt-4 space-y-3">
                  {excluded.map((item) => (
                    <div key={item.slug} className="rounded-xl border border-dashed border-border p-5">
                      <p className="text-[15px] font-medium">{item.name}</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="surface p-6">
              <p className="eyebrow">How content works here</p>
              <p className="mt-3 text-[15px] text-muted-foreground">
                One idea from your business doesn't stay one thing.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONTENT_MULTIPLICATION.map((entry, index) => (
                  <span
                    key={entry}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      index === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="surface p-6">
              <p className="eyebrow">Your recommended investment</p>
              <p className="display mt-3 text-4xl">{formatMoney(oneTime, currency)}</p>
              {recurring > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  plus {formatMoney(recurring, currency)}/month for ongoing growth and running costs
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Quote {data.quoteNumber} · {chosen.length} parts · prices in {currency}
              </p>

              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                <Info className="h-4 w-4" />
                {expanded ? "Hide the detail" : "See what's included"}
              </button>

              {expanded && (
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  {chosen.map((item) => (
                    <li key={item.slug} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="shrink-0">
                        {item.one_time > 0 ? formatMoney(item.one_time, currency) : "—"}
                        {item.recurring_monthly > 0 && (
                          <span className="text-muted-foreground"> +{formatMoney(item.recurring_monthly, currency)}/m</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  disabled={accepting}
                  onClick={onAcceptAndContinue}
                  className="w-full rounded-full bg-primary px-5 py-3.5 text-base font-medium text-primary-foreground disabled:opacity-60"
                >
                  {accepting ? "Preparing your quote…" : "Accept & continue"}
                </button>
                <button className="w-full rounded-full px-5 py-3 text-sm text-muted-foreground transition hover:text-foreground">
                  Talk to Satphonix first
                </button>
              </div>
              {acceptError && <p className="mt-3 text-sm text-destructive">{acceptError}</p>}
              <p className="mt-4 text-xs text-muted-foreground">
                Accepting locks this scope and price. You'll choose between a 50% deposit and paying in full on the
                next screen.
              </p>
            </div>

            {optional.length > 0 && (
              <div className="surface mt-4 p-6">
                <p className="eyebrow">You could also add</p>
                <div className="mt-3 space-y-3">
                  {optional.slice(0, 4).map((item) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => toggle(item.slug, true)}
                      className="w-full rounded-lg border border-border p-3 text-left transition hover:border-ring/60"
                    >
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function ItemRow({
  item,
  currency,
  onToggle,
}: {
  item: PlanItem;
  currency: Parameters<typeof formatMoney>[1];
  onToggle: (slug: string, next: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition ${
        item.selected ? "border-primary/40 bg-card" : "border-border bg-card/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-medium">{item.name}</p>
            {item.verdict === "recommended" && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{item.client_explanation}</p>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">We recommend this because </span>
            {item.reason.charAt(0).toLowerCase() + item.reason.slice(1)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm">
            {item.one_time > 0 ? formatMoney(item.one_time, currency) : "Included"}
          </p>
          {item.recurring_monthly > 0 && (
            <p className="text-xs text-muted-foreground">{formatMoney(item.recurring_monthly, currency)}/month</p>
          )}
          <button
            type="button"
            onClick={() => onToggle(item.slug, !item.selected)}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
              item.selected
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {item.selected ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {item.selected ? "Remove" : "Add to my system"}
          </button>
          {item.selected && (
            <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-primary">
              <Check className="h-3 w-3" /> In your system
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
