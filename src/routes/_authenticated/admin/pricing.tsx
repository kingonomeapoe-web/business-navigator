import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { getPricingLog, getPricingMatrix, saveComponentPrices } from "@/lib/admin.functions";
import type { PriceInput } from "@/lib/admin-schemas";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — pricing" },
      { name: "description", content: "Manage one-time, recurring and setup pricing per component across USD, GBP, NGN and EUR." },
      { property: "og:title", content: "Satphonix admin — pricing" },
      { property: "og:description", content: "Multi-currency pricing manager with a full audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PricingManager,
});

const CURRENCIES = ["USD", "GBP", "NGN", "EUR"] as const;
const input = "w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm";

type Editing = { componentId: string; name: string; currency: string; one_time: number; recurring_monthly: number; setup_fee: number; active: boolean };

function PricingManager() {
  const loadMatrix = useServerFn(getPricingMatrix);
  const loadLog = useServerFn(getPricingLog);
  const savePrices = useServerFn(saveComponentPrices);
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({ queryKey: ["admin-pricing"], queryFn: () => loadMatrix(), retry: false });
  const { data: log } = useQuery({ queryKey: ["admin-pricing-log"], queryFn: () => loadLog({ data: { limit: 50 } }), retry: false });

  const [editing, setEditing] = useState<Editing | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (price: PriceInput) => savePrices({ data: { prices: [price] } }),
    onSuccess: async () => {
      setMessage("Price saved. New quotes use it immediately; accepted quotes keep their agreed price.");
      setEditing(null);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-pricing-log"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <AdminShell breadcrumbs={[{ label: "Pricing" }]}>
      <p className="eyebrow">Commercial</p>
      <h1 className="display mt-2 text-3xl">Pricing</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Prices are per component and market currency. Every change is written to the audit trail.
      </p>

      {message && <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">{message}</p>}
      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Component</th>
                {CURRENCIES.map((c) => (
                  <th key={c} className="p-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.componentId} className="border-t border-border/60 align-top">
                  <td className="p-3">
                    <span className="font-medium">{row.name}</span>
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground">{row.pillar}</span>
                  </td>
                  {CURRENCIES.map((currency) => {
                    const price = row.prices[currency];
                    return (
                      <td key={currency} className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              componentId: row.componentId,
                              name: row.name,
                              currency,
                              one_time: price?.one_time ?? 0,
                              recurring_monthly: price?.recurring_monthly ?? 0,
                              setup_fee: price?.setup_fee ?? 0,
                              active: price?.active ?? true,
                            })
                          }
                          className="text-left underline-offset-4 hover:underline"
                        >
                          {price ? (
                            <>
                              <span className={price.active ? "" : "text-muted-foreground line-through"}>
                                {price.one_time.toLocaleString("en-US")}
                              </span>
                              {price.recurring_monthly > 0 && (
                                <span className="block text-xs text-muted-foreground">+{price.recurring_monthly}/mo</span>
                              )}
                              {price.setup_fee > 0 && <span className="block text-xs text-muted-foreground">setup {price.setup_fee}</span>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Set price</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <h2 className="display text-lg">
              {editing.name} · {editing.currency}
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {(["one_time", "recurring_monthly", "setup_fee"] as const).map((field) => (
                <label key={field} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {field === "one_time" ? "One-time" : field === "recurring_monthly" ? "Recurring monthly" : "Setup fee"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={input}
                    value={editing[field]}
                    onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Active
              </label>
              <label className="block">
                <span className="text-muted-foreground">Note (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    component_id: editing.componentId,
                    currency: editing.currency as PriceInput["currency"],
                    one_time: editing.one_time,
                    recurring_monthly: editing.recurring_monthly,
                    setup_fee: editing.setup_fee,
                    active: editing.active,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  })
                }
                className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                {mutation.isPending ? "Saving…" : "Save price"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="display mt-10 text-xl">Price change log</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Component</th>
              <th className="p-3">Currency</th>
              <th className="p-3">Field</th>
              <th className="p-3">Change</th>
              <th className="p-3">By</th>
            </tr>
          </thead>
          <tbody>
            {(log ?? []).map((entry) => (
              <tr key={entry.id} className="border-t border-border/60">
                <td className="p-3 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                <td className="p-3">{entry.component}</td>
                <td className="p-3">{entry.currency}</td>
                <td className="p-3 text-muted-foreground">{entry.field}</td>
                <td className="p-3">
                  {entry.previous ?? "—"} → {entry.next ?? "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{entry.changedByEmail ?? entry.changedBy ?? "—"}</td>
              </tr>
            ))}
            {(log ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="p-5 text-sm text-muted-foreground">
                  No price changes recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
