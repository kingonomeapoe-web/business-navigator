/**
 * Server-only recommendation-rule logic. Admin callers must run `requireAdmin` first.
 * `loadActiveRules` is used by the public diagnostic and never throws.
 */
import { DIAGNOSTIC_QUESTIONS, GOAL_OPTIONS } from "./diagnostic-content";
import { conditionSchema, sortRules, type Condition, type EngineRule, type RuleAction } from "./rules-engine";
import type { RuleInput, RuleStatus } from "./rules-schemas";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type RuleRow = {
  id: string; key: string; name: string; description: string; internal_notes: string; status: RuleStatus;
  priority: number; version: number; conditions: Condition; actions: RuleAction[];
  updated_at: string; activated_at: string | null; archived_at: string | null;
};

export type WorkspaceQuestion = { key: string; question: string; type: string; status: string; options: { key: string; label: string; active: boolean }[] };
export type WorkspaceComponent = { slug: string; name: string; pillar: string; status: string; display_order: number };

export type RulesWorkspace = {
  rules: RuleRow[];
  questions: WorkspaceQuestion[];
  components: WorkspaceComponent[];
  goals: { id: string; label: string }[];
  log: { id: string; rule_key: string; action: string; detail: string | null; created_at: string }[];
};

const RULE_COLS = "id,key,name,description,internal_notes,status,priority,version,conditions,actions,updated_at,activated_at,archived_at";

export async function workspace(): Promise<RulesWorkspace> {
  const s = await db();
  const [rules, qs, comps, log] = await Promise.all([
    s.from("recommendation_rules").select(RULE_COLS).order("priority", { ascending: false }).order("key"),
    s.from("diagnostic_questions").select("key,question,question_type,status,diagnostic_question_options(key,label,active,display_order)").order("display_order"),
    s.from("components").select("slug,name,pillar,status,display_order").order("display_order"),
    s.from("rule_change_log").select("id,rule_key,action,detail,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const questions: WorkspaceQuestion[] = ((qs.data ?? []) as any[]).map((q) => ({
    key: q.key, question: q.question, type: q.question_type, status: q.status,
    options: q.question_type === "yes_no"
      ? [{ key: "yes", label: "Yes", active: true }, { key: "no", label: "No", active: true }]
      : ((q.diagnostic_question_options ?? []) as any[]).sort((a, b) => a.display_order - b.display_order).map((o) => ({ key: o.key, label: o.label, active: o.active })),
  }));
  // Built-in questions stay referenceable while the builder set is unpublished.
  for (const q of DIAGNOSTIC_QUESTIONS) {
    if (!questions.some((x) => x.key === q.id)) {
      questions.push({ key: q.id, question: q.question, type: q.type === "single" ? "single_choice" : "multi_choice", status: "built_in", options: q.options.map((o) => ({ key: o.id, label: o.label, active: true })) });
    }
  }
  return { rules: rules.data ?? [], questions, components: comps.data ?? [], goals: GOAL_OPTIONS, log: log.data ?? [] };
}

/* ------------------------------------------------------------------ validation */

function leaves(c: Condition): Exclude<Condition, { kind: "group" }>[] {
  return c.kind === "group" ? c.children.flatMap(leaves) : [c];
}

