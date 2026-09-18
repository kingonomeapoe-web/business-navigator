import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  deleteContentRecord,
  getContentWorkspace,
  reorderContentRecords,
  saveContentBlock,
  saveFaqEntry,
  saveLegalDocument,
  saveSeoPageEntry,
  saveTestimonialEntry,
  seedContentDefaults,
  setContentPublishState,
} from "@/lib/content.functions";
import type { ContentBlockRow, FaqRow, LegalDocRow, SeoPageRow, TestimonialRow } from "@/lib/content.server";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Content" },
      { name: "description", content: "Manage homepage copy, funnel wording, FAQs, testimonials, SEO metadata and legal documents." },
      { property: "og:title", content: "Satphonix admin — Content" },
      { property: "og:description", content: "The Satphonix content control centre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ContentCentre,
});

const TABS = ["Overview", "Site", "Funnel", "FAQs", "Testimonials", "SEO", "Legal", "Blocks"] as const;
type Tab = (typeof TABS)[number];

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "rounded-full px-4 py-2 text-sm font-medium transition-colors";
const primaryBtn = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghostBtn = `${btn} border border-border hover:bg-muted`;

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider ${
        status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function ContentCentre() {
  const load = useServerFn(getContentWorkspace);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({ queryKey: ["admin-content"], queryFn: () => load(), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-content"] });

  const saveBlock = useServerFn(saveContentBlock);
  const saveFaq = useServerFn(saveFaqEntry);
  const saveTestimonial = useServerFn(saveTestimonialEntry);
  const saveSeo = useServerFn(saveSeoPageEntry);
  const saveLegal = useServerFn(saveLegalDocument);
  const publish = useServerFn(setContentPublishState);
  const remove = useServerFn(deleteContentRecord);
  const reorder = useServerFn(reorderContentRecords);
  const seed = useServerFn(seedContentDefaults);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      setMessage(success);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const seedMutation = useMutation({
    mutationFn: async () => seed({ data: undefined }),
    onSuccess: async (result) => {
      setMessage(
        result.inserted > 0
          ? `Added ${result.inserted} content records using the wording currently on the site.`
          : "Every standard content record already exists.",
      );
      await refresh();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <AdminShell breadcrumbs={[{ label: "Content" }]}>
      <p className="eyebrow">Client-facing</p>
      <h1 className="display mt-2 text-3xl">Content</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Wording, questions, testimonials, search listings and legal pages. Only published content is shown to visitors;
        anything missing falls back to the wording already built into the site.
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Content sections">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              tab === item ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm" role="status">
          {message}
        </p>
      )}
      {isPending && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">You don't have access to this view.</p>}

      {data && (
        <div className="mt-6">
          {tab === "Overview" && (
            <Overview data={data} onSeed={() => seedMutation.mutate()} seeding={seedMutation.isPending} />
          )}

          {(tab === "Site" || tab === "Funnel") && (
            <BlockGroup
              blocks={data.blocks.filter((b) => b.group === (tab === "Site" ? "site" : "funnel"))}
              onSave={(input) => run(() => saveBlock({ data: input }), "Saved.")}
              onPublish={(id, status) =>
                run(() => publish({ data: { entity: "content_blocks", id, status } }), status === "published" ? "Published." : "Unpublished.")
              }
              emptyHint="Use “Load the current site wording” on the Overview tab to bring this copy into the CMS."
            />
          )}

          {tab === "FAQs" && (
            <Faqs
              rows={data.faqs}
              onSave={(input) => run(() => saveFaq({ data: input }), "Saved.")}
              onPublish={(id, status) => run(() => publish({ data: { entity: "faqs", id, status } }), "Updated.")}
              onDelete={(id) => run(() => remove({ data: { entity: "faqs", id } }), "Deleted.")}
              onReorder={(ids) => run(() => reorder({ data: { entity: "faqs", ids } }), "Order saved.")}
            />
          )}

          {tab === "Testimonials" && (
            <Testimonials
              rows={data.testimonials}
              onSave={(input) => run(() => saveTestimonial({ data: input }), "Saved.")}
              onPublish={(id, status) => run(() => publish({ data: { entity: "testimonials", id, status } }), "Updated.")}
              onDelete={(id) => run(() => remove({ data: { entity: "testimonials", id } }), "Deleted.")}
              onReorder={(ids) => run(() => reorder({ data: { entity: "testimonials", ids } }), "Order saved.")}
            />
          )}

          {tab === "SEO" && (
            <Seo
              defaults={data.blocks.filter((b) => b.group === "seo")}
              pages={data.seoPages}
              onSaveBlock={(input) => run(() => saveBlock({ data: input }), "Saved.")}
              onSavePage={(input) => run(() => saveSeo({ data: input }), "Saved.")}
              onPublishBlock={(id, status) => run(() => publish({ data: { entity: "content_blocks", id, status } }), "Updated.")}
              onPublishPage={(id, status) => run(() => publish({ data: { entity: "seo_pages", id, status } }), "Updated.")}
              onDeletePage={(id) => run(() => remove({ data: { entity: "seo_pages", id } }), "Deleted.")}
            />
          )}

          {tab === "Legal" && (
            <Legal
              rows={data.legalDocs}
              onSave={(input) => run(() => saveLegal({ data: input }), "Saved.")}
              onPublish={(id, status) => run(() => publish({ data: { entity: "legal_documents", id, status } }), "Updated.")}
            />
          )}

          {tab === "Blocks" && (
            <AllBlocks
              blocks={data.blocks}
              onSave={(input) => run(() => saveBlock({ data: input }), "Saved.")}
              onPublish={(id, status) => run(() => publish({ data: { entity: "content_blocks", id, status } }), "Updated.")}
              onDelete={(id) => run(() => remove({ data: { entity: "content_blocks", id } }), "Deleted.")}
            />
          )}
        </div>
      )}
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ overview */

type Workspace = NonNullable<Awaited<ReturnType<typeof getContentWorkspace>>>;

function Overview({ data, onSeed, seeding }: { data: Workspace; onSeed: () => void; seeding: boolean }) {
  const o = data.overview;
  const stats = [
    { label: "Published content", value: o.publishedBlocks },
    { label: "Drafts", value: o.draftBlocks },
    { label: "Published FAQs", value: o.publishedFaqs },
    { label: "Published testimonials", value: o.publishedTestimonials },
    { label: "Search listings", value: o.seoPages },
    { label: "Published legal pages", value: o.publishedLegal },
  ];
  return (
    <div className="space-y-8">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-5">
            <p className="text-3xl">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Load the current site wording</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Copies the wording already on the site into editable records. Existing records are never overwritten.
          </p>
        </div>
        <button type="button" className={primaryBtn} onClick={onSeed} disabled={seeding}>
          {seeding ? "Loading…" : "Load wording"}
        </button>
      </div>

      <section>
        <h2 className="text-lg">Recently updated</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Content</th>
                <th className="p-3">Type</th>
                <th className="p-3">Updated by</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {o.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-muted-foreground">
                    Nothing yet.
                  </td>
                </tr>
              )}
              {o.recent.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t border-border/60">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.type}</td>
                  <td className="p-3 text-muted-foreground">{r.updatedByEmail ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{when(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg">Change history</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">What</th>
                <th className="p-3">Field</th>
                <th className="p-3">Before</th>
                <th className="p-3">After</th>
                <th className="p-3">Who</th>
                <th className="p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {data.log.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground">
                    No changes recorded yet.
                  </td>
                </tr>
              )}
              {data.log.map((entry) => (
                <tr key={entry.id} className="border-t border-border/60 align-top">
                  <td className="p-3">{entry.label || entry.entity}</td>
                  <td className="p-3 text-muted-foreground">{entry.field}</td>
                  <td className="max-w-[220px] truncate p-3 text-muted-foreground">{entry.previous ?? "—"}</td>
                  <td className="max-w-[220px] truncate p-3">{entry.next ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{entry.changedByEmail ?? "—"}</td>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{when(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ blocks */

type BlockDraft = {
  id?: string;
  key: string;
  name: string;
  description: string;
  group: "site" | "funnel" | "seo" | "general";
  content: string;
  content_type: "text" | "textarea" | "markdown" | "url" | "boolean";
  status: "draft" | "published";
  display_order: number;
};

function toDraft(block: ContentBlockRow): BlockDraft {
  return {
    id: block.id,
    key: block.key,
    name: block.name,
    description: block.description,
    group: block.group as BlockDraft["group"],
    content: block.content,
    content_type: block.content_type as BlockDraft["content_type"],
    status: block.status as BlockDraft["status"],
    display_order: block.display_order,
  };
}

function BlockEditor({
  block,
  onSave,
  onPublish,
  onDelete,
}: {
  block: ContentBlockRow;
  onSave: (input: BlockDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
  onDelete?: (id: string) => void;
}) {
  const [value, setValue] = useState(block.content);
  const dirty = value !== block.content;
  const long = block.content_type !== "text" && block.content_type !== "url" && block.content_type !== "boolean";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <label htmlFor={`block-${block.id}`} className="font-medium">
            {block.name}
          </label>
          {block.description && <p className="mt-0.5 text-sm text-muted-foreground">{block.description}</p>}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">{block.key}</p>
        </div>
        <StatusPill status={block.status} />
      </div>

      {long ? (
        <textarea
          id={`block-${block.id}`}
          className={`${field} mt-3 min-h-24`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <input id={`block-${block.id}`} className={`${field} mt-3`} value={value} onChange={(e) => setValue(e.target.value)} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{value.length} characters</span>
        <span>· Updated {when(block.updated_at)}</span>
        {block.updated_by_email && <span>· by {block.updated_by_email}</span>}
        {dirty && <span className="text-foreground">· unsaved changes</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={ghostBtn} onClick={() => onSave({ ...toDraft(block), content: value, status: "draft" })}>
          Save draft
        </button>
        <button type="button" className={primaryBtn} onClick={() => onSave({ ...toDraft(block), content: value, status: "published" })}>
          Publish
        </button>
        {block.status === "published" && (
          <button type="button" className={ghostBtn} onClick={() => onPublish(block.id, "draft")}>
            Unpublish
          </button>
        )}
        {onDelete && (
          <button type="button" className={`${ghostBtn} text-destructive`} onClick={() => onDelete(block.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function BlockGroup({
  blocks,
  onSave,
  onPublish,
  emptyHint,
}: {
  blocks: ContentBlockRow[];
  onSave: (input: BlockDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
  emptyHint: string;
}) {
  if (!blocks.length) return <p className="text-sm text-muted-foreground">{emptyHint}</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocks.map((block) => (
        <BlockEditor key={block.id} block={block} onSave={onSave} onPublish={onPublish} />
      ))}
    </div>
  );
}

const EMPTY_BLOCK: BlockDraft = {
  key: "",
  name: "",
  description: "",
  group: "general",
  content: "",
  content_type: "text",
  status: "draft",
  display_order: 0,
};

function AllBlocks({
  blocks,
  onSave,
  onPublish,
  onDelete,
}: {
  blocks: ContentBlockRow[];
  onSave: (input: BlockDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<BlockDraft>(EMPTY_BLOCK);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? blocks.filter((b) => `${b.key} ${b.name}`.toLowerCase().includes(q)) : blocks;
  }, [blocks, search]);

  return (
    <div className="space-y-6">
      <form
        className="surface space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          setDraft(EMPTY_BLOCK);
        }}
      >
        <p className="font-medium">New content block</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Key
            <input
              className={`${field} mt-1`}
              required
              placeholder="homepage.hero.headline"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Name
            <input className={`${field} mt-1`} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="text-sm">
            Section
            <select className={`${field} mt-1`} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value as BlockDraft["group"] })}>
              {["site", "funnel", "seo", "general"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Type
            <select
              className={`${field} mt-1`}
              value={draft.content_type}
              onChange={(e) => setDraft({ ...draft, content_type: e.target.value as BlockDraft["content_type"] })}
            >
              {["text", "textarea", "markdown", "url", "boolean"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Description
          <input className={`${field} mt-1`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <label className="block text-sm">
          Content
          <textarea className={`${field} mt-1 min-h-20`} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
        </label>
        <button type="submit" className={primaryBtn}>
          Create block
        </button>
      </form>

      <label className="block text-sm">
        Search
        <input className={`${field} mt-1 max-w-sm`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search keys or names" />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((block) => (
          <BlockEditor key={block.id} block={block} onSave={onSave} onPublish={onPublish} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ faqs */

type FaqDraft = { id?: string; question: string; answer: string; category: string; display_order: number; status: "draft" | "published" };
const EMPTY_FAQ: FaqDraft = { question: "", answer: "", category: "General", display_order: 0, status: "draft" };

function Faqs({
  rows,
  onSave,
  onPublish,
  onDelete,
  onReorder,
}: {
  rows: FaqRow[];
  onSave: (input: FaqDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<FaqDraft>(EMPTY_FAQ);
  const [editing, setEditing] = useState<FaqDraft | null>(null);
  const categories = useMemo(
    () => [...new Set(["General", "Diagnostic", "Pricing", "Services", "Payment", "Onboarding", "Support", ...rows.map((r) => r.category)])],
    [rows],
  );

  const move = (index: number, delta: number) => {
    const ids = rows.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onReorder(next);
  };

  const form = (value: FaqDraft, set: (v: FaqDraft) => void, submit: () => void, label: string) => (
    <form
      className="surface space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="font-medium">{label}</p>
      <label className="block text-sm">
        Question
        <input className={`${field} mt-1`} required value={value.question} onChange={(e) => set({ ...value, question: e.target.value })} />
      </label>
      <label className="block text-sm">
        Answer
        <textarea className={`${field} mt-1 min-h-28`} required value={value.answer} onChange={(e) => set({ ...value, answer: e.target.value })} />
        <span className="mt-1 block text-xs text-muted-foreground">{value.answer.length} characters</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Category
          <input className={`${field} mt-1`} list="faq-categories" value={value.category} onChange={(e) => set({ ...value, category: e.target.value })} />
          <datalist id="faq-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="text-sm">
          Order
          <input
            type="number"
            className={`${field} mt-1`}
            value={value.display_order}
            onChange={(e) => set({ ...value, display_order: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={ghostBtn} onClick={() => set({ ...value, status: "draft" })}>
          Save draft
        </button>
        <button
          type="button"
          className={primaryBtn}
          onClick={() => {
            set({ ...value, status: "published" });
            onSave({ ...value, status: "published" });
            if (editing) setEditing(null);
            else setDraft(EMPTY_FAQ);
          }}
        >
          Save &amp; publish
        </button>
        {editing && (
          <button type="button" className={ghostBtn} onClick={() => setEditing(null)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {editing
        ? form(
            editing,
            setEditing,
            () => {
              onSave(editing);
              setEditing(null);
            },
            "Edit question",
          )
        : form(
            draft,
            setDraft,
            () => {
              onSave(draft);
              setDraft(EMPTY_FAQ);
            },
            "New question",
          )}

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {rows.map((row, index) => (
          <details key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="flex-1 font-medium">{row.question}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{row.category}</span>
              <StatusPill status={row.status} />
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.answer}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {when(row.updated_at)}
              {row.updated_by_email ? ` by ${row.updated_by_email}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostBtn}
                onClick={() =>
                  setEditing({
                    id: row.id,
                    question: row.question,
                    answer: row.answer,
                    category: row.category,
                    display_order: row.display_order,
                    status: row.status as "draft" | "published",
                  })
                }
              >
                Edit
              </button>
              <button
                type="button"
                className={ghostBtn}
                onClick={() => onPublish(row.id, row.status === "published" ? "draft" : "published")}
              >
                {row.status === "published" ? "Unpublish" : "Publish"}
              </button>
              <button type="button" className={ghostBtn} onClick={() => move(index, -1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" className={ghostBtn} onClick={() => move(index, 1)} aria-label="Move down">
                ↓
              </button>
              <button type="button" className={`${ghostBtn} text-destructive`} onClick={() => onDelete(row.id)}>
                Delete
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ testimonials */

type TestimonialDraft = {
  id?: string;
  client_name: string;
  company: string;
  role_title: string;
  quote: string;
  avatar_url: string;
  rating: number;
  display_order: number;
  featured: boolean;
  status: "draft" | "published";
};
const EMPTY_TESTIMONIAL: TestimonialDraft = {
  client_name: "",
  company: "",
  role_title: "",
  quote: "",
  avatar_url: "",
  rating: 5,
  display_order: 0,
  featured: false,
  status: "draft",
};

function Testimonials({
  rows,
  onSave,
  onPublish,
  onDelete,
  onReorder,
}: {
  rows: TestimonialRow[];
  onSave: (input: TestimonialDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<TestimonialDraft>(EMPTY_TESTIMONIAL);

  const move = (index: number, delta: number) => {
    const ids = rows.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onReorder(next);
  };

  return (
    <div className="space-y-6">
      <form
        className="surface space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          setDraft(EMPTY_TESTIMONIAL);
        }}
      >
        <p className="font-medium">{draft.id ? "Edit testimonial" : "New testimonial"}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Client name
            <input className={`${field} mt-1`} required value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} />
          </label>
          <label className="text-sm">
            Company
            <input className={`${field} mt-1`} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
          </label>
          <label className="text-sm">
            Role
            <input className={`${field} mt-1`} value={draft.role_title} onChange={(e) => setDraft({ ...draft, role_title: e.target.value })} />
          </label>
        </div>
        <label className="block text-sm">
          What they said
          <textarea className={`${field} mt-1 min-h-24`} required value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Photo address (optional)
            <input className={`${field} mt-1`} value={draft.avatar_url} onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value })} />
          </label>
          <label className="text-sm">
            Rating
            <input
              type="number"
              min={1}
              max={5}
              className={`${field} mt-1`}
              value={draft.rating}
              onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} />
            Featured
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={ghostBtn}>
            Save draft
          </button>
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              onSave({ ...draft, status: "published" });
              setDraft(EMPTY_TESTIMONIAL);
            }}
          >
            Save &amp; publish
          </button>
          {draft.id && (
            <button type="button" className={ghostBtn} onClick={() => setDraft(EMPTY_TESTIMONIAL)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No testimonials yet.</p>}
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{row.client_name}</p>
                <p className="text-sm text-muted-foreground">
                  {[row.role_title, row.company].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.featured && <span className="text-[11px] uppercase tracking-wider text-accent">Featured</span>}
                <StatusPill status={row.status} />
              </div>
            </div>
            <p className="mt-3 text-sm">“{row.quote}”</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {row.rating}/5 · updated {when(row.updated_at)}
              {row.updated_by_email ? ` by ${row.updated_by_email}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostBtn}
                onClick={() =>
                  setDraft({
                    id: row.id,
                    client_name: row.client_name,
                    company: row.company,
                    role_title: row.role_title,
                    quote: row.quote,
                    avatar_url: row.avatar_url,
                    rating: row.rating,
                    display_order: row.display_order,
                    featured: row.featured,
                    status: row.status as "draft" | "published",
                  })
                }
              >
                Edit
              </button>
              <button type="button" className={ghostBtn} onClick={() => onPublish(row.id, row.status === "published" ? "draft" : "published")}>
                {row.status === "published" ? "Unpublish" : "Publish"}
              </button>
              <button type="button" className={ghostBtn} onClick={() => move(index, -1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" className={ghostBtn} onClick={() => move(index, 1)} aria-label="Move down">
                ↓
              </button>
              <button type="button" className={`${ghostBtn} text-destructive`} onClick={() => onDelete(row.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ seo */

type SeoDraft = {
  id?: string;
  route: string;
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  canonical_url: string;
  no_index: boolean;
  status: "draft" | "published";
};
const EMPTY_SEO: SeoDraft = {
  route: "/",
  meta_title: "",
  meta_description: "",
  og_title: "",
  og_description: "",
  canonical_url: "",
  no_index: false,
  status: "draft",
};

function Seo({
  defaults,
  pages,
  onSaveBlock,
  onSavePage,
  onPublishBlock,
  onPublishPage,
  onDeletePage,
}: {
  defaults: ContentBlockRow[];
  pages: SeoPageRow[];
  onSaveBlock: (input: BlockDraft) => void;
  onSavePage: (input: SeoDraft) => void;
  onPublishBlock: (id: string, status: "draft" | "published") => void;
  onPublishPage: (id: string, status: "draft" | "published") => void;
  onDeletePage: (id: string) => void;
}) {
  const [draft, setDraft] = useState<SeoDraft>(EMPTY_SEO);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg">Site defaults</h2>
        <p className="mt-1 text-sm text-muted-foreground">Used when a page has nothing of its own.</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {defaults.length === 0 && <p className="text-sm text-muted-foreground">Load the current site wording from the Overview tab.</p>}
          {defaults.map((block) => (
            <BlockEditor key={block.id} block={block} onSave={onSaveBlock} onPublish={onPublishBlock} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg">Page listings</h2>
        <form
          className="surface mt-3 space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSavePage(draft);
            setDraft(EMPTY_SEO);
          }}
        >
          <p className="font-medium">{draft.id ? "Edit page listing" : "New page listing"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Page address
              <input className={`${field} mt-1`} required value={draft.route} onChange={(e) => setDraft({ ...draft, route: e.target.value })} />
            </label>
            <label className="text-sm">
              Search title
              <input className={`${field} mt-1`} value={draft.meta_title} onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })} />
              <span className="mt-1 block text-xs text-muted-foreground">{draft.meta_title.length}/60 recommended</span>
            </label>
          </div>
          <label className="block text-sm">
            Search description
            <textarea
              className={`${field} mt-1 min-h-20`}
              value={draft.meta_description}
              onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
            />
            <span className="mt-1 block text-xs text-muted-foreground">{draft.meta_description.length}/160 recommended</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Share title
              <input className={`${field} mt-1`} value={draft.og_title} onChange={(e) => setDraft({ ...draft, og_title: e.target.value })} />
            </label>
            <label className="text-sm">
              Share description
              <input className={`${field} mt-1`} value={draft.og_description} onChange={(e) => setDraft({ ...draft, og_description: e.target.value })} />
            </label>
            <label className="text-sm">
              Canonical address
              <input className={`${field} mt-1`} value={draft.canonical_url} onChange={(e) => setDraft({ ...draft, canonical_url: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={draft.no_index} onChange={(e) => setDraft({ ...draft, no_index: e.target.checked })} />
              Hide from search engines
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={ghostBtn}>
              Save draft
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                onSavePage({ ...draft, status: "published" });
                setDraft(EMPTY_SEO);
              }}
            >
              Save &amp; publish
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Page</th>
                <th className="p-3">Title</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-muted-foreground">
                    No page listings yet.
                  </td>
                </tr>
              )}
              {pages.map((page) => (
                <tr key={page.id} className="border-t border-border/60">
                  <td className="p-3 font-mono text-xs">{page.route}</td>
                  <td className="p-3">{page.meta_title || "—"}</td>
                  <td className="p-3">
                    <StatusPill status={page.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() =>
                          setDraft({
                            id: page.id,
                            route: page.route,
                            meta_title: page.meta_title,
                            meta_description: page.meta_description,
                            og_title: page.og_title,
                            og_description: page.og_description,
                            canonical_url: page.canonical_url,
                            no_index: page.no_index,
                            status: page.status as "draft" | "published",
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() => onPublishPage(page.id, page.status === "published" ? "draft" : "published")}
                      >
                        {page.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className={`${ghostBtn} text-destructive`} onClick={() => onDeletePage(page.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ legal */

type LegalDraft = { id?: string; slug: string; title: string; body: string; status: "draft" | "published" };

const LEGAL_STARTERS: { slug: string; title: string }[] = [
  { slug: "terms", title: "Terms & Conditions" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "refunds", title: "Refund Policy" },
];

function Legal({
  rows,
  onSave,
  onPublish,
}: {
  rows: LegalDocRow[];
  onSave: (input: LegalDraft) => void;
  onPublish: (id: string, status: "draft" | "published") => void;
}) {
  const existing = new Set(rows.map((r) => r.slug));
  const [draft, setDraft] = useState<LegalDraft | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These pages are legal documents. Nothing here has been reviewed by a lawyer — write or paste your own approved wording before publishing.
      </p>

      {LEGAL_STARTERS.filter((s) => !existing.has(s.slug)).length > 0 && (
        <div className="surface flex flex-wrap items-center gap-2 p-5">
          <span className="text-sm">Create:</span>
          {LEGAL_STARTERS.filter((s) => !existing.has(s.slug)).map((s) => (
            <button
              key={s.slug}
              type="button"
              className={ghostBtn}
              onClick={() => setDraft({ slug: s.slug, title: s.title, body: "", status: "draft" })}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <form
          className="surface space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setDraft(null);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Title
              <input className={`${field} mt-1`} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm">
              Web address
              <input className={`${field} mt-1`} required value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </label>
          </div>
          <label className="block text-sm">
            Content
            <textarea className={`${field} mt-1 min-h-64 font-mono text-xs`} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <span className="mt-1 block text-xs text-muted-foreground">{draft.body.length} characters · plain text or markdown</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={ghostBtn}>
              Save draft
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                onSave({ ...draft, status: "published" });
                setDraft(null);
              }}
            >
              Save &amp; publish
            </button>
            <button type="button" className={ghostBtn} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">/legal/{row.slug}</p>
              </div>
              <StatusPill status={row.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Last updated {when(row.updated_at)}
              {row.updated_by_email ? ` by ${row.updated_by_email}` : ""}
              {row.published_at ? ` · published ${when(row.published_at)}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostBtn}
                onClick={() => setDraft({ id: row.id, slug: row.slug, title: row.title, body: row.body, status: row.status as "draft" | "published" })}
              >
                Edit
              </button>
              <button type="button" className={ghostBtn} onClick={() => onPublish(row.id, row.status === "published" ? "draft" : "published")}>
                {row.status === "published" ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
