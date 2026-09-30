import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Copy, Lock, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import {
  QUESTION_STATUSES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  YES_NO_OPTIONS,
  isChoiceType,
  publishProblems,
  questionInputSchema,
  type QuestionStatus,
  type QuestionType,
} from "@/lib/question-schemas";
import {
  duplicateAdminQuestion,
  getAdminQuestion,
  listAdminQuestions,
  removeAdminQuestion,
  reorderAdminQuestions,
  saveAdminQuestion,
  setAdminQuestionStatus,
} from "@/lib/questions.functions";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Question Builder" },
      { name: "description", content: "Manage the questions that power the Satphonix business diagnostic." },
      { property: "og:title", content: "Satphonix admin — Question Builder" },
      { property: "og:description", content: "Create, order and publish diagnostic questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: QuestionsPage,
});

type OptionDraft = { id?: string; key: string; label: string; description: string; display_order: number; active: boolean; internal_notes: string };
type Draft = {
  id?: string;
  key: string;
  question: string;
  short_label: string;
  help_text: string;
  question_type: QuestionType;
  required: boolean;
  placeholder: string;
  display_order: number;
  status: QuestionStatus;
  internal_notes: string;
  options: OptionDraft[];
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";
const statusStyle: Record<QuestionStatus, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  try {
    const parsed = JSON.parse(msg);
    if (Array.isArray(parsed)) return parsed.map((i: { message: string }) => i.message).join(" ");
  } catch {
    /* not zod */
  }
  return msg;
}

function QuestionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminQuestions);
  const reorder = useServerFn(reorderAdminQuestions);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-questions"], queryFn: () => list(), retry: false });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | QuestionStatus>("all");
  const [type, setType] = useState<"all" | QuestionType>("all");
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (type === "all" || r.question_type === type) &&
          (search === "" || `${r.question} ${r.key}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [data, search, status, type],
  );

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const ids = (data ?? []).map((r) => r.id);
      const j = index + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[index], ids[j]] = [ids[j]!, ids[index]!];
      await reorder({ data: { ids } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-questions"] }),
    onError: (e) => toast.error(errorText(e)),
  });
  const filtered = search !== "" || status !== "all" || type !== "all";
  const publishedCount = (data ?? []).filter((r) => r.status === "published").length;

  return (
    <AdminShell breadcrumbs={[{ label: "Questions" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Diagnostic</p>
          <h1 className="display mt-2 text-3xl">Question Builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {publishedCount > 0
              ? `${publishedCount} published question${publishedCount === 1 ? "" : "s"} drive the public diagnostic, in the order below.`
              : "No questions are published yet, so the diagnostic is using its built-in questions. Publishing any question switches the diagnostic to the published set."}
          </p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> New question
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input className={`${input} max-w-xs`} placeholder="Search questions or keys" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={`${input} w-auto`} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">All types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Question</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Required</th>
                <th className="p-3">Options</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-5 text-muted-foreground">No questions match.</td></tr>
              )}
              {rows.map((r) => {
                const index = (data ?? []).findIndex((d) => d.id === r.id);
                return (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="w-6 text-muted-foreground">{index + 1}</span>
                        {!filtered && (
                          <>
                            <button type="button" aria-label="Move up" disabled={index === 0 || move.isPending} onClick={() => move.mutate({ index, dir: -1 })} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Move down" disabled={index === data.length - 1 || move.isPending} onClick={() => move.mutate({ index, dir: 1 })} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => setEditing(r.id)} className="text-left hover:underline">
                        <span className="block font-medium">{r.question}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{r.key}</span>
                      </button>
                    </td>
                    <td className="p-3">{QUESTION_TYPE_LABELS[r.question_type]}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[r.status]}`}>{r.status}</span></td>
                    <td className="p-3">{r.required ? "Yes" : "No"}</td>
                    <td className="p-3">{isChoiceType(r.question_type) || r.question_type === "yes_no" ? r.option_count : "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                      {r.updated_by_email && <span className="block">{r.updated_by_email}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <QuestionEditor
          id={editing === "new" ? null : editing}
          nextOrder={((data ?? []).at(-1)?.display_order ?? 0) + 10}
          onClose={() => setEditing(null)}
          onOpen={(id) => setEditing(id)}
        />
      )}
    </AdminShell>
  );
}

