import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { acceptQuoteFn, beginPayment, readQuote } from "@/lib/commerce.functions";
import { formatMoney, isCurrency, type CurrencyCode } from "@/lib/currency";

export const Route = createFileRoute("/q/$accessToken")({
  head: () => ({
    meta: [
      { title: "Your Satphonix quote" },
      {
        name: "description",
        content: "Review, accept and pay for the digital business system Satphonix has prepared for you.",
      },
      { property: "og:title", content: "Your Satphonix quote" },
      { property: "og:description", content: "Review, accept and pay for your Satphonix business system." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: QuotePage,
});

const money = (amount: number, currency: string) =>
  formatMoney(amount, (isCurrency(currency) ? currency : "USD") as CurrencyCode);

function QuotePage() {
  const { accessToken } = Route.useParams();
  const read = useServerFn(readQuote);
  const accept = useServerFn(acceptQuoteFn);
  const pay = useServerFn(beginPayment);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["quote", accessToken],
    queryFn: () => read({ data: { accessToken } }),
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your quote…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="display text-3xl">We couldn't find that quote.</h1>
        <p className="max-w-md text-muted-foreground">
          The link may be incomplete or the quote may have been withdrawn.
        </p>
        <Link to="/build" className="rounded-full bg-primary px-6 py-3 text-primary-foreground">
          Start a new diagnostic
        </Link>
      </div>
    );
  }

  const currency = data.currency;
  const amountPaid = data.order?.amountPaid ?? 0;
  const balance = Math.max(data.oneTimeTotal - amountPaid, 0);
  const paid = data.status === "paid" || amountPaid > 0;
  const payable = !paid && data.status === "accepted";
  const expired = data.status === "expired" || data.status === "cancelled";

  const onAccept = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await accept({
        data: { accessToken, name: name.trim() || data.firstName || "Client", email: (email || data.email || "").trim() },
      });
      if (!result.ok) {
        setError(
          result.reason === "expired"
            ? "This quote has expired. Please start a new diagnostic."
            : "We couldn't accept that quote. Please check your details.",
        );
      } else {
        await refetch();
      }
    } catch {
      setError("Please enter your full name and a valid email address.");
    } finally {
      setBusy(false);
    }
  };

  const onPay = async (plan: "deposit" | "full") => {
    setError(null);
    setBusy(true);
    try {
      const result = await pay({ data: { accessToken, plan } });
      if (result.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      setError("We couldn't open the payment page. Please try again.");
    } catch {
      setError("We couldn't open the payment page. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader minimal />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <p className="eyebrow">Quote {data.quoteNumber} · version {data.version}</p>
        <h1 className="display mt-4 text-4xl">
          {paid
            ? "You're in. Let's build it."
            : `The Satphonix system for ${data.businessName ?? "your business"}`}
        </h1>

        {paid && (
          <p className="mt-5 text-muted-foreground">
            Your payment is received and your project has been created. The next step is telling us about your brand
            so we can start building.
          </p>
        )}

        <section className="surface mt-10 p-6">
          <p className="eyebrow">What you're buying</p>
          <ul className="mt-4 space-y-2 text-sm">
            {data.items.map((item) => (
              <li key={item.slug} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                <span>{item.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {item.one_time > 0 ? money(item.one_time, currency) : "Included"}
                  {item.recurring_monthly > 0 && ` +${money(item.recurring_monthly, currency)}/m`}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-1.5 text-[15px]">
            <div className="flex justify-between">
              <dt>One-off investment</dt>
              <dd className="font-medium">{money(data.oneTimeTotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Monthly running cost</dt>
              <dd className="font-medium">{money(data.recurringTotal, currency)}/month</dd>
            </div>
            <div className="flex justify-between">
              <dt>Deposit to start (50%)</dt>
              <dd className="font-medium">{money(data.deposit, currency)}</dd>
            </div>
            {data.order && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Paid so far</dt>
                <dd>{money(data.order.amountPaid, currency)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> These prices are locked to this quote version and won't change.
          </p>
        </section>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {expired && (
          <div className="surface mt-8 p-6">
            <p className="text-[15px]">
              This quote is no longer active. Prices move, so we'd rather re-run the numbers than honour something
              out of date.
            </p>
            <Link
              to="/build"
              className="mt-5 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground"
            >
              Start a new diagnostic
            </Link>
          </div>
        )}

        {!expired && !paid && !payable && (
          <div className="surface mt-8 p-6">
            <p className="eyebrow">Accept &amp; continue</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Accepting locks this scope and these prices. Nothing is charged until you choose how to pay.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-xl border border-border bg-background px-4 py-3"
                placeholder="Your full name"
                value={name || data.firstName || ""}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="rounded-xl border border-border bg-background px-4 py-3"
                placeholder="Email address"
                type="email"
                value={email || data.email || ""}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="mt-5 w-full rounded-full bg-primary px-6 py-3.5 text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Working…" : "Accept & continue"}
            </button>
          </div>
        )}

        {payable && (
          <div className="surface mt-8 p-6">
            <p className="eyebrow">Accepted</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Accepted by {data.acceptedByName ?? "you"}
              {data.acceptedAt ? ` on ${new Date(data.acceptedAt).toLocaleDateString()}` : ""} · version {data.version}
              {data.order ? ` · order ${data.order.orderNumber}` : ""}
            </p>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => onPay("deposit")}
                className="w-full rounded-full bg-primary px-6 py-3.5 text-primary-foreground disabled:opacity-60"
              >
                Pay {money(data.deposit, currency)} deposit and start
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPay("full")}
                className="w-full rounded-full border border-border px-6 py-3.5 transition hover:bg-secondary disabled:opacity-60"
              >
                Pay the full {money(balance, currency)}
              </button>
            </div>
            {data.recurringTotal > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                The monthly running cost of {money(data.recurringTotal, currency)} starts once your system goes live.
              </p>
            )}
          </div>
        )}

        {paid && (
          <div className="surface mt-8 p-6">
            <p className="flex items-center gap-2 text-[15px]">
              <Check className="h-5 w-5 text-primary" /> Order {data.order?.orderNumber} ·{" "}
              {money(data.order?.amountPaid ?? 0, currency)} received
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Project created: {data.projectName ?? "your Satphonix system"}. A receipt is on its way to{" "}
              {data.email ?? "your email"}.
            </p>
            {balance > 0 && (
              <>
                <p className="mt-4 text-sm">
                  Remaining balance: <strong>{money(balance, currency)}</strong>, due before your system goes live.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPay("full")}
                  className="mt-4 w-full rounded-full border border-border px-6 py-3.5 transition hover:bg-secondary disabled:opacity-60"
                >
                  Pay the remaining {money(balance, currency)}
                </button>
              </>
            )}
            {data.recurringTotal > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Your monthly running cost of {money(data.recurringTotal, currency)} starts once your system goes live.
              </p>
            )}
            <a
              href={`/auth?next=%2Fportal`}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-primary-foreground"
            >
              Set up your client portal
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Create your account with {data.email ?? "the email on this order"} to confirm your details, upload your
              brand and finish onboarding. Keep this link: it's your order record.
            </p>

          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
