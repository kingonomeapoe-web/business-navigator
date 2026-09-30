/**
 * Configurable recommendation rules — pure, deterministic, browser-safe.
 *
 * Pipeline:
 *   profile → baseline decide() (recommend.ts) → active rules overlay
 *   → enforceDependencies (safety) → deterministic ordering → RecommendationResult
 *
 * PRECEDENCE / CONFLICT POLICY
 * - Rules are sorted by priority DESC, then key ASC (never insertion order).
 * - For each component, the verdict comes from the highest-priority matching rule
 *   that sets a verdict (recommend / optional / exclude).
 * - If two matching rules share that top priority and disagree on verdict, the
 *   conflict is recorded and the baseline engine verdict is kept for that component.
 * - Reasons follow the same precedence; set_priority adjusts ranking only.
 * - Fixed dependencies (ecommerce → payments, follow-up → CRM) always run last and win.
 * - Rules never touch prices. No eval, no dynamic code: conditions are typed data.
 */
import { z } from "zod";

import { decide, enforceDependencies, type Decision, type DiagnosticProfile, type Verdict } from "./recommend";

/* ------------------------------------------------------------------ schema */

export const ANSWER_OPS = ["equals", "not_equals", "contains", "not_contains", "answered", "not_answered"] as const;
export const TEXT_OPS = ["equals", "not_equals", "contains", "not_contains", "empty", "not_empty"] as const;
export const NUMBER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export const GOAL_OPS = ["selected", "not_selected"] as const;
export const CLASSIFICATION_FIELDS = ["industry", "specialization", "business_model", "lead_value", "services", "primary_market"] as const;
export const ACTION_TYPES = ["recommend", "optional", "exclude", "set_reason", "set_priority"] as const;

const key = z.string().trim().min(1).max(80);

export const leafSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), question: key, op: z.enum(ANSWER_OPS), value: z.string().max(80).default("") }),
  z.object({ kind: z.literal("text"), question: key, op: z.enum(TEXT_OPS), value: z.string().max(400).default("") }),
  z.object({ kind: z.literal("number"), question: key, op: z.enum(NUMBER_OPS), value: z.number().finite() }),
  z.object({ kind: z.literal("classification"), field: z.enum(CLASSIFICATION_FIELDS), op: z.enum(TEXT_OPS), value: z.string().max(200).default("") }),
  z.object({ kind: z.literal("goal"), op: z.enum(GOAL_OPS), value: key }),
]);
export type LeafCondition = z.infer<typeof leafSchema>;
export type ConditionGroup = { kind: "group"; mode: "all" | "any"; children: Condition[] };
export type Condition = LeafCondition | ConditionGroup;

export const MAX_DEPTH = 3;
export const conditionSchema: z.ZodType<Condition, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([leafSchema, z.object({ kind: z.literal("group"), mode: z.enum(["all", "any"]), children: z.array(conditionSchema).max(25) })]),
);

export const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  component: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(600).default(""),
  priority: z.number().int().min(-1000).max(1000).default(0),
});
export type RuleAction = z.infer<typeof actionSchema>;

export type EngineRule = {
  id: string;
  key: string;
  name: string;
  priority: number;
  version: number;
  conditions: Condition;
  actions: RuleAction[];
};

/* ------------------------------------------------------------------ evaluation */

const norm = (s: string) => s.trim().toLowerCase();
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)]);

function textMatch(values: string[], op: (typeof TEXT_OPS)[number], expected: string): boolean {
  const vals = values.map(norm).filter(Boolean);
  const e = norm(expected);
  switch (op) {
    case "empty": return vals.length === 0;
    case "not_empty": return vals.length > 0;
    case "equals": return vals.some((v) => v === e);
    case "not_equals": return !vals.some((v) => v === e);
    case "contains": return vals.some((v) => v.includes(e));
    case "not_contains": return !vals.some((v) => v.includes(e));
  }
}

