/**
 * Commerce core: quote lifecycle, immutable versions, acceptance, orders,
 * payments and post-payment provisioning. Server-only.
 */
import { sendTrackedEmail } from "./email.server";
import { getPaymentProvider, type NormalisedEvent } from "./payments.server";

export type QuoteItem = {
  slug: string;
  name: string;
  pillar: string;
  quantity: number;
  one_time: number;
  recurring_monthly: number;
};

export type QuoteSnapshot = {
  currency: string;
  items: QuoteItem[];
  oneTimeTotal: number;
  recurringTotal: number;
  deposit: number;
};

export type QuoteView = {
  quoteNumber: string;
  accessToken: string;
  status: string;
  version: number;
  currency: string;
  items: QuoteItem[];
  oneTimeTotal: number;
  recurringTotal: number;
  deposit: number;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByName: string | null;
  firstName: string | null;
  businessName: string | null;
  email: string | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    paymentPlan: string;
  } | null;
  projectName: string | null;
};

const LOCKED_STATUSES = new Set(["accepted", "partially_paid", "paid", "cancelled"]);

export function appBaseUrl(): string {
  return (
    process.env["APP_BASE_URL"] ??
    "https://project--8aec8414-5850-4b93-98f8-75041adaa08c.lovable.app"
  );
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isQuoteLocked(status: string): boolean {
  return LOCKED_STATUSES.has(status);
}

async function hashSnapshot(snapshot: QuoteSnapshot): Promise<string> {
  const canonical = JSON.stringify({
    currency: snapshot.currency,
    items: [...snapshot.items]
      .map((i) => ({ s: i.slug, q: i.quantity, o: i.one_time, r: i.recurring_monthly }))
      .sort((a, b) => a.s.localeCompare(b.s)),
    o: snapshot.oneTimeTotal,
    r: snapshot.recurringTotal,
    d: snapshot.deposit,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type QuoteRow = Record<string, unknown>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Internal notification: persisted always, emailed when a recipient is configured. */
export async function notifyInternal(options: {
  kind: string;
  subject: string;
  body: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  const supabase = await admin();
  await supabase.from("internal_notifications").insert({
    kind: options.kind,
    subject: options.subject,
    body: options.body,
    payload: (options.payload ?? {}) as never,
  });

  const to = process.env["SATPHONIX_NOTIFY_EMAIL"];
  if (!to) return;
  await sendTrackedEmail({
    idempotencyKey: `internal:${options.idempotencyKey}`,
    template: `internal_${options.kind}`,
    message: {
      to,
      subject: options.subject,
      text: options.body,
      html: `<pre style="font:14px/1.5 ui-monospace,monospace">${escapeHtml(options.body)}</pre>`,
    },
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/**
 * Persist the current plan as the quote for a session, creating a new
 * immutable version whenever the snapshot actually changes. Locked quotes
 * (accepted or paid) are never modified.
 */
export async function persistQuote(options: {
  sessionId: string;
  quoteNumber: string;
  snapshot: QuoteSnapshot;
}): Promise<{ accessToken: string; version: number; locked: boolean }> {
  const supabase = await admin();

  const { data: existing } = await supabase
    .from("quotes")
    .select("*")
    .eq("quote_number", options.quoteNumber)
    .maybeSingle();

  if (existing && isQuoteLocked(String(existing.status))) {
    return {
      accessToken: String(existing.access_token),
      version: Number(existing.accepted_version ?? existing.current_version),
      locked: true,
    };
  }

  const hash = await hashSnapshot(options.snapshot);
  let quote = existing as QuoteRow | null;

  if (!quote) {
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        session_id: options.sessionId,
        quote_number: options.quoteNumber,
        currency: options.snapshot.currency,
        items: options.snapshot.items as never,
        one_time_total: options.snapshot.oneTimeTotal,
        recurring_total: options.snapshot.recurringTotal,
        deposit_amount: options.snapshot.deposit,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    quote = data as QuoteRow;
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .update({
        currency: options.snapshot.currency,
        items: options.snapshot.items as never,
        one_time_total: options.snapshot.oneTimeTotal,
        recurring_total: options.snapshot.recurringTotal,
        deposit_amount: options.snapshot.deposit,
      })
      .eq("id", String(quote["id"]))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    quote = data as QuoteRow;
  }

  const quoteId = String(quote["id"]);
  const { data: latest } = await supabase
    .from("quote_versions")
    .select("version,snapshot_hash")
    .eq("quote_id", quoteId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.snapshot_hash === hash) {
    return { accessToken: String(quote["access_token"]), version: Number(latest.version), locked: false };
  }

  const version = Number(latest?.version ?? 0) + 1;
  const { error: versionError } = await supabase.from("quote_versions").insert({
    quote_id: quoteId,
    version,
    currency: options.snapshot.currency,
    items: options.snapshot.items as never,
    one_time_total: options.snapshot.oneTimeTotal,
    recurring_total: options.snapshot.recurringTotal,
    deposit_amount: options.snapshot.deposit,
    snapshot_hash: hash,
  });
  if (versionError) throw new Error(versionError.message);

  await supabase.from("quotes").update({ current_version: version }).eq("id", quoteId);

  return { accessToken: String(quote["access_token"]), version, locked: false };
}

async function expireIfDue(quote: QuoteRow): Promise<QuoteRow> {
  const status = String(quote["status"]);
  if (status !== "draft" && status !== "sent") return quote;
  if (new Date(String(quote["expires_at"])).getTime() > Date.now()) return quote;
  const supabase = await admin();
  await supabase.from("quotes").update({ status: "expired" }).eq("id", String(quote["id"]));
  return { ...quote, status: "expired" };
}

/** Secure, non-guessable quote read. Never returns diagnostic answers. */
export async function getQuoteView(accessToken: string): Promise<QuoteView | null> {
  const supabase = await admin();
  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("*, diagnostic_sessions(first_name,business_name,email)")
    .eq("access_token", accessToken)
    .maybeSingle();
  if (!quoteRow) return null;

  const quote = await expireIfDue(quoteRow as unknown as QuoteRow);
  const version = Number(quote["accepted_version"] ?? quote["current_version"] ?? 1);

  const { data: versionRow } = await supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", String(quote["id"]))
    .eq("version", version)
    .maybeSingle();

  const source = versionRow ?? (quote as unknown as Record<string, unknown>);
  const session = (quoteRow as unknown as { diagnostic_sessions?: Record<string, unknown> })
    .diagnostic_sessions;

  const { data: order } = await supabase
    .from("orders")
    .select("id,order_number,status,amount_due,amount_paid,payment_plan")
    .eq("quote_id", String(quote["id"]))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let projectName: string | null = null;
  if (order) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("order_id", order.id)
      .maybeSingle();
    projectName = project?.name ?? null;
  }

  return {
    quoteNumber: String(quote["quote_number"]),
    accessToken: String(quote["access_token"]),
    status: String(quote["status"]),
    version,
    currency: String(source["currency"]),
    items: (source["items"] as QuoteItem[]) ?? [],
    oneTimeTotal: Number(source["one_time_total"] ?? 0),
    recurringTotal: Number(source["recurring_total"] ?? 0),
    deposit: Number(source["deposit_amount"] ?? 0),
    expiresAt: String(quote["expires_at"]),
    acceptedAt: (quote["accepted_at"] as string) ?? null,
    acceptedByName: (quote["accepted_by_name"] as string) ?? null,
    firstName: (session?.["first_name"] as string) ?? null,
    businessName: (session?.["business_name"] as string) ?? null,
    email: (quote["accepted_by_email"] as string) ?? (session?.["email"] as string) ?? null,
    order: order
      ? {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          amountDue: Number(order.amount_due),
          amountPaid: Number(order.amount_paid),
          paymentPlan: order.payment_plan,
        }
      : null,
    projectName,
  };
}

/** Mark a quote as sent and email it. Retry-safe: the delivery key is quote+version. */
export async function sendQuoteEmail(sessionToken: string): Promise<{ status: string; accessToken: string | null }> {
  const supabase = await admin();
  const { data: session } = await supabase
    .from("diagnostic_sessions")
    .select("id,email,first_name,business_name")
    .eq("session_token", sessionToken)
    .maybeSingle();
  if (!session?.email) return { status: "no_email", accessToken: null };

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!quote) return { status: "no_quote", accessToken: null };

  const accessToken = String(quote.access_token);
  const view = await getQuoteView(accessToken);
  if (!view) return { status: "no_quote", accessToken: null };

  const { formatMoneyRaw } = await import("./money.server");
  const link = `${appBaseUrl()}/q/${accessToken}`;
  const summary = view.items
    .map((item) => `• ${item.name}${item.recurring_monthly > 0 ? " (includes a monthly element)" : ""}`)
    .join("\n");

  const text = [
    `Hi ${session.first_name ?? "there"},`,
    "",
    `Here is the Satphonix system we recommend for ${session.business_name ?? "your business"}.`,
    `Quote ${view.quoteNumber} (version ${view.version})`,
    "",
    summary,
    "",
    `One-off investment: ${formatMoneyRaw(view.oneTimeTotal, view.currency)}`,
    `Monthly running cost: ${formatMoneyRaw(view.recurringTotal, view.currency)}`,
    `Deposit to start (50%): ${formatMoneyRaw(view.deposit, view.currency)}`,
    "",
    `View my plan: ${link}`,
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#1b2a20">
      <p>Hi ${escapeHtml(session.first_name ?? "there")},</p>
      <p>Here is the Satphonix system we recommend for <strong>${escapeHtml(session.business_name ?? "your business")}</strong>.</p>
      <p style="color:#5b6b60;font-size:13px">Quote ${escapeHtml(view.quoteNumber)} · version ${view.version}</p>
      <ul>${view.items.map((i) => `<li>${escapeHtml(i.name)}</li>`).join("")}</ul>
      <table style="font-size:15px">
        <tr><td>One-off investment</td><td><strong>${formatMoneyRaw(view.oneTimeTotal, view.currency)}</strong></td></tr>
        <tr><td>Monthly running cost</td><td><strong>${formatMoneyRaw(view.recurringTotal, view.currency)}</strong></td></tr>
        <tr><td>Deposit to start (50%)</td><td><strong>${formatMoneyRaw(view.deposit, view.currency)}</strong></td></tr>
      </table>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#1f4d34;color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none">View my plan</a>
      </p>
      <p style="color:#5b6b60;font-size:12px">This link is private to you. Please don't forward it publicly.</p>
    </div>`;

  const result = await sendTrackedEmail({
    idempotencyKey: `quote:${quote.id}:v${view.version}`,
    template: "quote",
    sessionId: session.id,
    quoteId: String(quote.id),
    message: {
      to: String(session.email),
      subject: `Your Satphonix system — quote ${view.quoteNumber}`,
      text,
      html,
    },
  });

  if (!isQuoteLocked(String(quote.status)) && String(quote.status) !== "expired") {
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", String(quote.id));
  }

  await notifyInternal({
    kind: "quote_generated",
    subject: `New quote ${view.quoteNumber} — ${session.business_name ?? "unknown business"}`,
    body: `${session.first_name ?? ""} (${session.email}) generated quote ${view.quoteNumber} v${view.version}: ${formatMoneyRaw(view.oneTimeTotal, view.currency)} one-off, ${formatMoneyRaw(view.recurringTotal, view.currency)}/month.`,
    payload: { quote_number: view.quoteNumber, version: view.version },
    idempotencyKey: `quote_generated:${quote.id}:v${view.version}`,
  });

  return { status: result.status, accessToken };
}

/** Accept a quote: freezes the version and creates/links the customer. */
export async function acceptQuote(options: {
  accessToken: string;
  name: string;
  email: string;
}): Promise<{ ok: true; view: QuoteView } | { ok: false; reason: string }> {
  const supabase = await admin();
  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("*, diagnostic_sessions(id,business_name,country,currency)")
    .eq("access_token", options.accessToken)
    .maybeSingle();
  if (!quoteRow) return { ok: false, reason: "not_found" };

  const quote = await expireIfDue(quoteRow as unknown as QuoteRow);
  const status = String(quote["status"]);
  if (status === "expired") return { ok: false, reason: "expired" };
  if (status === "cancelled") return { ok: false, reason: "cancelled" };

  if (isQuoteLocked(status)) {
    const view = await getQuoteView(options.accessToken);
    return view ? { ok: true, view } : { ok: false, reason: "not_found" };
  }

  const email = normaliseEmail(options.email);
  const session = (quoteRow as unknown as { diagnostic_sessions?: Record<string, unknown> }).diagnostic_sessions;

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        email,
        first_name: options.name,
        business_name: (session?.["business_name"] as string) ?? null,
        country: (session?.["country"] as string) ?? null,
        currency: String(quote["currency"]),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    customerId = created.id;
  }

  const version = Number(quote["current_version"] ?? 1);
  await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_name: options.name,
      accepted_by_email: email,
      accepted_version: version,
      customer_id: customerId,
    })
    .eq("id", String(quote["id"]));

  const view = await getQuoteView(options.accessToken);
  if (!view) return { ok: false, reason: "not_found" };

  const { formatMoneyRaw } = await import("./money.server");
  await notifyInternal({
    kind: "quote_accepted",
    subject: `Quote accepted — ${view.quoteNumber}`,
    body: `${options.name} (${email}) accepted quote ${view.quoteNumber} v${version} for ${formatMoneyRaw(view.oneTimeTotal, view.currency)}.`,
    payload: { quote_number: view.quoteNumber, version },
    idempotencyKey: `quote_accepted:${quote["id"]}:v${version}`,
  });

  return { ok: true, view };
}

/**
 * Create (or reuse) the order for an accepted quote and open a checkout.
 * Amounts always come from the frozen accepted version, never the catalogue.
 */
export async function startPayment(options: {
  accessToken: string;
  plan: "deposit" | "full";
}): Promise<{ ok: true; url: string; paymentId: string } | { ok: false; reason: string }> {
  const supabase = await admin();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("access_token", options.accessToken)
    .maybeSingle();
  if (!quote) return { ok: false, reason: "not_found" };
  if (String(quote.status) !== "accepted" && String(quote.status) !== "partially_paid") {
    return { ok: false, reason: `quote_not_payable:${quote.status}` };
  }
  if (!quote.customer_id) return { ok: false, reason: "no_customer" };

  const version = Number(quote.accepted_version ?? quote.current_version);
  const { data: versionRow } = await supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", String(quote.id))
    .eq("version", version)
    .maybeSingle();
  if (!versionRow) return { ok: false, reason: "no_version" };

  const currency = String(versionRow.currency);
  const oneTime = Number(versionRow.one_time_total);
  const recurring = Number(versionRow.recurring_total);
  const deposit = Number(versionRow.deposit_amount);

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("*")
    .eq("quote_id", String(quote.id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let order = existingOrder;
  if (!order) {
    const orderNumber = `SPXO-${String(quote.quote_number).replace(/^SPX-/, "")}`;
    const { data: created, error } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: String(quote.customer_id),
        quote_id: String(quote.id),
        quote_version_id: String(versionRow.id),
        session_id: String(quote.session_id),
        currency,
        payment_plan: options.plan,
        one_time_total: oneTime,
        recurring_total: recurring,
        deposit_amount: deposit,
        amount_due: oneTime,
        amount_paid: 0,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    order = created;

    const items = (versionRow.items as QuoteItem[]) ?? [];
    if (items.length > 0) {
      await supabase.from("order_items").insert(
        items.map((item) => ({
          order_id: created.id,
          component_slug: item.slug,
          name: item.name,
          pillar: item.pillar ?? "look",
          quantity: item.quantity ?? 1,
          one_time: item.one_time,
          recurring_monthly: item.recurring_monthly,
        })),
      );
    }
  } else if (order.payment_plan !== options.plan && Number(order.amount_paid) === 0) {
    await supabase.from("orders").update({ payment_plan: options.plan }).eq("id", order.id);
  }

  const outstanding = Number(order.amount_due) - Number(order.amount_paid);
  const amount = options.plan === "full" ? outstanding : Math.min(deposit, outstanding);
  if (amount <= 0) return { ok: false, reason: "nothing_due" };

  const kind = options.plan === "full" ? (Number(order.amount_paid) > 0 ? "balance" : "full") : "deposit";

  // Reuse a pending payment of the same shape so refreshes don't stack rows.
  const { data: pending } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", order.id)
    .eq("status", "pending")
    .eq("amount", amount)
    .maybeSingle();

  let payment = pending;
  if (!payment) {
    const provider = getPaymentProvider();
    const { data: created, error } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        customer_id: String(quote.customer_id),
        provider: provider.name,
        kind,
        currency,
        amount,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    payment = created;
  }

  const provider = getPaymentProvider(String(payment.provider));
  const checkout = await provider.createCheckout({
    paymentId: payment.id,
    amount,
    currency,
    kind: kind as "deposit" | "full" | "balance",
    description: `Satphonix ${kind === "deposit" ? "deposit" : "payment"} — quote ${quote.quote_number}`,
    customerEmail: String(quote.accepted_by_email ?? ""),
    successUrl: `${appBaseUrl()}/q/${options.accessToken}?paid=1`,
    cancelUrl: `${appBaseUrl()}/q/${options.accessToken}?cancelled=1`,
  });

  await supabase
    .from("payments")
    .update({ provider_reference: checkout.reference })
    .eq("id", payment.id);

  return { ok: true, url: checkout.url, paymentId: payment.id };
}

/**
 * Idempotent provider event handling. Duplicate events are recorded once and
 * never applied twice, thanks to the unique (provider, event_id) index.
 */
export async function handleProviderEvent(
  providerName: string,
  event: NormalisedEvent,
): Promise<{ status: "applied" | "duplicate" | "ignored" }> {
  const supabase = await admin();

  const { error: insertError } = await supabase.from("payment_events").insert({
    provider: providerName,
    event_id: event.eventId,
    event_type: event.type,
    payload: event.payload as never,
  });
  if (insertError) return { status: "duplicate" };

  const query = supabase.from("payments").select("*");
  const { data: payment } = event.paymentId
    ? await query.eq("id", event.paymentId).maybeSingle()
    : await query.eq("provider_reference", event.reference).maybeSingle();

  if (!payment) return { status: "ignored" };

  await supabase
    .from("payment_events")
    .update({ payment_id: payment.id, processed_at: new Date().toISOString() })
    .eq("provider", providerName)
    .eq("event_id", event.eventId);

  if (event.status !== "succeeded") {
    if (payment.status === "pending") {
      await supabase
        .from("payments")
        .update({ status: event.status === "cancelled" ? "cancelled" : "failed" })
        .eq("id", payment.id);
    }
    return { status: "applied" };
  }

  if (payment.status === "succeeded") return { status: "duplicate" };

  await supabase
    .from("payments")
    .update({ status: "succeeded", provider_reference: payment.provider_reference ?? event.reference })
    .eq("id", payment.id);

  await applyPaidOrder(payment.order_id);
  return { status: "applied" };
}

/** Recompute the order from succeeded payments and provision on first payment. */
export async function applyPaidOrder(orderId: string): Promise<void> {
  const supabase = await admin();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return;

  const { data: payments } = await supabase
    .from("payments")
    .select("amount,status")
    .eq("order_id", orderId)
    .eq("status", "succeeded");

  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const status = paid <= 0 ? "pending" : paid >= Number(order.amount_due) - 0.5 ? "paid" : "partially_paid";

  await supabase.from("orders").update({ amount_paid: paid, status }).eq("id", orderId);
  await supabase
    .from("quotes")
    .update({ status: status === "paid" ? "paid" : status === "partially_paid" ? "partially_paid" : "accepted" })
    .eq("id", order.quote_id);

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", order.customer_id)
    .maybeSingle();

  // Project shell + subscription are created once, on the first successful payment.
  const { data: project } = await supabase
    .from("projects")
    .select("id,name")
    .eq("order_id", orderId)
    .maybeSingle();

  let projectName = project?.name ?? null;
  if (!project && paid > 0) {
    const name = `${customer?.business_name ?? customer?.first_name ?? "New"} — Satphonix system`;
    const { data: createdProject } = await supabase
      .from("projects")
      .insert({
        customer_id: order.customer_id,
        order_id: orderId,
        name,
        status: "onboarding",
      })
      .select("id,name")
      .single();
    projectName = createdProject?.name ?? name;

    if (Number(order.recurring_total) > 0) {
      await supabase.from("subscriptions").insert({
        customer_id: order.customer_id,
        order_id: orderId,
        provider: getPaymentProvider().name,
        currency: order.currency,
        monthly_amount: Number(order.recurring_total),
        status: "pending",
      });
    }

    const { formatMoneyRaw } = await import("./money.server");
    await notifyInternal({
      kind: "project_created",
      subject: `New project — ${projectName}`,
      body: `Order ${order.order_number} is paid ${formatMoneyRaw(paid, String(order.currency))} of ${formatMoneyRaw(Number(order.amount_due), String(order.currency))}. Project shell created for ${customer?.email ?? "unknown"}.`,
      payload: { order_number: order.order_number },
      idempotencyKey: `project_created:${orderId}`,
    });
  }

  const { formatMoneyRaw } = await import("./money.server");
  await notifyInternal({
    kind: "payment_succeeded",
    subject: `Payment received — ${order.order_number}`,
    body: `${customer?.email ?? "customer"} paid. Order ${order.order_number} is now ${status} (${formatMoneyRaw(paid, String(order.currency))} of ${formatMoneyRaw(Number(order.amount_due), String(order.currency))}).`,
    payload: { order_number: order.order_number, status },
    idempotencyKey: `payment_succeeded:${orderId}:${paid}`,
  });
}
