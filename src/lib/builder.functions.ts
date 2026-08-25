import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { currencyForCountry, isCurrency, type CurrencyCode } from "./currency";
import { decide, type DiagnosticProfile } from "./recommend";

export type CatalogComponent = {
  slug: string;
  name: string;
  pillar: "look" | "attract" | "convert" | "run";
  short_description: string;
  client_explanation: string;
  recommendation_reason: string;
  icon: string;
  display_order: number;
  one_time: number;
  recurring_monthly: number;
};

export type SessionRecord = {
  token: string;
  first_name: string | null;
  business_name: string | null;
  business_description: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  service_area: string | null;
  currency: CurrencyCode;
  classification: Record<string, unknown>;
  goals: string[];
  answers: Record<string, string[]>;
  selected_components: string[];
  step: string;
};

const toSession = (row: Record<string, unknown>): SessionRecord => ({
  token: String(row["session_token"]),
  first_name: (row["first_name"] as string) ?? null,
  business_name: (row["business_name"] as string) ?? null,
  business_description: (row["business_description"] as string) ?? null,
  city: (row["city"] as string) ?? null,
  region: (row["region"] as string) ?? null,
  country: (row["country"] as string) ?? null,
  service_area: (row["service_area"] as string) ?? null,
  currency: (isCurrency(String(row["currency"])) ? row["currency"] : "USD") as CurrencyCode,
  classification: (row["classification"] as Record<string, unknown>) ?? {},
  goals: (row["goals"] as string[]) ?? [],
  answers: (row["answers"] as Record<string, string[]>) ?? {},
  selected_components: (row["selected_components"] as string[]) ?? [],
  step: String(row["step"] ?? "first_name"),
});

/** Public catalogue read — safe columns only, no session data. */
export const getCatalog = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ currency: z.string().default("USD") }).parse(input))
  .handler(async ({ data }): Promise<CatalogComponent[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const currency = isCurrency(data.currency) ? data.currency : "USD";
    const { data: rows, error } = await supabase
      .from("components")
      .select(
        "slug,name,pillar,short_description,client_explanation,recommendation_reason,icon,display_order,component_prices(currency,one_time,recurring_monthly)",
      )
      .eq("is_active", true)
      .order("display_order");

    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const prices = (row.component_prices ?? []) as { currency: string; one_time: number; recurring_monthly: number }[];
      const price = prices.find((p) => p.currency === currency) ?? prices.find((p) => p.currency === "USD");
      return {
        slug: row.slug,
        name: row.name,
        pillar: row.pillar as CatalogComponent["pillar"],
        short_description: row.short_description,
        client_explanation: row.client_explanation,
        recommendation_reason: row.recommendation_reason,
        icon: row.icon,
        display_order: row.display_order,
        one_time: Number(price?.one_time ?? 0),
        recurring_monthly: Number(price?.recurring_monthly ?? 0),
      };
    });
  });

export const startSession = createServerFn({ method: "POST" }).handler(async (): Promise<{ token: string }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("diagnostic_sessions").insert({}).select("session_token").single();
  if (error) throw new Error(error.message);
  return { token: String(data.session_token) };
});

const patchSchema = z.object({
  token: z.string().uuid(),
  patch: z.object({
    first_name: z.string().trim().max(80).optional(),
    business_name: z.string().trim().max(160).optional(),
    business_description: z.string().trim().max(2000).optional(),
    city: z.string().trim().max(120).optional(),
    region: z.string().trim().max(120).optional(),
    country: z.string().trim().max(120).optional(),
    service_area: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200).optional(),
    goals: z.array(z.string().max(60)).max(20).optional(),
    answers: z.record(z.array(z.string().max(60)).max(20)).optional(),
    selected_components: z.array(z.string().max(80)).max(60).optional(),
    step: z.string().max(40).optional(),
  }),
});

export const saveSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => patchSchema.parse(input))
  .handler(async ({ data }): Promise<SessionRecord> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { ...data.patch };
    if (typeof patch["country"] === "string") {
      patch["currency"] = currencyForCountry(patch["country"] as string);
    }
    const { data: row, error } = await supabaseAdmin
      .from("diagnostic_sessions")
      .update(patch)
      .eq("session_token", data.token)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toSession(row as Record<string, unknown>);
  });

export const getSession = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<SessionRecord | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("diagnostic_sessions")
      .select("*")
      .eq("session_token", data.token)
      .maybeSingle();
    return row ? toSession(row as Record<string, unknown>) : null;
  });

const classificationSchema = z.object({
  industry: z.string(),
  specialization: z.string(),
  business_model: z.string(),
  primary_market: z.string(),
  likely_conversion: z.string(),
  lead_value: z.enum(["high", "medium", "low"]),
  services: z.array(z.string()).max(8),
  summary: z.string(),
  scenario: z.string(),
});

export type Classification = z.infer<typeof classificationSchema>;

