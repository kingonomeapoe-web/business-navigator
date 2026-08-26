/**
 * Provider-agnostic payments.
 *
 * Business logic never talks to a vendor SDK: it asks for a checkout for a
 * given amount/currency (always taken from an immutable accepted quote
 * version) and later receives a normalised provider event.
 *
 *   STRIPE_SECRET_KEY -> Stripe Checkout (webhook verified with STRIPE_WEBHOOK_SECRET)
 *   (none)            -> "mock" provider used for local/e2e testing
 */

export type CheckoutRequest = {
  paymentId: string;
  amount: number;
  currency: string;
  kind: "deposit" | "full" | "balance" | "recurring";
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type NormalisedEvent = {
  eventId: string;
  type: string;
  reference: string;
  paymentId: string | null;
  status: "succeeded" | "failed" | "cancelled";
  amount: number | null;
  currency: string | null;
  payload: Record<string, unknown>;
};

export type PaymentProvider = {
  name: string;
  createCheckout: (request: CheckoutRequest) => Promise<{ url: string; reference: string }>;
  parseWebhook: (raw: string, headers: Headers) => Promise<NormalisedEvent | null>;
};

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);

function toMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

function fromMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100;
}

async function verifyStripeSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim() ?? "", value ?? ""];
    }),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function stripeProvider(secretKey: string): PaymentProvider {
  return {
    name: "stripe",
    createCheckout: async (request) => {
      const body = new URLSearchParams();
      body.set("mode", "payment");
      body.set("success_url", request.successUrl);
      body.set("cancel_url", request.cancelUrl);
      body.set("customer_email", request.customerEmail);
      body.set("client_reference_id", request.paymentId);
      body.set("metadata[payment_id]", request.paymentId);
      body.set("line_items[0][quantity]", "1");
      body.set("line_items[0][price_data][currency]", request.currency.toLowerCase());
      body.set("line_items[0][price_data][unit_amount]", String(toMinorUnits(request.amount, request.currency)));
      body.set("line_items[0][price_data][product_data][name]", request.description);

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `checkout_${request.paymentId}`,
        },
        body,
      });
      if (!response.ok) throw new Error(`Stripe error ${response.status}: ${await response.text()}`);
      const session = (await response.json()) as { id: string; url: string };
      return { url: session.url, reference: session.id };
    },
    parseWebhook: async (raw, headers) => {
      const secret = process.env["STRIPE_WEBHOOK_SECRET"];
      if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
      const valid = await verifyStripeSignature(raw, headers.get("stripe-signature"), secret);
      if (!valid) return null;

      const event = JSON.parse(raw) as {
        id: string;
        type: string;
        data: { object: Record<string, unknown> };
      };
      const object = event.data.object;
      const metadata = (object["metadata"] as Record<string, string> | undefined) ?? {};
      const paymentId = metadata["payment_id"] ?? (object["client_reference_id"] as string | undefined) ?? null;
      const currency = ((object["currency"] as string | undefined) ?? "").toUpperCase() || null;
      const rawAmount = Number(object["amount_total"] ?? object["amount"] ?? 0);

      const status =
        event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded"
          ? "succeeded"
          : event.type === "checkout.session.expired"
            ? "cancelled"
            : "failed";

      return {
        eventId: event.id,
        type: event.type,
        reference: String(object["id"] ?? event.id),
        paymentId,
        status,
        amount: currency ? fromMinorUnits(rawAmount, currency) : null,
        currency,
        payload: event as unknown as Record<string, unknown>,
      };
    },
  };
}

function mockProvider(): PaymentProvider {
  return {
    name: "mock",
    createCheckout: async (request) => ({
      url: `/pay/mock/${request.paymentId}`,
      reference: `mock_${request.paymentId}`,
    }),
    parseWebhook: async (raw) => {
      const event = JSON.parse(raw) as {
        id?: string;
        type?: string;
        payment_id?: string;
        status?: NormalisedEvent["status"];
        amount?: number;
        currency?: string;
      };
      if (!event.payment_id) return null;
      return {
        eventId: event.id ?? `mock_${event.payment_id}_${event.status ?? "succeeded"}`,
        type: event.type ?? "mock.payment",
        reference: `mock_${event.payment_id}`,
        paymentId: event.payment_id,
        status: event.status ?? "succeeded",
        amount: event.amount ?? null,
        currency: event.currency ?? null,
        payload: event as Record<string, unknown>,
      };
    },
  };
}

export function getPaymentProvider(name?: string): PaymentProvider {
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (name === "mock") return mockProvider();
  if (name === "stripe" || (!name && stripeKey)) {
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    return stripeProvider(stripeKey);
  }
  return mockProvider();
}