function blankDraft(order: number): Draft {
  return { key: "", question: "", short_label: "", help_text: "", question_type: "single_choice", required: true, placeholder: "", display_order: order, status: "draft", internal_notes: "", options: [] };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function QuestionEditor({ id, nextOrder, onClose, onOpen }: { id: string | null; nextOrder: number; onClose: () => void; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getAdminQuestion);
  const save = useServerFn(saveAdminQuestion);
  const setStatusFn = useServerFn(setAdminQuestionStatus);
  const remove = useServerFn(removeAdminQuestion);
  const duplicate = useServerFn(duplicateAdminQuestion);
  const detail = useQuery({ queryKey: ["admin-question", id], queryFn: () => get({ data: { id: id! } }), enabled: !!id, retry: false });
  const [draft, setDraft] = useState<Draft>(() => blankDraft(nextOrder));

  useEffect(() => {
    const d = detail.data;
    if (d) {
      setDraft({
        id: d.id, key: d.key, question: d.question, short_label: d.short_label, help_text: d.help_text, question_type: d.question_type,
        required: d.required, placeholder: d.placeholder, display_order: d.display_order, status: d.status, internal_notes: d.internal_notes,
        options: d.options.map((o) => ({ ...o })),
      });
    }
  }, [detail.data]);

  const refresh = async (newId?: string) => {
    await qc.invalidateQueries({ queryKey: ["admin-questions"] });
    await qc.invalidateQueries({ queryKey: ["admin-question"] });
    if (newId && newId !== id) onOpen(newId);
  };

  const submit = useMutation({
    mutationFn: async (status: QuestionStatus) => {
      const payload = { ...draft, status, options: draft.options.map((o, i) => ({ ...o, display_order: (i + 1) * 10 })) };
      const parsed = questionInputSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
      if (status === "published") {
        const problems = publishProblems(parsed.data);
        if (problems.length) throw new Error(`Cannot publish yet: ${problems.join(" ")}`);
      }
      return save({ data: parsed.data });
    },
    onSuccess: async (res, status) => {
      toast.success(status === "published" ? "Published" : "Saved");
      await refresh(res.id);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const action = useMutation({
    mutationFn: async (kind: "unpublish" | "archive" | "delete" | "duplicate") => {
      if (!id) return;
      if (kind === "duplicate") {
        const r = await duplicate({ data: { id } });
        toast.success("Duplicated as a draft");
        return refresh(r.id);
      }
      if (kind === "delete") {
        if (!confirm("Remove this question? Questions that have been published or answered are archived instead of deleted.")) return;
        const r = await remove({ data: { id } });
        toast.success(r.result === "deleted" ? "Deleted" : "Archived — kept for historical answers");
        await refresh();
        if (r.result === "deleted") onClose();
        return;
      }
      await setStatusFn({ data: { id, status: kind === "archive" ? "archived" : "draft" } });
      toast.success(kind === "archive" ? "Archived" : "Unpublished");
      return refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setOpt = (i: number, patch: Partial<OptionDraft>) => setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const moveOpt = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const opts = [...d.options];
      const j = i + dir;
      if (j < 0 || j >= opts.length) return d;
      [opts[i], opts[j]] = [opts[j]!, opts[i]!];
      return { ...d, options: opts };
    });
  const choice = isChoiceType(draft.question_type);
  const locked = !!detail.data?.keyLocked;
  const usage = detail.data?.usage ?? 0;
  const problems = publishProblems(draft);
  const busy = submit.isPending || action.isPending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30" onClick={onClose}>
      <div className="h-full w-full max-w-5xl overflow-y-auto bg-background p-5 shadow-elevated sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{id ? "Edit question" : "New question"}</p>
            <h2 className="display mt-1 text-2xl">{draft.question || "Untitled question"}</h2>
            {id && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className={`mr-2 rounded-full px-2 py-0.5 ${statusStyle[draft.status]}`}>{draft.status}</span>
                Answered in {usage} diagnostic run{usage === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg border border-border p-2"><X className="h-4 w-4" /></button>
        </div>

        {id && detail.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <Section title="Question">
                <Field label="Question text"><input className={input} value={draft.question} maxLength={300} onChange={(e) => set("question", e.target.value)} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Short label" hint="Used in admin lists and reports."><input className={input} value={draft.short_label} maxLength={80} onChange={(e) => set("short_label", e.target.value)} /></Field>
                  <Field label="Stable key" hint={locked ? "Locked: this question has been published or answered." : "Permanent identifier used by future recommendation rules."}>
                    <div className="relative">
                      <input className={`${input} font-mono`} value={draft.key} disabled={locked} placeholder="business_has_website" onChange={(e) => set("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
                      {locked && <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </Field>
                </div>
                <Field label="Help text"><textarea className={`${input} min-h-20`} value={draft.help_text} maxLength={600} onChange={(e) => set("help_text", e.target.value)} /></Field>
              </Section>

              <Section title="Response">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Question type">
                    <select className={input} value={draft.question_type} onChange={(e) => set("question_type", e.target.value as QuestionType)}>
                      {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
                    </select>
                  </Field>
                  {["text", "textarea", "number", "url"].includes(draft.question_type) && (
                    <Field label="Placeholder"><input className={input} value={draft.placeholder} maxLength={160} onChange={(e) => set("placeholder", e.target.value)} /></Field>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.required} onChange={(e) => set("required", e.target.checked)} /> Visitors must answer this question
                </label>
                {draft.question_type === "yes_no" && <p className="text-xs text-muted-foreground">Yes/No questions always use the stable keys <code>yes</code> and <code>no</code>.</p>}
              </Section>

              {choice && (
                <Section title="Answer options">
                  {usage > 0 && <p className="text-xs text-muted-foreground">People have answered this question, so existing option keys are locked and removed options are deactivated rather than deleted.</p>}
                  {draft.options.length === 0 && <p className="text-sm text-muted-foreground">No options yet.</p>}
                  {draft.options.map((o, i) => (
                    <div key={o.id ?? `new-${i}`} className={`rounded-xl border border-border p-3 ${o.active ? "" : "opacity-60"}`}>
                      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                        <input className={input} placeholder="Label" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
                        <input className={`${input} font-mono`} placeholder="stable_key" value={o.key} disabled={!!o.id && usage > 0} onChange={(e) => setOpt(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Move option up" onClick={() => moveOpt(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label="Move option down" onClick={() => moveOpt(i, 1)} disabled={i === draft.options.length - 1} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label="Remove option" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, j) => j !== i) }))} className="rounded p-1.5 text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input className={input} placeholder="Description (optional)" value={o.description} onChange={(e) => setOpt(i, { description: e.target.value })} />
                        <input className={input} placeholder="Internal notes" value={o.internal_notes} onChange={(e) => setOpt(i, { internal_notes: e.target.value })} />
                        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={o.active} onChange={(e) => setOpt(i, { active: e.target.checked })} /> Active</label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, { key: "", label: "", description: "", display_order: 0, active: true, internal_notes: "" }] }))} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm">
                    <Plus className="h-4 w-4" /> Add option
                  </button>
                </Section>
              )}

              <Section title="Administration">
                <Field label="Internal notes" hint="Never shown to visitors."><textarea className={`${input} min-h-20`} value={draft.internal_notes} maxLength={4000} onChange={(e) => set("internal_notes", e.target.value)} /></Field>
              </Section>

              {problems.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                  <p className="font-medium">Before this can be published:</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => submit.mutate(draft.status === "published" ? "published" : draft.status === "archived" ? "archived" : "draft")} className="rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-50">
                  {draft.status === "published" ? "Save changes" : "Save draft"}
                </button>
                {draft.status !== "published" && (
                  <button type="button" disabled={busy || problems.length > 0} onClick={() => submit.mutate("published")} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-50">
                    Publish
                  </button>
                )}
                {id && draft.status === "published" && <button type="button" disabled={busy} onClick={() => action.mutate("unpublish")} className="rounded-full border border-border px-5 py-2.5 text-sm">Unpublish</button>}
                {id && <button type="button" disabled={busy} onClick={() => action.mutate("duplicate")} className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm"><Copy className="h-4 w-4" /> Duplicate</button>}
                {id && draft.status !== "archived" && <button type="button" disabled={busy} onClick={() => action.mutate("archive")} className="rounded-full border border-border px-5 py-2.5 text-sm">Archive</button>}
                {id && <button type="button" disabled={busy} onClick={() => action.mutate("delete")} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-5 py-2.5 text-sm text-destructive"><Trash2 className="h-4 w-4" /> {locked ? "Archive (in use)" : "Delete"}</button>}
              </div>
            </div>

            <div className="space-y-5">
              <Section title="Visitor preview">
                <Preview draft={draft} />
              </Section>
              {detail.data && detail.data.log.length > 0 && (
                <Section title="Change history">
                  <ul className="space-y-2 text-xs">
                    {detail.data.log.map((l) => (
                      <li key={l.id} className="border-b border-border/60 pb-2 last:border-0">
                        <span className="font-medium">{l.action}{l.field ? ` · ${l.field}` : ""}</span>
                        {l.new_value && <span className="block truncate text-muted-foreground">→ {l.new_value}</span>}
                        <span className="block text-muted-foreground">{new Date(l.created_at).toLocaleString()} {l.email ? `· ${l.email}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({ draft }: { draft: Draft }) {
  const options = draft.question_type === "yes_no" ? YES_NO_OPTIONS.map((o) => ({ key: o.key, label: o.label, active: true })) : draft.options.filter((o) => o.active);
  return (
    <div>
      <p className="display text-lg leading-snug">{draft.question || "Your question"}{!draft.required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}</p>
      {draft.help_text && <p className="mt-1 text-xs text-muted-foreground">{draft.help_text}</p>}
      <div className="mt-3 space-y-2">
        {(isChoiceType(draft.question_type) || draft.question_type === "yes_no") &&
          (options.length ? options.map((o) => (
            <div key={o.key || o.label} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className={`h-3.5 w-3.5 border border-muted-foreground ${draft.question_type === "multi_choice" ? "rounded-sm" : "rounded-full"}`} />
              {o.label || "Option"}
            </div>
          )) : <p className="text-xs text-muted-foreground">Add an active option to preview it.</p>)}
        {draft.question_type === "textarea" && <div className="h-20 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">{draft.placeholder}</div>}
        {["text", "number", "url"].includes(draft.question_type) && (
          <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">{draft.placeholder || (draft.question_type === "url" ? "https://" : draft.question_type === "number" ? "0" : "\u00a0")}</div>
        )}
      </div>
    </div>
  );
}
