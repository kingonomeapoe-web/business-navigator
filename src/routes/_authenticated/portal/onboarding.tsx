import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CloudUpload, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PortalShell, ProgressBar } from "@/components/portal-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  ONBOARDING_SECTIONS,
  isItemComplete,
  itemsForComponents,
  type OnboardingItem,
  type ResponseMap,
} from "@/lib/onboarding-content";
import {
  finishOnboarding,
  getPortal,
  registerProjectAsset,
  removeProjectAsset,
  saveOnboarding,
} from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/onboarding")({
  head: () => ({
    meta: [
      { title: "Complete your Satphonix project onboarding" },
      {
        name: "description",
        content:
          "Confirm your business details, share your brand and content, and upload the assets Satphonix needs to build your system.",
      },
      { property: "og:title", content: "Satphonix project onboarding" },
      { property: "og:description", content: "Everything we need to start building, in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getPortal);
  const save = useServerFn(saveOnboarding);
  const finish = useServerFn(finishOnboarding);
  const register = useServerFn(registerProjectAsset);
  const remove = useServerFn(removeProjectAsset);

  const { data, isPending } = useQuery({ queryKey: ["portal"], queryFn: () => load() });

  const [draft, setDraft] = useState<ResponseMap>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string[] | null>(null);
  const pending = useRef<Map<string, { section: string; value: string }>>(new Map());

  useEffect(() => {
    if (data) setDraft(data.responses);
  }, [data]);

  const items = useMemo(
    () => (data ? itemsForComponents(data.components.map((c) => c.slug)) : []),
    [data],
  );

  const assetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of data?.assets ?? []) counts[asset.category] = (counts[asset.category] ?? 0) + 1;
    return counts;
  }, [data]);

  const flush = useMutation({
    mutationFn: async () => {
      if (!data || pending.current.size === 0) return;
      const entries = [...pending.current.entries()].map(([key, v]) => ({ key, section: v.section, value: v.value }));
      pending.current.clear();
      setSaving(true);
      await save({ data: { projectId: data.project.id, entries } });
    },
    onSettled: async () => {
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  });

  // Autosave: debounce pending edits.
  useEffect(() => {
    const timer = setInterval(() => {
      if (pending.current.size > 0 && !flush.isPending) flush.mutate();
    }, 2500);
    return () => clearInterval(timer);
  }, [flush]);

  const change = (item: OnboardingItem, value: string) => {
    setDraft((prev) => ({ ...prev, [item.key]: value }));
    pending.current.set(item.key, { section: item.section, value });
  };

  const upload = async (item: OnboardingItem, files: FileList | null) => {
    if (!data || !files?.length) return;
    setUploadError(null);
    setUploading(item.key);
    try {
      const category = item.assetCategory ?? "other";
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} is larger than 25MB.`);
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const path = `${data.project.id}/${category}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("project-assets").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const result = await register({
          data: {
            projectId: data.project.id,
            category,
            filename: safeName,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            storagePath: path,
          },
        });
        if (!result.ok) throw new Error(result.reason ?? "Upload rejected.");
      }
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!data) return;
    setFinishError(null);
    if (pending.current.size > 0) await flush.mutateAsync();
    const result = await finish({ data: { projectId: data.project.id } });
    if (!result.ok) setFinishError(result.outstanding ?? ["Some required items are still missing."]);
    await queryClient.invalidateQueries({ queryKey: ["portal"] });
  };

  if (isPending || !data) {
    return (
      <PortalShell>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading onboarding…
        </div>
      </PortalShell>
    );
  }

  const { progress } = data;
  const done = Boolean(data.project.onboardingCompletedAt);

  return (
    <PortalShell>
      <Link to="/portal" className="text-sm text-muted-foreground underline">
        ← Back to dashboard
      </Link>
      <h1 className="display mt-3 text-3xl">Tell us what we need to build it</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Everything you already told us is filled in. Only what's still missing needs your attention — and your answers
        save as you go.
      </p>

      <div className="sticky top-16 z-30 mt-6 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span>You're {progress.readiness}% ready for production.</span>
          <span className="text-muted-foreground">
            {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : `${progress.outstanding.length} items needed`}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress.readiness} />
        </div>
      </div>

      {done && (
        <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-6">
          <h2 className="display text-2xl">You're ready.</h2>
          <p className="mt-2 text-sm">
            We've received everything we need to begin building your Satphonix project.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {[
              "Requirements confirmed",
              "Assets received",
              "Business information confirmed",
              "Selected system confirmed",
              "Project brief ready",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-accent" /> {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ONBOARDING_SECTIONS.map((section) => {
        const sectionItems = items.filter((i) => i.section === section.key);
        if (sectionItems.length === 0) return null;
        const sectionProgress = progress.sections.find((s) => s.key === section.key);
        return (
          <section key={section.key} className="mt-8 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium">{section.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{section.blurb}</p>
              </div>
              {sectionProgress && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {sectionProgress.completed}/{sectionProgress.total}
                </span>
              )}
            </div>

            <div className="mt-6 space-y-6">
              {sectionItems.map((item) => {
                const complete = isItemComplete(item, draft, assetCounts);
                return (
                  <div key={item.key}>
                    <div className="flex items-center gap-2">
                      <label htmlFor={item.key} className="text-sm font-medium">
                        {item.label}
                      </label>
                      {item.required && !complete && <span className="text-xs text-accent">Required</span>}
                      {complete && <Check className="h-3.5 w-3.5 text-accent" />}
                    </div>
                    {item.help && <p className="mt-1 text-sm text-muted-foreground">{item.help}</p>}

                    {item.type === "files" ? (
                      <div className="mt-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm">
                          {uploading === item.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CloudUpload className="h-4 w-4" />
                          )}
                          Upload files
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => void upload(item, e.target.files)}
                          />
                        </label>
                        <ul className="mt-3 space-y-1.5">
                          {(data.assets ?? [])
                            .filter((a) => a.category === (item.assetCategory ?? "other"))
                            .map((asset) => (
                              <li key={asset.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate">{asset.filename}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${asset.filename}`}
                                  onClick={async () => {
                                    await remove({ data: { assetId: asset.id } });
                                    await queryClient.invalidateQueries({ queryKey: ["portal"] });
                                  }}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : item.type === "confirm" ? (
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          id={item.key}
                          checked={draft[item.key] === "confirmed"}
                          onChange={(e) => change(item, e.target.checked ? "confirmed" : "")}
                          className="h-4 w-4"
                        />
                        That's correct
                      </label>
                    ) : item.type === "select" ? (
                      <select
                        id={item.key}
                        value={draft[item.key] ?? ""}
                        onChange={(e) => change(item, e.target.value)}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base"
                      >
                        <option value="">Choose…</option>
                        {(item.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : item.type === "textarea" ? (
                      <textarea
                        id={item.key}
                        rows={4}
                        value={draft[item.key] ?? ""}
                        placeholder={item.placeholder ?? "Don't worry about getting this perfect. Tell us in your own words."}
                        onChange={(e) => change(item, e.target.value)}
                        onBlur={() => flush.mutate()}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base"
                      />
                    ) : (
                      <input
                        id={item.key}
                        type={item.type === "url" ? "url" : "text"}
                        value={draft[item.key] ?? ""}
                        placeholder={item.placeholder ?? ""}
                        onChange={(e) => change(item, e.target.value)}
                        onBlur={() => flush.mutate()}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {uploadError && (
        <p className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{uploadError}</p>
      )}

      {!done && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Finish onboarding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.complete
              ? "Everything required is in. Send it to our build team."
              : `${progress.outstanding.length} required item${progress.outstanding.length === 1 ? "" : "s"} still to go.`}
          </p>
          {!progress.complete && (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {progress.outstanding.map((o) => (
                <li key={o.key}>• {o.label}</li>
              ))}
            </ul>
          )}
          {finishError && (
            <p className="mt-3 text-sm text-destructive">Still needed: {finishError.join(", ")}</p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!progress.complete}
            className="mt-5 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Submit for build
          </button>
        </div>
      )}
    </PortalShell>
  );
}