export function evaluateLeaf(c: LeafCondition, p: DiagnosticProfile): boolean {
  const answers = p.answers ?? {};
  switch (c.kind) {
    case "goal": {
      const has = (p.goals ?? []).includes(c.value);
      return c.op === "selected" ? has : !has;
    }
    case "answer": {
      // Answers are stored as arrays of stable option keys; membership semantics.
      const sel = listOf(answers[c.question]);
      switch (c.op) {
        case "answered": return sel.length > 0;
        case "not_answered": return sel.length === 0;
        case "equals": return sel.length === 1 && sel[0] === c.value;
        case "not_equals": return !(sel.length === 1 && sel[0] === c.value);
        case "contains": return sel.includes(c.value);
        case "not_contains": return !sel.includes(c.value);
      }
      return false;
    }
    case "text": return textMatch(listOf(answers[c.question]), c.op, c.value);
    case "number": {
      const raw = listOf(answers[c.question])[0];
      const n = raw === undefined ? NaN : Number(raw);
      if (!Number.isFinite(n)) return c.op === "neq";
      switch (c.op) {
        case "eq": return n === c.value;
        case "neq": return n !== c.value;
        case "gt": return n > c.value;
        case "gte": return n >= c.value;
        case "lt": return n < c.value;
        case "lte": return n <= c.value;
      }
      return false;
    }
    case "classification": {
      const v = (p.classification as Record<string, unknown>)[c.field];
      return textMatch(listOf(v), c.op, c.value);
    }
  }
}

export type ConditionTrace = { label: string; matched: boolean; children?: ConditionTrace[] | undefined };

export function evaluateCondition(c: Condition, p: DiagnosticProfile, depth = 0): ConditionTrace {
  if (c.kind === "group") {
    if (depth >= MAX_DEPTH) throw new Error("Condition groups nested too deeply");
    const children = c.children.map((ch) => evaluateCondition(ch, p, depth + 1));
    // An empty group never matches — a rule with no conditions must not fire for everyone.
    const matched = children.length === 0 ? false : c.mode === "all" ? children.every((x) => x.matched) : children.some((x) => x.matched);
    return { label: c.mode === "all" ? "ALL of these are true" : "ANY of these is true", matched, children };
  }
  return { label: describeLeaf(c), matched: evaluateLeaf(c, p) };
}

/* ------------------------------------------------------------------ describing */

export type Labels = {
  question?: (key: string) => string;
  option?: (question: string, option: string) => string;
  goal?: (id: string) => string;
  component?: (slug: string) => string;
};

const OP_WORDS: Record<string, string> = {
  equals: "is", not_equals: "is not", contains: "includes", not_contains: "does not include",
  answered: "is answered", not_answered: "is not answered", empty: "is empty", not_empty: "is not empty",
  eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", selected: "is selected", not_selected: "is not selected",
};

export function describeLeaf(c: LeafCondition, l: Labels = {}): string {
  const q = (k: string) => l.question?.(k) ?? k;
  switch (c.kind) {
    case "goal": return `Goal "${l.goal?.(c.value) ?? c.value}" ${OP_WORDS[c.op]}`;
    case "answer":
      return ["answered", "not_answered"].includes(c.op)
        ? `${q(c.question)} ${OP_WORDS[c.op]}`
        : `${q(c.question)} ${OP_WORDS[c.op]} "${l.option?.(c.question, c.value) ?? c.value}"`;
    case "text": return ["empty", "not_empty"].includes(c.op) ? `${q(c.question)} ${OP_WORDS[c.op]}` : `${q(c.question)} ${OP_WORDS[c.op]} "${c.value}"`;
    case "number": return `${q(c.question)} ${OP_WORDS[c.op]} ${c.value}`;
    case "classification": {
      const f = c.field.replace("_", " ");
      return ["empty", "not_empty"].includes(c.op) ? `Business ${f} ${OP_WORDS[c.op]}` : `Business ${f} ${OP_WORDS[c.op]} "${c.value}"`;
    }
  }
}

export function describeCondition(c: Condition, l: Labels = {}): string {
  if (c.kind !== "group") return describeLeaf(c, l);
  if (c.children.length === 0) return "(no conditions)";
  const parts = c.children.map((ch) => (ch.kind === "group" ? `(${describeCondition(ch, l)})` : describeCondition(ch, l)));
  return parts.join(c.mode === "all" ? " and " : " or ");
}

const ACTION_WORDS: Record<RuleAction["type"], string> = {
  recommend: "recommend", optional: "make optional", exclude: "exclude", set_reason: "set the reason for", set_priority: "set the priority of",
};

export function describeRule(r: Pick<EngineRule, "conditions" | "actions">, l: Labels = {}): string {
  const actions = r.actions.map((a) => {
    const name = l.component?.(a.component) ?? a.component;
    return a.type === "set_priority" ? `set ${name} priority to ${a.priority}` : `${ACTION_WORDS[a.type]} ${name}`;
  });
  return `If ${describeCondition(r.conditions, l)}, ${actions.join(", ") || "do nothing"}.`;
}

/* ------------------------------------------------------------------ result contract */