/** AI reads the free-text description. It never touches pricing or eligibility. */
export const classifyBusiness = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<Classification> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("diagnostic_sessions")
      .select("*")
      .eq("session_token", data.token)
      .single();
    if (error) throw new Error(error.message);
    const session = toSession(row as Record<string, unknown>);

    const fallback: Classification = {
      industry: "Professional Services",
      specialization: "General",
      business_model: "Services",
      primary_market: [session.city, session.region, session.country].filter(Boolean).join(", "),
      likely_conversion: "Enquiry",
      lead_value: "medium",
      services: [],
      summary: `${session.business_name ?? "Your business"} serves customers in ${session.city ?? "your area"}.`,
      scenario: `Imagine someone nearby searches tonight for what ${session.business_name ?? "your business"} offers.`,
    };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return fallback;

    try {
      const { generateText, Output } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(apiKey);

      const result = await generateText({
        model: gateway("google/gemini-3.7-flash"),
        output: Output.object({ schema: classificationSchema }),
        system:
          "You classify small businesses for a digital consultancy. Be concise and concrete. " +
          "The 'summary' is shown to the business owner in plain, warm, non-technical language, one or two sentences, " +
          "written in the third person about their business. The 'scenario' is a single sentence starting with 'Imagine' " +
          "describing a realistic moment when an ideal customer discovers this business. Never mention technology.",
        prompt: [
          `Business name: ${session.business_name ?? "unknown"}`,
          `Description: ${session.business_description ?? "unknown"}`,
          `City: ${session.city ?? ""}`,
          `Region: ${session.region ?? ""}`,
          `Country: ${session.country ?? ""}`,
          `Service area: ${session.service_area ?? ""}`,
        ].join("\n"),
      });

      const classification = result.output ?? fallback;
      await supabaseAdmin
        .from("diagnostic_sessions")
        .update({ classification })
        .eq("session_token", data.token);
      return classification;
    } catch (err) {
      console.error("classification failed", err);
      await supabaseAdmin
        .from("diagnostic_sessions")
        .update({ classification: fallback })
        .eq("session_token", data.token);
      return fallback;
    }
  });

export type PlanItem = CatalogComponent & {
  verdict: "recommended" | "optional" | "excluded";
  reason: string;
  selected: boolean;
};

export type Plan = {
  session: SessionRecord;
  currency: CurrencyCode;
  items: PlanItem[];
  oneTimeTotal: number;
  recurringTotal: number;
  deposit: number;
  quoteNumber: string;
};

export const buildPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        selected: z.array(z.string().max(80)).max(60).optional(),
        persistQuote: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Plan> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("diagnostic_sessions")
      .select("*")
      .eq("session_token", data.token)
      .single();
    if (error) throw new Error(error.message);
    const session = toSession(row as Record<string, unknown>);

    const catalog = await getCatalog({ data: { currency: session.currency } });

    const profile: DiagnosticProfile = {
      goals: session.goals,
      answers: session.answers,
      classification: session.classification as DiagnosticProfile["classification"],
    };
    const decisions = new Map(decide(profile).map((d) => [d.slug, d]));

    const defaultSelection = [...decisions.values()].filter((d) => d.verdict === "recommended").map((d) => d.slug);
    const selected = new Set(data.selected ?? (session.selected_components.length ? session.selected_components : defaultSelection));

    const items: PlanItem[] = catalog.map((component) => {
      const decision = decisions.get(component.slug);
      return {
        ...component,
        verdict: decision?.verdict ?? "optional",
        reason: decision?.reason ?? component.recommendation_reason,
        selected: selected.has(component.slug),
      };
    });

    const chosen = items.filter((i) => i.selected && i.verdict !== "excluded");
    const oneTimeTotal = chosen.reduce((sum, i) => sum + i.one_time, 0);
    const recurringTotal = chosen.reduce((sum, i) => sum + i.recurring_monthly, 0);
    const deposit = Math.round(oneTimeTotal / 2);

    const quoteNumber = `SPX-${String(session.token).slice(0, 8).toUpperCase()}`;

    if (data.persistQuote) {
      await supabaseAdmin.from("diagnostic_sessions").update({ selected_components: [...selected] }).eq("session_token", data.token);
      await supabaseAdmin
        .from("quotes")
        .upsert(
          {
            session_id: String((row as Record<string, unknown>)["id"]),
            quote_number: quoteNumber,
            currency: session.currency,
            items: chosen.map((i) => ({
              slug: i.slug,
              name: i.name,
              pillar: i.pillar,
              one_time: i.one_time,
              recurring_monthly: i.recurring_monthly,
            })),
            one_time_total: oneTimeTotal,
            recurring_total: recurringTotal,
            deposit_amount: deposit,
            status: "sent",
          },
          { onConflict: "quote_number" },
        );
    }

    return {
      session,
      currency: session.currency,
      items,
      oneTimeTotal,
      recurringTotal,
      deposit,
      quoteNumber,
    };
  });
