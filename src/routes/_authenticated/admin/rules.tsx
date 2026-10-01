import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Copy, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AdminShell } from "@/components/admin-shell";
import type { DiagnosticProfile } from "@/lib/recommend";
import {
  ANSWER_OPS,
  actionSchema,
  conditionSchema,
  CLASSIFICATION_FIELDS,
  GOAL_OPS,
  NUMBER_OPS,
  TEXT_OPS,
  describeRule,
  diffResults,
  evaluateCondition,
  evaluateRules,
  safeRecommend,
  type CatalogueInfo,
  type Condition,
  type ConditionTrace,
  type EngineRule,
  type LeafCondition,
  type Labels,
  type RuleAction,
} from "@/lib/rules-engine";
import { validateRule } from "@/lib/rules-validate";
import { duplicateRule, getRulesWorkspace, removeRule, saveRule, setRulePriority, setRuleStatus } from "@/lib/rules.functions";
import type { RuleRow, RulesWorkspace } from "@/lib/rules.server";

export const Route = createFileRoute("/_authenticated/admin/rules")({
  head: () => ({
    meta: [
      { title: "Satphonix admin — Recommendation Rules" },
      { name: "description", content: "Configure the deterministic rules that shape Satphonix recommendations." },
      { property: "og:title", content: "Satphonix admin — Recommendation Rules" },
      { property: "og:description", content: "Create, test and activate recommendation rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RulesPage,
});

type Draft = {
  id?: string;
  key: string;
  name: string;
  description: string;
  internal_notes: string;
  priority: number;
  conditions: Condition;
  actions: RuleAction[];
  status: RuleRow["status"];
  version: number;
};

const emptyDraft = (): Draft => ({
  key: "", name: "", description: "", internal_notes: "", priority: 0, status: "draft", version: 0,
  conditions: { kind: "group", mode: "all", children: [] },
  actions: [{ type: "recommend", component: "", reason: "", priority: 0 }],
});

/** Damaged stored data must never crash the editor: reset unreadable parts. */
function safeDraft(r: RuleRow): Draft {
  const c = conditionSchema.safeParse(r.conditions);
  const a = z.array(actionSchema).safeParse(r.actions);
  return {
    ...r,
    conditions: c.success && c.data.kind === "group" ? c.data : { kind: "group", mode: "all", children: [] },
    actions: a.success ? a.data : [],
  };
}

const input = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";
const btn = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-50";
const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function useLabels(ws?: RulesWorkspace): Labels {
  return useMemo(() => ({
    question: (k) => ws?.questions.find((q) => q.key === k)?.question ?? k,
    option: (q, o) => ws?.questions.find((x) => x.key === q)?.options.find((x) => x.key === o)?.label ?? o,
    goal: (g) => ws?.goals.find((x) => x.id === g)?.label ?? g,
    component: (c) => ws?.components.find((x) => x.slug === c)?.name ?? c,
  }), [ws]);
}

function RulesPage() {
  const qc = useQueryClient();
  const load = useServerFn(getRulesWorkspace);
  const { data: ws, isLoading, error } = useQuery({ queryKey: ["admin-rules"], queryFn: () => load() });
  const [tab, setTab] = useState<"rules" | "simulate">("rules");
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [profile, setProfile] = useState<DiagnosticProfile>({ goals: [], answers: {}, classification: {} });
  const labels = useLabels(ws);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-rules"] });

  const prio = useServerFn(setRulePriority);
  const prioM = useMutation({ mutationFn: (v: { id: string; priority: number }) => prio({ data: v }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });

  const current = selected && selected !== "new" ? ws?.rules.find((r) => r.id === selected) : undefined;

  return (
    <AdminShell breadcrumbs={[{ label: "Rules" }]}>
      <p className="eyebrow">Admin</p>
      <h1 className="display mt-2 text-3xl">Recommendation rules</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Rules adjust what the built-in engine recommends. Only <strong>active</strong> rules affect visitors. Higher priority wins; if
        equal-priority rules disagree, the built-in verdict is kept. Payments for shops and a CRM for follow-up are always enforced.
        Rules never change prices.
      </p>
      <div className="mt-5 flex gap-2">
        {(["rules", "simulate"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`${btn} ${tab === t ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}>
            {t === "rules" ? "Rules" : "Simulate diagnostic"}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading rules…</p>}
      {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}

      {ws && tab === "rules" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-2">
            <button type="button" className={btn} onClick={() => setSelected("new")}>
              <Plus className="h-3.5 w-3.5" /> New rule
            </button>
            {ws.rules.length === 0 && <p className="text-sm text-muted-foreground">No rules yet. The built-in engine decides everything.</p>}
            {ws.rules.map((r) => {
              const v = validateRule(r, ws);
              return (
                <div key={r.id} className={`rounded-xl border p-3 ${selected === r.id ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}>
                  <button type="button" onClick={() => setSelected(r.id)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{describeRule(r, labels)}</p>
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Priority {r.priority}</span>
                    <button type="button" aria-label="Raise priority" className="rounded border border-border p-0.5" onClick={() => prioM.mutate({ id: r.id, priority: Math.min(1000, r.priority + 10) })}><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" aria-label="Lower priority" className="rounded border border-border p-0.5" onClick={() => prioM.mutate({ id: r.id, priority: Math.max(-1000, r.priority - 10) })}><ArrowDown className="h-3 w-3" /></button>
                    {r.version > 0 && <span>v{r.version}</span>}
                    {(v.errors.length > 0 || v.warnings.length > 0) && (
                      <span className={`ml-auto inline-flex items-center gap-1 ${v.errors.length ? "text-destructive" : "text-amber-600"}`}>
                        <AlertTriangle className="h-3 w-3" /> {v.errors.length + v.warnings.length}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {ws.log.length > 0 && (
              <details className="rounded-xl border border-border p-3 text-xs">
                <summary className="cursor-pointer font-medium">Recent changes</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {ws.log.slice(0, 20).map((l) => (
                    <li key={l.id}>{new Date(l.created_at).toLocaleString()} · {l.rule_key} · {l.action}{l.detail ? ` — ${l.detail}` : ""}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div>
            {selected ? (
              <RuleEditor
                key={selected}
                ws={ws}
                labels={labels}
                initial={current ? safeDraft(current) : emptyDraft()}
                profile={profile}
                setProfile={setProfile}
                onSaved={(id) => { refresh(); setSelected(id); }}
                onRemoved={() => { refresh(); setSelected(null); }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Select a rule or create a new one.</div>
            )}
          </div>
        </div>
      )}

      {ws && tab === "simulate" && <Simulator ws={ws} labels={labels} profile={profile} setProfile={setProfile} />}
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ editor */

function RuleEditor({ ws, labels, initial, profile, setProfile, onSaved, onRemoved }: {
  ws: RulesWorkspace; labels: Labels; initial: Draft; profile: DiagnosticProfile; setProfile: (p: DiagnosticProfile) => void;
  onSaved: (id: string) => void; onRemoved: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  useEffect(() => setD(initial), [initial.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useServerFn(saveRule);
  const status = useServerFn(setRuleStatus);
  const dup = useServerFn(duplicateRule);
  const remove = useServerFn(removeRule);
  const validation = validateRule(d, ws);
  const fail = (e: Error) => toast.error(e.message);

  const saveM = useMutation({
    mutationFn: () => save({ data: { id: d.id, key: d.key, name: d.name, description: d.description, internal_notes: d.internal_notes, priority: d.priority, conditions: d.conditions, actions: d.actions } }),
    onSuccess: (r) => { toast.success("Rule saved"); onSaved(r.id); }, onError: fail,
  });
  const statusM = useMutation({ mutationFn: (s: Draft["status"]) => status({ data: { id: d.id!, status: s } }), onSuccess: () => { toast.success("Status updated"); onSaved(d.id!); }, onError: fail });
  const dupM = useMutation({ mutationFn: () => dup({ data: { id: d.id! } }), onSuccess: (r) => { toast.success("Copied as a draft"); onSaved(r.id); }, onError: fail });
  const removeM = useMutation({ mutationFn: () => remove({ data: { id: d.id! } }), onSuccess: (r) => { toast.success(r.result === "archived" ? "Rule was used before, so it was archived" : "Rule deleted"); onRemoved(); }, onError: fail });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-5">
      <Section title="Rule">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={input} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Businesses selling products" /></Field>
          <Field label="Key (permanent ID)">
            <input className={input} value={d.key} disabled={d.version > 0} onChange={(e) => set("key", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="sell-products-ecommerce" />
          </Field>
          <Field label="Priority (100 very high · 0 normal · -50 low)">
            <input type="number" className={input} value={d.priority} onChange={(e) => set("priority", Math.max(-1000, Math.min(1000, Number(e.target.value) || 0)))} />
          </Field>
          <Field label="Status">
            <span className={`inline-block rounded-full px-2 py-1 text-xs uppercase tracking-wider ${STATUS_STYLE[d.status]}`}>{d.status}{d.version > 0 ? ` · v${d.version}` : ""}</span>
          </Field>
        </div>
        <Field label="Description"><textarea className={input} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Internal notes (never shown to clients)"><textarea className={input} rows={2} value={d.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} /></Field>
      </Section>

      <Section title="When">
        <GroupEditor ws={ws} group={d.conditions as Extract<Condition, { kind: "group" }>} depth={0} onChange={(g) => set("conditions", g)} />
      </Section>

      <Section title="Then">
        <ActionsEditor ws={ws} actions={d.actions} onChange={(a) => set("actions", a)} />
      </Section>

      <div className="rounded-xl border border-border bg-card/40 p-4 text-sm">
        <p className="eyebrow">Summary</p>
        <p className="mt-1">{describeRule(d, labels)}</p>
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-1 text-sm">
          {validation.errors.map((e) => <p key={e} className="text-destructive">✗ {e}</p>)}
          {validation.warnings.map((w) => <p key={w} className="text-amber-600">⚠ {w}</p>)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={saveM.isPending} onClick={() => saveM.mutate()}>Save{d.status === "active" ? " (creates new version)" : ""}</button>
        {d.id && d.status !== "active" && <button type="button" className={btn} disabled={validation.errors.length > 0 || statusM.isPending} onClick={() => statusM.mutate("active")}><Check className="h-3.5 w-3.5" /> Activate</button>}
        {d.id && d.status === "active" && <button type="button" className={btn} onClick={() => statusM.mutate("draft")}>Move to draft</button>}
        {d.id && d.status !== "archived" && <button type="button" className={btn} onClick={() => statusM.mutate("archived")}>Archive</button>}
        {d.id && <button type="button" className={btn} onClick={() => dupM.mutate()}><Copy className="h-3.5 w-3.5" /> Copy</button>}
        {d.id && <button type="button" className={`${btn} text-destructive`} onClick={() => { if (confirm("Delete this rule? Rules that were ever active are archived instead.")) removeM.mutate(); }}><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
      </div>
      {d.id && d.status !== "active" && <p className="text-xs text-muted-foreground">Save your edits before activating — activation uses the saved version.</p>}

      <Section title="Test this rule">
        <ProfileEditor ws={ws} profile={profile} setProfile={setProfile} />
        <RuleTest rule={d} profile={profile} labels={labels} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

type Group = Extract<Condition, { kind: "group" }>;

function GroupEditor({ ws, group, depth, onChange, onRemove }: { ws: RulesWorkspace; group: Group; depth: number; onChange: (g: Group) => void; onRemove?: () => void }) {
  const setChild = (i: number, c: Condition | null) => {
    const children = [...group.children];
    if (c) children[i] = c; else children.splice(i, 1);
    onChange({ ...group, children });
  };
  const firstQ = ws.questions[0];
  const newLeaf: LeafCondition = firstQ
    ? { kind: "answer", question: firstQ.key, op: "contains", value: firstQ.options[0]?.key ?? "" }
    : { kind: "goal", op: "selected", value: ws.goals[0]?.id ?? "" };
  return (
    <div className={`space-y-2 ${depth > 0 ? "rounded-xl border border-dashed border-border p-3" : ""}`}>
      <div className="flex items-center gap-2 text-sm">
        <select className={`${input} w-auto`} value={group.mode} onChange={(e) => onChange({ ...group, mode: e.target.value as Group["mode"] })}>
          <option value="all">ALL of these are true</option>
          <option value="any">ANY of these is true</option>
        </select>
        {onRemove && <button type="button" className="ml-auto text-muted-foreground" aria-label="Remove group" onClick={onRemove}><X className="h-4 w-4" /></button>}
      </div>
      {group.children.map((c, i) =>
        c.kind === "group" ? (
          <GroupEditor key={i} ws={ws} group={c} depth={depth + 1} onChange={(g) => setChild(i, g)} onRemove={() => setChild(i, null)} />
        ) : (
          <LeafEditor key={i} ws={ws} leaf={c} onChange={(l) => setChild(i, l)} onRemove={() => setChild(i, null)} />
        ),
      )}
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => onChange({ ...group, children: [...group.children, newLeaf] })}><Plus className="h-3.5 w-3.5" /> Condition</button>
        {depth < 2 && <button type="button" className={btn} onClick={() => onChange({ ...group, children: [...group.children, { kind: "group", mode: "any", children: [] }] })}><Plus className="h-3.5 w-3.5" /> Group</button>}
      </div>
    </div>
  );
}

const OP_LABEL: Record<string, string> = {
  equals: "is", not_equals: "is not", contains: "includes", not_contains: "does not include", answered: "is answered", not_answered: "is not answered",
  empty: "is empty", not_empty: "is not empty", eq: "equals", neq: "does not equal", gt: "greater than", gte: "at least", lt: "less than", lte: "at most",
  selected: "is selected", not_selected: "is not selected",
};

function LeafEditor({ ws, leaf, onChange, onRemove }: { ws: RulesWorkspace; leaf: LeafCondition; onChange: (l: LeafCondition) => void; onRemove: () => void }) {
  const source = leaf.kind === "goal" ? "goal" : leaf.kind === "classification" ? `class:${leaf.field}` : `q:${leaf.question}`;
  const changeSource = (v: string) => {
    if (v === "goal") return onChange({ kind: "goal", op: "selected", value: ws.goals[0]?.id ?? "" });
    if (v.startsWith("class:")) return onChange({ kind: "classification", field: v.slice(6) as never, op: "contains", value: "" });
    const q = ws.questions.find((x) => x.key === v.slice(2))!;
    if (["single_choice", "multi_choice", "yes_no"].includes(q.type)) return onChange({ kind: "answer", question: q.key, op: "contains", value: q.options[0]?.key ?? "" });
    if (q.type === "number") return onChange({ kind: "number", question: q.key, op: "gte", value: 0 });
    onChange({ kind: "text", question: q.key, op: "not_empty", value: "" });
  };
  const ops = leaf.kind === "answer" ? ANSWER_OPS : leaf.kind === "number" ? NUMBER_OPS : leaf.kind === "goal" ? GOAL_OPS : TEXT_OPS;
  const noValue = ["answered", "not_answered", "empty", "not_empty"].includes(leaf.op);
  const q = leaf.kind === "answer" ? ws.questions.find((x) => x.key === leaf.question) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
      <select className={`${input} w-auto max-w-[260px]`} value={source} onChange={(e) => changeSource(e.target.value)}>
        <option value="goal">Business goal</option>
        <optgroup label="Diagnostic questions">
          {ws.questions.map((x) => <option key={x.key} value={`q:${x.key}`}>{x.question}{x.status === "archived" ? " (archived)" : ""}</option>)}
        </optgroup>
        <optgroup label="Business classification">
          {CLASSIFICATION_FIELDS.map((f) => <option key={f} value={`class:${f}`}>{f.replace("_", " ")}</option>)}
        </optgroup>
      </select>
      <select className={`${input} w-auto`} value={leaf.op} onChange={(e) => onChange({ ...leaf, op: e.target.value } as LeafCondition)}>
        {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      {!noValue && (leaf.kind === "goal" ? (
        <select className={`${input} w-auto`} value={leaf.value} onChange={(e) => onChange({ ...leaf, value: e.target.value })}>
          {ws.goals.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      ) : leaf.kind === "answer" ? (
        <select className={`${input} w-auto`} value={leaf.value} onChange={(e) => onChange({ ...leaf, value: e.target.value })}>
          {q?.options.map((o) => <option key={o.key} value={o.key}>{o.label}{o.active ? "" : " (inactive)"}</option>)}
        </select>
      ) : leaf.kind === "number" ? (
        <input type="number" className={`${input} w-28`} value={leaf.value} onChange={(e) => onChange({ ...leaf, value: Number(e.target.value) || 0 })} />
      ) : (
        <input className={`${input} w-48`} value={leaf.value} onChange={(e) => onChange({ ...leaf, value: e.target.value } as LeafCondition)} />
      ))}
      <button type="button" className="ml-auto text-muted-foreground" aria-label="Remove condition" onClick={onRemove}><X className="h-4 w-4" /></button>
    </div>
  );
}

const ACTION_LABEL: Record<RuleAction["type"], string> = {
  recommend: "Recommend", optional: "Mark as optional", exclude: "Exclude", set_reason: "Set reason only", set_priority: "Set display priority",
};

function ActionsEditor({ ws, actions, onChange }: { ws: RulesWorkspace; actions: RuleAction[]; onChange: (a: RuleAction[]) => void }) {
  const upd = (i: number, patch: Partial<RuleAction>) => onChange(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-2">
      {actions.map((a, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-muted/40 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${input} w-auto`} value={a.type} onChange={(e) => upd(i, { type: e.target.value as RuleAction["type"] })}>
              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className={`${input} w-auto`} value={a.component} onChange={(e) => upd(i, { component: e.target.value })}>
              <option value="">Choose a component…</option>
              {(["look", "attract", "convert", "run"] as const).map((p) => (
                <optgroup key={p} label={p.toUpperCase()}>
                  {ws.components.filter((c) => c.pillar === p).map((c) => <option key={c.slug} value={c.slug}>{c.name}{c.status !== "active" ? ` (${c.status})` : ""}</option>)}
                </optgroup>
              ))}
            </select>
            {a.type === "set_priority" && <input type="number" className={`${input} w-24`} value={a.priority} onChange={(e) => upd(i, { priority: Number(e.target.value) || 0 })} />}
            <button type="button" className="ml-auto text-muted-foreground" aria-label="Remove action" onClick={() => onChange(actions.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
          </div>
          {a.type !== "set_priority" && (
            <input className={input} placeholder="Reason shown to the client (optional)" value={a.reason} onChange={(e) => upd(i, { reason: e.target.value })} />
          )}
        </div>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...actions, { type: "recommend", component: "", reason: "", priority: 0 }])}><Plus className="h-3.5 w-3.5" /> Action</button>
      <p className="text-xs text-muted-foreground">Rules can never change prices — those come from the Pricing Manager.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ testing */

function ProfileEditor({ ws, profile, setProfile }: { ws: RulesWorkspace; profile: DiagnosticProfile; setProfile: (p: DiagnosticProfile) => void }) {
  const toggle = (list: string[], v: string, single: boolean) => (list.includes(v) ? list.filter((x) => x !== v) : single ? [v] : [...list, v]);
  const cls = profile.classification as Record<string, unknown>;
  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">Sample client — nothing is saved and no customer is created.</p>
      <div>
        <p className="mb-1 font-medium">Goals</p>
        <div className="flex flex-wrap gap-1.5">
          {ws.goals.map((g) => (
            <Chip key={g.id} on={profile.goals.includes(g.id)} onClick={() => setProfile({ ...profile, goals: toggle(profile.goals, g.id, false) })}>{g.label}</Chip>
          ))}
        </div>
      </div>
      {ws.questions.filter((q) => q.status !== "archived").map((q) => {
        const cur = profile.answers[q.key] ?? [];
        const choice = ["single_choice", "multi_choice", "yes_no"].includes(q.type);
        return (
          <div key={q.key}>
            <p className="mb-1 font-medium">{q.question}</p>
            {choice ? (
              <div className="flex flex-wrap gap-1.5">
                {q.options.filter((o) => o.active).map((o) => (
                  <Chip key={o.key} on={cur.includes(o.key)} onClick={() => setProfile({ ...profile, answers: { ...profile.answers, [q.key]: toggle(cur, o.key, q.type !== "multi_choice") } })}>{o.label}</Chip>
                ))}
              </div>
            ) : (
              <input className={input} value={cur[0] ?? ""} onChange={(e) => setProfile({ ...profile, answers: { ...profile.answers, [q.key]: e.target.value ? [e.target.value] : [] } })} />
            )}
          </div>
        );
      })}
      <div className="grid gap-2 sm:grid-cols-2">
        {CLASSIFICATION_FIELDS.map((f) => (
          <Field key={f} label={`Business ${f.replace("_", " ")}${f === "services" ? " (comma separated)" : f === "lead_value" ? " (high / medium / low)" : ""}`}>
            <input
              className={input}
              value={Array.isArray(cls[f]) ? (cls[f] as string[]).join(", ") : String(cls[f] ?? "")}
              onChange={(e) => setProfile({ ...profile, classification: { ...cls, [f]: f === "services" ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value } })}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1 ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function TraceView({ t }: { t: ConditionTrace }) {
  return (
    <li>
      <span className={t.matched ? "text-primary" : "text-destructive"}>{t.matched ? "✓" : "✗"}</span> {t.label}
      {t.children && <ul className="ml-5 mt-1 space-y-1">{t.children.map((c, i) => <TraceView key={i} t={c} />)}</ul>}
    </li>
  );
}

function relabel(t: ConditionTrace, c: Condition, l: Labels): ConditionTrace {
  if (c.kind === "group") return { ...t, children: t.children?.map((ch, i) => relabel(ch, c.children[i]!, l)) };
  return { ...t, label: describeRule({ conditions: c, actions: [] }, l).replace(/^If /, "").replace(/, do nothing\.$/, "") };
}

function RuleTest({ rule, profile, labels }: { rule: Draft; profile: DiagnosticProfile; labels: Labels }) {
  let trace: ConditionTrace | null = null;
  let err: string | null = null;
  try { trace = relabel(evaluateCondition(rule.conditions, profile), rule.conditions, labels); } catch (e) { err = (e as Error).message; }
  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!trace) return null;
  return (
    <div className="rounded-xl border border-border p-3 text-sm">
      <p className="font-semibold">Result: <span className={trace.matched ? "text-primary" : "text-destructive"}>{trace.matched ? "MATCHED" : "NOT MATCHED"}</span></p>
      <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Conditions</p>
      <ul className="mt-1 space-y-1"><TraceView t={trace} /></ul>
      {trace.matched && (
        <>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Actions</p>
          <ul className="mt-1">{rule.actions.map((a, i) => <li key={i}>{ACTION_LABEL[a.type]} → {labels.component?.(a.component) || "(none)"}</li>)}</ul>
        </>
      )}
    </div>
  );
}

function Simulator({ ws, labels, profile, setProfile }: { ws: RulesWorkspace; labels: Labels; profile: DiagnosticProfile; setProfile: (p: DiagnosticProfile) => void }) {
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const catalogue: CatalogueInfo = useMemo(() => new Map(ws.components.map((c) => [c.slug, { name: c.name, pillar: c.pillar, status: c.status, display_order: c.display_order }])), [ws]);
  const rules: EngineRule[] = ws.rules.filter((r) => r.status === "active" || (includeDrafts && r.status === "draft")).map((r) => ({ ...r, version: r.version || 0 }));
  const engine = safeRecommend(profile, [], catalogue);
  const withRules = rules.length ? evaluateRules(profile, rules, catalogue) : engine;
  const diff = diffResults(engine, withRules);
  const counts = diff.reduce<Record<string, number>>((m, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + 1 }), {});
  const byC = new Map(withRules.decisions.map((d) => [d.component, d]));
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Section title="Sample client"><ProfileEditor ws={ws} profile={profile} setProfile={setProfile} /></Section>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} /> Include draft rules (preview only — visitors never see drafts)
        </label>
        <p className="text-sm text-muted-foreground">
          {rules.length} rule(s) evaluated · Added {counts["added"] ?? 0} · Removed {counts["removed"] ?? 0} · Changed {counts["changed"] ?? 0} · Unchanged {counts["unchanged"] ?? 0}
        </p>
        {withRules.warnings.map((w) => <p key={w} className="text-sm text-amber-600">⚠ {w}</p>)}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-2">Component</th><th className="p-2">Built-in engine</th><th className="p-2">With rules</th><th className="p-2">Source</th></tr>
            </thead>
            <tbody>
              {diff.map((r) => {
                const d = byC.get(r.component);
                const src = d?.source.type === "rule" ? `Rule: ${d.source.ruleKey}` : d?.source.type === "dependency" ? `Required by ${labels.component?.(d.source.requiredBy)}` : "Built-in engine";
                return (
                  <tr key={r.component} className={`border-t border-border ${r.kind !== "unchanged" ? "bg-primary/5" : ""}`}>
                    <td className="p-2">{labels.component?.(r.component)}</td>
                    <td className="p-2">{r.before ?? "—"}</td>
                    <td className="p-2 font-medium">{r.after ?? "—"}{r.kind !== "unchanged" && <span className="ml-1 text-xs text-primary">({r.kind})</span>}</td>
                    <td className="p-2 text-xs text-muted-foreground">{src}{d?.conflicts.length ? ` · conflict: ${d.conflicts[0]!.ruleKeys.join(" vs ")}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
