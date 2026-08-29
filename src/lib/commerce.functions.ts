import { createServerFn } from "@tanstack/react-start";

import {
  acceptQuoteSchema,
  accessTokenSchema,
  emailCaptureSchema,
  mockPaymentSchema,
  sendQuoteSchema,
  startPaymentSchema,
} from "./commerce-schemas";
import type { QuoteView } from "./commerce.server";

/** A. Lead capture — email + consent stored against the anonymous session. */
export const captureEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emailCaptureSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normaliseEmail } = await import("./commerce.server");
    const { checkRateLimit } = await import("./rate-limit.server");

    const gate = await checkRateLimit({
      bucket: "email_capture",
      subject: data.token,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!gate.ok) throw new Error("Too many attempts. Please try again shortly.");

    const { error } = await supabaseAdmin
      .from("diagnostic_sessions")
      .update({
        email: normaliseEmail(data.email),
        email_consent: data.consent,
        marketing_opt_in: data.marketingOptIn ?? false,
        email_captured_at: new Date().toISOString(),
      })
      .eq("session_token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** D. Quote email — idempotent, provider-agnostic. */
export const emailQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendQuoteSchema.parse(input))
  .handler(async ({ data }): Promise<{ status: string; accessToken: string | null }> => {
    const { sendQuoteEmail } = await import("./commerce.server");
    const { checkRateLimit } = await import("./rate-limit.server");
    const gate = await checkRateLimit({
      bucket: "quote_email",
      subject: data.token,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!gate.ok) return { status: "rate_limited", accessToken: null };
    return sendQuoteEmail(data.token);
  });

/** C. Secure resumable quote read, keyed on a 48-hex-char access token. */
export const readQuote = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => accessTokenSchema.parse(input))
  .handler(async ({ data }): Promise<QuoteView | null> => {
    const { getQuoteView } = await import("./commerce.server");
    return getQuoteView(data.accessToken);
  });

/** Resolve the private quote link for a diagnostic session. */
export const getQuoteLink = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => sendQuoteSchema.parse(input))
  .handler(async ({ data }): Promise<{ accessToken: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("diagnostic_sessions")
      .select("id")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!session) return { accessToken: null };
    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("access_token")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { accessToken: quote ? String(quote.access_token) : null };
  });

/** E. Acceptance — freezes the quote version. */
export const acceptQuoteFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => acceptQuoteSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; view?: QuoteView }> => {
    const { acceptQuote } = await import("./commerce.server");
    const { checkRateLimit } = await import("./rate-limit.server");
    const gate = await checkRateLimit({
      bucket: "quote_accept",
      subject: data.accessToken,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!gate.ok) return { ok: false, reason: "rate_limited" };
    const result = await acceptQuote(data);
    return result.ok ? { ok: true, view: result.view } : { ok: false, reason: result.reason };
  });

/** F. Payment initiation — amounts always come from the accepted version. */
export const beginPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => startPaymentSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; url?: string; reason?: string }> => {
    const { startPayment } = await import("./commerce.server");
    const { checkRateLimit } = await import("./rate-limit.server");
    const gate = await checkRateLimit({
      bucket: "payment_start",
      subject: data.accessToken,
      limit: 15,
      windowSeconds: 3600,
    });
    if (!gate.ok) return { ok: false, reason: "rate_limited" };
    const result = await startPayment(data);
    return result.ok ? { ok: true, url: result.url } : { ok: false, reason: result.reason };
  });

/**
 * Test/local provider only: routes a simulated result through exactly the same
 * idempotent event path the real webhook uses.
 */
export const completeMockPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mockPaymentSchema.parse(input))
  .handler(async ({ data }): Promise<{ status: string; accessToken: string | null }> => {
    if (process.env["STRIPE_SECRET_KEY"]) return { status: "disabled", accessToken: null };
    const { handleProviderEvent } = await import("./commerce.server");
    const result = await handleProviderEvent("mock", {
      eventId: `mock_${data.paymentId}_${data.outcome}`,
      type: `mock.payment.${data.outcome}`,
      reference: `mock_${data.paymentId}`,
      paymentId: data.paymentId,
      status: data.outcome,
      amount: null,
      currency: null,
      payload: { payment_id: data.paymentId, outcome: data.outcome },
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("order_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    let accessToken: string | null = null;
    if (payment) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("quote_id")
        .eq("id", payment.order_id)
        .maybeSingle();
      if (order) {
        const { data: quote } = await supabaseAdmin
          .from("quotes")
          .select("access_token")
          .eq("id", order.quote_id)
          .maybeSingle();
        accessToken = quote?.access_token ?? null;
      }
    }
    return { status: result.status, accessToken };
  });