export type DecisionSource =
  | { type: "engine" }
  | { type: "rule"; ruleId: string; ruleKey: string; ruleVersion: number }
  | { type: "dependency"; requiredBy: string };

/** Stable contract consumed by the plan today and the Website Blueprint Engine later. */
export type RecommendationDecision = {
  component: string;
  name: string | null;
  pillar: string | null;
  verdict: Verdict;
  reason: string;
  priority: number;
  source: DecisionSource;
  reasonSource: DecisionSource;
  baselineVerdict: Verdict | null;
  requiredBy: string[];
  conflicts: { ruleKeys: string[]; verdicts: Verdict[]; resolution: "kept_baseline" }[];
  order: number;
};

export type RecommendationResult = {
  contractVersion: 1;
  mode: "engine" | "rules";
  fallbackReason: string | null;
  decisions: RecommendationDecision[];
  appliedRules: { id: string; key: string; version: number }[];
  warnings: string[];
};

export type CatalogueInfo = Map<string, { name: string; pillar: string; status: string; display_order?: number }>;

const VERDICT_OF: Partial<Record<RuleAction["type"], Verdict>> = { recommend: "recommended", optional: "optional", exclude: "excluded" };
const PILLAR_ORDER: Record<string, number> = { look: 0, attract: 1, convert: 2, run: 3 };

