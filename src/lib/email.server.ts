/**
 * Provider-agnostic transactional email.
 *
 * Providers are chosen at runtime from the environment so no business logic is
 * coupled to a single vendor:
 *   RESEND_API_KEY  -> Resend
 *   (none)          -> "log" provider, which records the message and succeeds
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProvider = {
  name: string;
  send: (message: EmailMessage) => Promise<{ id: string }>;
};

export function getEmailProvider(): EmailProvider {
  const resendKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? "Satphonix <onboarding@resend.dev>";

  if (resendKey) {
    return {
      name: "resend",
      send: async (message) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
        });
        if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
        const body = (await response.json()) as { id?: string };
        return { id: body.id ?? "unknown" };
      },
    };
  }

  return {
    name: "log",
    send: async (message) => {
      console.info("[email:log]", message.to, message.subject);
      return { id: `log_${crypto.randomUUID()}` };
    },
  };
}

/**
 * Idempotent, retry-safe send. The same idempotency key never sends twice;
 * a previously failed attempt is retried and the delivery row records status.
 */
export async function sendTrackedEmail(options: {
  idempotencyKey: string;
  template: string;
  message: EmailMessage;
  sessionId?: string | null;
  quoteId?: string | null;
}): Promise<{ status: "sent" | "failed" | "skipped"; deliveryId: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("email_deliveries")
    .select("id,status,attempts")
    .eq("idempotency_key", options.idempotencyKey)
    .maybeSingle();

  if (existing?.status === "sent") return { status: "skipped", deliveryId: existing.id };

  let deliveryId = existing?.id ?? "";
  if (!deliveryId) {
    const { data: created, error } = await supabaseAdmin
      .from("email_deliveries")
      .insert({
        idempotency_key: options.idempotencyKey,
        to_email: options.message.to,
        template: options.template,
        session_id: options.sessionId ?? null,
        quote_id: options.quoteId ?? null,
        provider: getEmailProvider().name,
        status: "pending",
      })
      .select("id")
      .single();
    // A concurrent request may have won the unique key — treat as already handled.
    if (error) {
      const { data: raced } = await supabaseAdmin
        .from("email_deliveries")
        .select("id")
        .eq("idempotency_key", options.idempotencyKey)
        .maybeSingle();
      return { status: "skipped", deliveryId: raced?.id ?? "" };
    }
    deliveryId = created.id;
  }

  const provider = getEmailProvider();
  const attempts = (existing?.attempts ?? 0) + 1;

  try {
    const result = await provider.send(options.message);
    await supabaseAdmin
      .from("email_deliveries")
      .update({
        status: "sent",
        provider: provider.name,
        provider_message_id: result.id,
        attempts,
        error: null,
      })
      .eq("id", deliveryId);
    return { status: "sent", deliveryId };
  } catch (error) {
    await supabaseAdmin
      .from("email_deliveries")
      .update({
        status: "failed",
        provider: provider.name,
        attempts,
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", deliveryId);
    return { status: "failed", deliveryId };
  }
}