export function validateRule(
  rule: Pick<RuleInput, "conditions" | "actions" | "priority" | "key"> & { id?: string },
  ws: Pick<RulesWorkspace, "questions" | "components" | "goals" | "rules">,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!conditionSchema.safeParse(rule.conditions).success) errors.push("The conditions are not valid.");
  const ls = leaves(rule.conditions);
  if (ls.length === 0) errors.push("Add at least one condition.");
  if (rule.actions.length === 0) errors.push("Add at least one action.");
  const depth = (c: Condition, d = 1): number => (c.kind === "group" ? Math.max(d, ...c.children.map((x) => depth(x, d + 1))) : d - 1);
  if (depth(rule.conditions) > 3) errors.push("Groups can be nested at most three levels deep.");

  for (const l of ls) {
    if (l.kind === "goal") {
      if (!ws.goals.some((g) => g.id === l.value)) errors.push(`Unknown goal "${l.value}".`);
      continue;
    }
    if (l.kind === "classification") {
      if (!["empty", "not_empty"].includes(l.op) && !l.value) errors.push(`Enter a value for business ${l.field}.`);
      continue;
    }
    const q = ws.questions.find((x) => x.key === l.question);
    if (!q) { errors.push(`Unknown question "${l.question}".`); continue; }
    if (q.status === "archived") warnings.push(`This rule references a question that is archived: "${q.question}".`);
    const choice = ["single_choice", "multi_choice", "yes_no"].includes(q.type);
    if (l.kind === "answer") {
      if (!choice) errors.push(`"${q.question}" is not a choice question — use a text or number condition.`);
      else if (!["answered", "not_answered"].includes(l.op)) {
        const opt = q.options.find((o) => o.key === l.value);
        if (!opt) errors.push(`"${l.value}" is not an answer of "${q.question}".`);
        else if (!opt.active) warnings.push(`This condition can never match because "${opt.label}" is no longer available.`);
      }
    }
    if (l.kind === "number" && q.type !== "number") errors.push(`"${q.question}" is not a number question.`);
    if (l.kind === "text" && choice) warnings.push(`"${q.question}" is a choice question; an answer condition is usually clearer.`);
  }

  for (const a of rule.actions) {
    const c = ws.components.find((x) => x.slug === a.component);
    if (!c) errors.push(`Unknown component "${a.component}".`);
    else if (c.status === "archived") warnings.push(`This rule targets ${c.name}, which is archived — the action will be skipped.`);
    else if (c.status === "draft") warnings.push(`${c.name} is still a draft component.`);
    if (a.type === "set_reason" && !a.reason) errors.push("A set-reason action needs a reason.");
  }

  // Equal-priority conflicts with other active rules.
  const mine = rule.actions.filter((a) => ["recommend", "optional", "exclude"].includes(a.type));
  for (const other of ws.rules) {
    if (other.id === rule.id || other.status !== "active" || other.priority !== rule.priority) continue;
    for (const a of mine) {
      const clash = (other.actions ?? []).find((b) => b.component === a.component && ["recommend", "optional", "exclude"].includes(b.type) && b.type !== a.type);
      if (clash) warnings.push(`May conflict with active rule "${other.name}" (same priority, ${clash.type} vs ${a.type} on ${a.component}). If both match, the built-in engine's verdict is kept.`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

/* ------------------------------------------------------------------ mutations */

async function log(ruleId: string | null, ruleKey: string, action: string, detail: string | null, userId: string) {
  const s = await db();
  await s.from("rule_change_log").insert({ rule_id: ruleId, rule_key: ruleKey, action, detail, changed_by: userId });
}

async function snapshot(row: RuleRow, userId: string) {
  const s = await db();
  const version = row.version + 1;
  await s.from("recommendation_rule_versions").insert({ rule_id: row.id, version, key: row.key, name: row.name, priority: row.priority, conditions: row.conditions, actions: row.actions, activated_by: userId });
  await s.from("recommendation_rules").update({ version }).eq("id", row.id);
  return version;
}

export async function saveRule(input: RuleInput, userId: string): Promise<{ id: string; warnings: string[] }> {
  const s = await db();
  const ws = await workspace();
  const { errors, warnings } = validateRule(input, ws);
  const existing = input.id ? ws.rules.find((r) => r.id === input.id) : undefined;
  if (input.id && !existing) throw new Error("Rule not found");
  if (existing?.status === "active" && errors.length) throw new Error(`Active rules must be valid: ${errors.join(" ")}`);
  if (ws.rules.some((r) => r.key === input.key && r.id !== input.id)) throw new Error("Another rule already uses this key.");
  if (existing && existing.version > 0 && existing.key !== input.key) throw new Error("The key of a rule that has been active cannot change.");

  const payload = { key: input.key, name: input.name, description: input.description, internal_notes: input.internal_notes, priority: input.priority, conditions: input.conditions, actions: input.actions, updated_by: userId };
  if (existing) {
    const { error } = await s.from("recommendation_rules").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
    await log(existing.id, input.key, "updated", null, userId);
    if (existing.status === "active") {
      const v = await snapshot({ ...existing, ...payload } as RuleRow, userId);
      await log(existing.id, input.key, "version", `Active rule changed; now version ${v}`, userId);
    }
    return { id: existing.id, warnings };
  }
  const { data, error } = await s.from("recommendation_rules").insert({ ...payload, created_by: userId }).select("id").single();
  if (error) throw new Error(error.message);
  await log(data.id, input.key, "created", null, userId);
  return { id: data.id, warnings };
}

export async function setStatus(id: string, status: RuleStatus, userId: string) {
  const s = await db();
  const ws = await workspace();
  const row = ws.rules.find((r) => r.id === id);
  if (!row) throw new Error("Rule not found");
  if (status === "active") {
    const { errors } = validateRule(row, ws);
    if (errors.length) throw new Error(`Fix these before activating: ${errors.join(" ")}`);
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_by: userId };
  if (status === "active") Object.assign(patch, { activated_at: now, activated_by: userId, archived_at: null, archived_by: null });
  if (status === "archived") Object.assign(patch, { archived_at: now, archived_by: userId });
  const { error } = await s.from("recommendation_rules").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  let detail: string | null = null;
  if (status === "active") detail = `Version ${await snapshot(row, userId)}`;
  await log(id, row.key, `status:${status}`, detail, userId);
  return { ok: true as const };
}

export async function setPriority(id: string, priority: number, userId: string) {
  const s = await db();
  const ws = await workspace();
  const row = ws.rules.find((r) => r.id === id);
  if (!row) throw new Error("Rule not found");
  const { error } = await s.from("recommendation_rules").update({ priority, updated_by: userId }).eq("id", id);
  if (error) throw new Error(error.message);
  await log(id, row.key, "priority", `${row.priority} → ${priority}`, userId);
  if (row.status === "active") await snapshot({ ...row, priority }, userId);
  return { ok: true as const };
}

export async function duplicateRule(id: string, userId: string) {
  const ws = await workspace();
  const row = ws.rules.find((r) => r.id === id);
  if (!row) throw new Error("Rule not found");
  let key = `${row.key}-copy`.slice(0, 80);
  for (let i = 2; ws.rules.some((r) => r.key === key); i++) key = `${row.key}-copy-${i}`.slice(0, 80);
  return saveRule({ key, name: `${row.name} (copy)`, description: row.description, internal_notes: row.internal_notes, priority: row.priority, conditions: row.conditions, actions: row.actions }, userId);
}

/** Rules that were ever active are archived, never deleted, to keep history intact. */
export async function removeRule(id: string, userId: string): Promise<{ result: "deleted" | "archived" }> {
  const s = await db();
  const { data: row } = await s.from("recommendation_rules").select("id,key,version").eq("id", id).single();
  if (!row) throw new Error("Rule not found");
  if (row.version > 0) {
    await setStatus(id, "archived", userId);
    return { result: "archived" };
  }
  const { error } = await s.from("recommendation_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await log(null, row.key, "deleted", null, userId);
  return { result: "deleted" };
}

/* ------------------------------------------------------------------ public */

/** Active rules in precedence order, or null if they could not be loaded. Never throws. */
export async function loadActiveRules(): Promise<EngineRule[] | null> {
  try {
    const s = await db();
    const { data, error } = await s.from("recommendation_rules").select("id,key,name,priority,version,conditions,actions").eq("status", "active");
    if (error) { console.error("[rules] load failed", error.message); return null; }
    return sortRules((data ?? []) as EngineRule[]);
  } catch (err) {
    console.error("[rules] load failed", err);
    return null;
  }
}
