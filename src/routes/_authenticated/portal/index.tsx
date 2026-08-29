import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";

import { PortalShell, ProgressBar } from "@/components/portal-shell";
import { formatMoney, isCurrency, type CurrencyCode } from "@/lib/currency";
import { PROJECT_STAGES } from "@/lib/onboarding-content";
import { getPortal } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "Your Satphonix project dashboard" },
      {
        name: "description",
        content: "Track your Satphonix project status, onboarding progress, payment summary and next required action.",
      },
      { property: "og:title", content: "Your Satphonix project dashboard" },
      { property: "og:description", content: "Project status, onboarding progress and payment summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PortalDashboard,
});

const money = (amount: number, currency: string) =>
  formatMoney(amount, (isCurrency(currency) ? currency : "USD") as CurrencyCode);

function PortalDashboard() {
  const load = useServerFn(getPortal);
  const { data, isPending } = useQuery({ queryKey: ["portal"], queryFn: () => load() });

  if (isPending) {
    return (
      <PortalShell>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your project…
        </div>
      </PortalShell>
    );
  }

  if (!data) {
    return (
      <PortalShell>
        <h1 className="display text-3xl">No project found on this account</h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          We couldn't find a paid Satphonix order for this email address. If you paid using a different email, sign in
          with that one — or open your quote link and complete payment.
        </p>
        <Link to="/build" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground">
          Start a diagnostic
        </Link>
      </PortalShell>
    );
  }

  const { project, order, progress, components, customer, session } = data;
  const stageIndex = Math.max(
    PROJECT_STAGES.findIndex((s) => s.key === project.status),
    0,
  );
  const unread = data.notifications.filter((n) => !n.readAt);
  const balance = order ? Math.max(order.amountDue - order.amountPaid, 0) : 0;

  return (
    <PortalShell>
      <p className="eyebrow">{customer.businessName ?? session?.businessName ?? "Your business"}</p>
      <h1 className="display mt-2 text-3xl sm:text-4xl">{project.name}</h1>

      {unread.length > 0 && (
        <div className="mt-6 space-y-2">
          {unread.slice(0, 3).map((n) => (
            <div key={n.id} className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
            </div>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">Production readiness</p>
          <p className="display text-3xl">{progress.readiness}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress.readiness} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {progress.complete
            ? "Everything we need is in. Your brief is ready for the build team."
            : `${progress.outstanding.length} item${progress.outstanding.length === 1 ? "" : "s"} still needed.`}
        </p>
        {!progress.complete && (
          <>
            <p className="mt-4 text-sm font-medium">Next: {progress.outstanding[0]?.label}</p>
            <Link
              to="/portal/onboarding"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Continue onboarding <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
        {progress.complete && (
          <Link
            to="/portal/onboarding"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium"
          >
            Review what you sent us
          </Link>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Project timeline</p>
        <ol className="mt-4 space-y-3">
          {PROJECT_STAGES.map((stage, index) => {
            const done = index < stageIndex;
            const current = index === stageIndex;
            return (
              <li key={stage.key} className="flex items-center gap-3 text-sm">
                {done ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : (
                  <Circle className={`h-4 w-4 ${current ? "fill-accent text-accent" : "text-muted-foreground/40"}`} />
                )}
                <span className={current ? "font-medium" : done ? "" : "text-muted-foreground"}>{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="eyebrow">Your system</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {components.map((c) => (
              <li key={c.slug} className="flex justify-between gap-3">
                <span>{c.name}</span>
                <span className="text-muted-foreground uppercase text-[11px] tracking-wider">{c.pillar}</span>
              </li>
            ))}
          </ul>
        </div>

        {order && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="eyebrow">Payment</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Order</dt>
                <dd>{order.orderNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{money(order.amountPaid, order.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Balance</dt>
                <dd>{money(balance, order.currency)}</dd>
              </div>
              {order.recurringTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Monthly</dt>
                  <dd>{money(order.recurringTotal, order.currency)}</dd>
                </div>
              )}
            </dl>
            {order.quoteAccessToken && (
              <a
                href={`/q/${order.quoteAccessToken}`}
                className="mt-4 inline-block text-sm underline text-muted-foreground"
              >
                View your order record
              </a>
            )}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