export function sortRules<T extends { priority: number; key: string }>(rules: T[]): T[] {
  return [...rules].sort((a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Evaluate the full pipeline. Throws only on programmer error; use
 * `safeRecommend` in production code paths.
 */
export function evaluateRules(profile: DiagnosticProfile, rules: EngineRule[], catalogue?: CatalogueInfo): RecommendationResult {
  const baseline = decide(profile);
  const baseMap = new Map(baseline.map((d) => [d.slug, { ...d }]));
  const warnings: string[] = [];

  type Hit = { rule: EngineRule; action: RuleAction };
  const verdictHits = new Map<string, Hit[]>();
  const reasonHits = new Map<string, Hit[]>();
  const priorityHits = new Map<string, Hit[]>();
  const applied: RecommendationResult["appliedRules"] = [];

  for (const rule of sortRules(rules)) {
    const parsed = conditionSchema.safeParse(rule.conditions);
    if (!parsed.success) { warnings.push(`Rule ${rule.key} skipped: invalid conditions`); continue; }
    const actions = z.array(actionSchema).safeParse(rule.actions);
    if (!actions.success) { warnings.push(`Rule ${rule.key} skipped: invalid actions`); continue; }
    if (!evaluateCondition(parsed.data, profile).matched) continue;
    applied.push({ id: rule.id, key: rule.key, version: rule.version });
    for (const action of actions.data) {
      const info = catalogue?.get(action.component);
      if (catalogue && (!info || info.status === "archived")) {
        warnings.push(`Rule ${rule.key}: component ${action.component} is missing or archived — action skipped`);
        continue;
      }
      const target = VERDICT_OF[action.type] ? verdictHits : action.type === "set_priority" ? priorityHits : reasonHits;
      const list = target.get(action.component) ?? [];
      list.push({ rule, action });
      target.set(action.component, list);
      if (VERDICT_OF[action.type] && action.reason) {
        const r = reasonHits.get(action.component) ?? [];
        r.push({ rule, action });
        reasonHits.set(action.component, r);
      }
    }
  }

  const slugs = new Set<string>([...baseMap.keys(), ...verdictHits.keys()]);
  const working: Decision[] = [];
  const meta = new Map<string, Omit<RecommendationDecision, "verdict" | "reason" | "requiredBy" | "order" | "name" | "pillar" | "component">>();

  for (const slug of slugs) {
    const base = baseMap.get(slug);
    let verdict: Verdict = base?.verdict ?? "optional";
    let reason = base?.reason ?? "";
    let source: DecisionSource = { type: "engine" };
    let reasonSource: DecisionSource = { type: "engine" };
    const conflicts: RecommendationDecision["conflicts"] = [];

    const vh = verdictHits.get(slug) ?? [];
    if (vh.length) {
      const top = vh[0]!.rule.priority;
      const tied = vh.filter((h) => h.rule.priority === top);
      const verdicts = [...new Set(tied.map((h) => VERDICT_OF[h.action.type]!))];
      if (verdicts.length > 1) {
        conflicts.push({ ruleKeys: tied.map((h) => h.rule.key), verdicts, resolution: "kept_baseline" });
      } else {
        const w = tied[0]!;
        verdict = verdicts[0]!;
        source = { type: "rule", ruleId: w.rule.id, ruleKey: w.rule.key, ruleVersion: w.rule.version };
      }
    }
    const rh = (reasonHits.get(slug) ?? []).filter((h) => h.action.reason);
    // Only use a rule reason that agrees with the final verdict (or a pure set_reason).
    const chosenReason = rh.find((h) => h.action.type === "set_reason" || VERDICT_OF[h.action.type] === verdict);
    if (chosenReason) {
      reason = chosenReason.action.reason;
      reasonSource = { type: "rule", ruleId: chosenReason.rule.id, ruleKey: chosenReason.rule.key, ruleVersion: chosenReason.rule.version };
    } else if (source.type === "rule" && !base) {
      reason = catalogue?.get(slug)?.name ?? "";
    }
    const ph = priorityHits.get(slug)?.[0];
    working.push({ slug, verdict, reason });
    meta.set(slug, { priority: ph ? ph.action.priority : 0, source, reasonSource, baselineVerdict: base?.verdict ?? null, conflicts });
  }

  const { adjustments } = enforceDependencies(working);
  const requiredBy = new Map<string, string[]>();
  for (const a of adjustments) {
    requiredBy.set(a.slug, [...(requiredBy.get(a.slug) ?? []), a.requiredBy]);
    const m = meta.get(a.slug)!;
    m.source = { type: "dependency", requiredBy: a.requiredBy };
    m.reasonSource = m.source;
  }

  const decisions: RecommendationDecision[] = working
    .map((d) => {
      const info = catalogue?.get(d.slug);
      return { component: d.slug, name: info?.name ?? null, pillar: info?.pillar ?? null, verdict: d.verdict, reason: d.reason, requiredBy: requiredBy.get(d.slug) ?? [], order: 0, ...meta.get(d.slug)! };
    })
    .sort((a, b) =>
      (PILLAR_ORDER[a.pillar ?? ""] ?? 9) - (PILLAR_ORDER[b.pillar ?? ""] ?? 9) ||
      b.priority - a.priority ||
      (catalogue?.get(a.component)?.display_order ?? 0) - (catalogue?.get(b.component)?.display_order ?? 0) ||
      (a.component < b.component ? -1 : 1),
    )
    .map((d, i) => ({ ...d, order: i }));

  return { contractVersion: 1, mode: rules.length ? "rules" : "engine", fallbackReason: null, decisions, appliedRules: applied, warnings };
}

/** Engine-only result in the same contract. */
export function engineResult(profile: DiagnosticProfile, catalogue?: CatalogueInfo, fallbackReason: string | null = null): RecommendationResult {
  const r = evaluateRules(profile, [], catalogue);
  return { ...r, mode: "engine", fallbackReason };
}

/** Never throws. Any failure returns the existing engine behaviour. */
export function safeRecommend(profile: DiagnosticProfile, rules: EngineRule[] | null, catalogue?: CatalogueInfo): RecommendationResult {
  try {
    if (!rules || rules.length === 0) return engineResult(profile, catalogue, rules ? "no_active_rules" : "rules_unavailable");
    return evaluateRules(profile, rules, catalogue);
  } catch (err) {
    console.error("[rules] evaluation failed, using engine fallback", err);
    try {
      return engineResult(profile, catalogue, "evaluation_error");
    } catch {
      const d = decide(profile);
      return {
        contractVersion: 1, mode: "engine", fallbackReason: "evaluation_error", appliedRules: [], warnings: [],
        decisions: d.map((x, i) => ({ component: x.slug, name: null, pillar: null, verdict: x.verdict, reason: x.reason, priority: 0, source: { type: "engine" }, reasonSource: { type: "engine" }, baselineVerdict: x.verdict, requiredBy: [], conflicts: [], order: i })),
      };
    }
  }
}

/* ------------------------------------------------------------------ comparison */

export type DiffRow = { component: string; kind: "added" | "removed" | "changed" | "unchanged"; before: Verdict | null; after: Verdict | null };

export function diffResults(before: RecommendationResult, after: RecommendationResult): DiffRow[] {
  const a = new Map(before.decisions.map((d) => [d.component, d.verdict]));
  const b = new Map(after.decisions.map((d) => [d.component, d.verdict]));
  const all = [...new Set([...a.keys(), ...b.keys()])].sort();
  return all.map((c) => {
    const x = a.get(c) ?? null, y = b.get(c) ?? null;
    const kind: DiffRow["kind"] = x === null ? "added" : y === null ? "removed" : x === y ? "unchanged" : "changed";
    return { component: c, kind, before: x, after: y };
  });
}
