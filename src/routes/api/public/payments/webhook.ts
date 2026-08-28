import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment provider webhook. Signature-verified for real providers and
 * idempotent: duplicate events are recorded once and never applied twice.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Payload too large", { status: 413 });

        const { getPaymentProvider } = await import("@/lib/payments.server");
        const { handleProviderEvent } = await import("@/lib/commerce.server");

        const provider = getPaymentProvider();
        let event;
        try {
          event = await provider.parseWebhook(raw, request.headers);
        } catch (error) {
          console.error("webhook parse failed", error);
          return new Response("Bad request", { status: 400 });
        }
        if (!event) return new Response("Invalid signature", { status: 401 });

        const result = await handleProviderEvent(provider.name, event);
        return Response.json({ received: true, result: result.status });
      },
    },
  },
});
