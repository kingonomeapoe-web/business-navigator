/** Simple fixed-window rate limiter backed by Postgres (workers are stateless). */
export async function checkRateLimit(options: {
  bucket: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: boolean; remaining: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const windowMs = options.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("rate_limits")
    .select("id,count")
    .eq("bucket", options.bucket)
    .eq("subject", options.subject)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin
      .from("rate_limits")
      .insert({ bucket: options.bucket, subject: options.subject, window_start: windowStart, count: 1 });
    return { ok: true, remaining: options.limit - 1 };
  }

  const next = Number(existing.count) + 1;
  await supabaseAdmin.from("rate_limits").update({ count: next }).eq("id", existing.id);
  return { ok: next <= options.limit, remaining: Math.max(0, options.limit - next) };
}

/** Best-effort caller identity for public endpoints. */
export function callerKey(headers: Headers, fallback: string): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    fallback
  );
}
