import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { completeMockPayment } from "@/lib/commerce.functions";

/**
 * Stand-in checkout used when no live payment provider is configured.
 * It routes through the same idempotent event handler as the real webhook.
 */
export const Route = createFileRoute("/pay/mock/$paymentId")({
  head: () => ({
    meta: [
      { title: "Test checkout — Satphonix" },
      { name: "description", content: "Simulated checkout used while a live payment provider is not configured." },
      { property: "og:title", content: "Test checkout — Satphonix" },
      { property: "og:description", content: "Simulated Satphonix checkout." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: MockCheckout,
});

function MockCheckout() {
  const { paymentId } = Route.useParams();
  const navigate = useNavigate();
  const complete = useServerFn(completeMockPayment);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (outcome: "succeeded" | "failed") => {
    setBusy(true);
    try {
      const result = await complete({ data: { paymentId, outcome } });
      setMessage(`Payment ${outcome} (${result.status}).`);
      if (result.accessToken) {
        navigate({ to: "/q/$accessToken", params: { accessToken: result.accessToken } });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="surface w-full max-w-md p-8 text-center">
        <p className="eyebrow">Test checkout</p>
        <h1 className="display mt-3 text-2xl">No live payment provider is configured</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use these controls to exercise the payment flow end to end.
        </p>
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => run("succeeded")}
            className="w-full rounded-full bg-primary px-6 py-3.5 text-primary-foreground disabled:opacity-60"
          >
            Simulate a successful payment
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("failed")}
            className="w-full rounded-full border border-border px-6 py-3.5 disabled:opacity-60"
          >
            Simulate a failed payment
          </button>
        </div>
        {message && <p className="mt-5 text-sm">{message}</p>}
      </div>
    </div>
  );
}
